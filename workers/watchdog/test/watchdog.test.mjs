import { test } from "node:test";
import assert from "node:assert/strict";
import { DOMAIN, healthy, timeline } from "./fixtures.mjs";
import { memKV, stubFetch, signStripe, baseEnv } from "./helpers.mjs";
import {
  watchableDomain, snapshot, diff, step, acknowledge, health, fixtureResolver, Budget, BudgetError, budgeted, expiryAlert,
  ownershipRecord, verifyOwnership, webCheck, DAY,
} from "../src/engine.js";
import worker, { onCheckout, onSubscription, runDue, isWatchdogCheckout } from "../src/index.js";

const HOUR = 3600000;
const T0 = Date.parse("2026-11-14T18:00:00Z");
const q = (s) => `"${s}"`;

// ---------- engine ----------

test("watchableDomain cleans input and refuses personal mailbox domains", () => {
  assert.equal(watchableDomain("https://www.LaunchPad.com/about"), "launchpad.com");
  assert.equal(watchableDomain("me@shop.io"), "shop.io");
  assert.equal(watchableDomain("gmail.com"), null);
  assert.equal(watchableDomain("not a domain"), null);
});

test("first look discovers the DKIM keys in use; daily snapshot only checks those", async () => {
  const resolve = fixtureResolver(healthy());
  const b1 = new Budget(100);
  const first = await snapshot(DOMAIN, { resolve: budgeted(resolve, b1), discover: true });
  assert.deepEqual(Object.keys(first.dkim).sort(), ["google", "resend"]);
  assert.ok(b1.used <= 32, `first look used ${b1.used} lookups`);
  const b2 = new Budget(100);
  const daily = await snapshot(DOMAIN, { resolve: budgeted(resolve, b2), selectors: Object.keys(first.dkim) });
  assert.ok(b2.used <= 10, `daily used ${b2.used} lookups`);
  assert.deepEqual(health(daily), []);
});

test("the drift timeline raises the right alerts, and a weaker DMARC put back after a deletion is still reported", async () => {
  const days = timeline();
  const first = await snapshot(DOMAIN, { resolve: fixtureResolver(days[0].zone), discover: true });
  let state = { last: first, good: first, open: [] };
  const sel = Object.keys(first.dkim);
  const got = [];
  for (const d of days.slice(1)) {
    const s = await snapshot(DOMAIN, { resolve: fixtureResolver(d.zone), selectors: sel });
    const r = step(state, s);
    state = r.state;
    got.push(r.alerts.map((a) => a.id));
  }
  assert.deepEqual(got[0], ["spf-senders"]);
  assert.deepEqual(got[1], ["dmarc-gone"]);
  assert.deepEqual(got[2], ["dmarc-policy"], "DMARC back but weaker than the last good setup is reported");
  assert.ok(!got[2].includes("dmarc-gone"), "the deletion isn't repeated");
  assert.deepEqual(got[3], ["dkim-gone"]);
  assert.deepEqual(got[4], ["ns-changed"]);
  assert.deepEqual(got[5], ["spf-loosened"]);
});

test("acknowledge makes the current setup normal", async () => {
  const z = healthy();
  const a = await snapshot(DOMAIN, { resolve: fixtureResolver(z), selectors: ["google"] });
  delete z[`_dmarc.${DOMAIN}`];
  const b = await snapshot(DOMAIN, { resolve: fixtureResolver(z), selectors: ["google"] });
  const r = step({ last: a, good: a, open: [] }, b);
  assert.equal(r.alerts[0].id, "dmarc-gone");
  const acked = acknowledge(r.state);
  assert.deepEqual(step(acked, b).alerts, []);
});

test("budget stops a run before the platform limit", async () => {
  const b = new Budget(3);
  const r = budgeted(fixtureResolver(healthy()), b);
  await r(DOMAIN, "MX"); await r(DOMAIN, "NS"); await r(DOMAIN, "TXT");
  await assert.rejects(() => r(DOMAIN, "TXT"), BudgetError);
});

test("expiry warnings at 30 and 7 days, each once", () => {
  const at = new Date(T0 + 20 * DAY).toISOString();
  const w30 = expiryAlert("x.com", at, [], T0);
  assert.equal(w30.level, 30);
  assert.equal(expiryAlert("x.com", at, [30], T0), null);
  assert.equal(expiryAlert("x.com", at, [30], T0 + 14 * DAY).level, 7);
  assert.equal(expiryAlert("x.com", new Date(T0 + 90 * DAY).toISOString(), [], T0), null);
  assert.equal(expiryAlert("x.com", null, [], T0), null);
});

test("ownership record is per subscription and verified from DNS", async () => {
  const rec = await ownershipRecord("sub_123", DOMAIN, "s");
  const other = await ownershipRecord("sub_456", DOMAIN, "s");
  assert.notEqual(rec.value, other.value);
  const z = healthy();
  assert.equal(await verifyOwnership("sub_123", DOMAIN, "s", fixtureResolver(z)), false);
  z[rec.host] = { TXT: [q(rec.value)] };
  assert.equal(await verifyOwnership("sub_123", DOMAIN, "s", fixtureResolver(z)), true);
  assert.equal(await verifyOwnership("sub_456", DOMAIN, "s", fixtureResolver(z)), false);
});

test("web check: below 500 is up; errors and TLS failures are down", async () => {
  assert.equal((await webCheck("x.com", { fetcher: async () => new Response("", { status: 404 }) })).up, true);
  assert.equal((await webCheck("x.com", { fetcher: async () => new Response("", { status: 503 }) })).up, false);
  assert.equal((await webCheck("x.com", { fetcher: async () => { throw new TypeError("cert"); } })).up, false);
});

// ---------- Worker flows ----------

const session = (over = {}) => ({ object: "checkout.session", id: "cs_1", mode: "subscription", status: "complete", subscription: "sub_ABC12345", customer: "cus_1", payment_link: "plink_month", customer_details: { email: "Founder@Launchpad.test" }, custom_fields: [{ key: "domain", text: { value: `https://www.${DOMAIN}/` } }], ...over });
const ev = (type, object, livemode = true) => ({ id: "evt_1", type, livemode, data: { object } });

test("only Watchdog checkouts are picked up", () => {
  const env = baseEnv(memKV());
  assert.equal(isWatchdogCheckout(session(), env), true);
  assert.equal(isWatchdogCheckout(session({ payment_link: "plink_other" }), env), false);
  assert.equal(isWatchdogCheckout(session({ payment_link: "plink_other", metadata: { offer: "nk_watchdog" } }), env), true);
  assert.equal(isWatchdogCheckout(session({ mode: "payment" }), env), false);
});

async function subscribe(env, zone) {
  const f = stubFetch({ resolve: fixtureResolver(zone) });
  try { await onCheckout(env, ev("checkout.session.completed", session()), session(), T0); } finally { f.restore(); }
  return f.sent;
}

test("checkout creates a verifying subscriber, emails the TXT record, notifies hello@, and ignores a repeat", async () => {
  const kv = memKV(); const env = baseEnv(kv);
  const sent = await subscribe(env, healthy());
  const acct = JSON.parse(await kv.get("acct:sub_ABC12345"));
  assert.equal(acct.domain, DOMAIN);
  assert.equal(acct.email, "founder@launchpad.test");
  assert.equal(acct.status, "verifying");
  assert.equal(sent.length, 2);
  assert.match(sent[0].text, /_neonkey-watchdog/);
  assert.deepEqual(sent[0].bcc, ["bcc@neonkey.test"]);
  assert.equal(sent[1].to[0], "hello@neonkey.tech");
  const again = stubFetch({ resolve: fixtureResolver(healthy()) });
  const r = await onCheckout(env, ev("checkout.session.completed", session()), session(), T0);
  again.restore();
  assert.equal(r.duplicate, true);
  assert.equal(again.sent.length, 0);
});

test("a personal mailbox domain asks the buyer for their real domain", async () => {
  const kv = memKV(); const env = baseEnv(kv);
  const s = session({ custom_fields: [{ key: "domain", text: { value: "gmail.com" } }] });
  const f = stubFetch();
  await onCheckout(env, ev("checkout.session.completed", s), s, T0);
  f.restore();
  assert.equal(JSON.parse(await kv.get("acct:sub_ABC12345")).status, "needs-domain");
  assert.match(f.sent[0].subject, /Which domain/);
});

async function run(env, zone, now, web) {
  const f = stubFetch({ resolve: fixtureResolver(zone), web, rdap: () => new Date(now + 200 * DAY).toISOString() });
  try { return { r: await runDue(env, { now, resolve: fixtureResolver(zone) }), sent: f.sent }; } finally { f.restore(); }
}

async function activeSubscriber() {
  const kv = memKV(); const env = baseEnv(kv);
  const zone = healthy();
  await subscribe(env, zone);
  // not added yet: nothing happens but a later check is scheduled
  let { sent } = await run(env, zone, T0 + 11 * 60000);
  assert.equal(sent.length, 0);
  const rec = await ownershipRecord("sub_ABC12345", DOMAIN, env.WATCHDOG_SECRET);
  zone[rec.host] = { TXT: [q(rec.value)] };
  const out = await run(env, zone, T0 + 2 * HOUR);
  return { kv, env, zone, out };
}

test("once the TXT record shows up, the first look runs inside the budget and the subscriber is emailed", async () => {
  const { kv, out } = await activeSubscriber();
  const acct = JSON.parse(await kv.get("acct:sub_ABC12345"));
  assert.equal(acct.status, "active");
  assert.ok(out.r.used <= 45, `used ${out.r.used}`);
  assert.match(out.sent[0].subject, /Watching launchpad\.test/);
  assert.match(out.sent[0].text, /Registration expires/);
});

test("daily: nothing changed means no email; a deletion is confirmed 15 minutes later before alerting", async () => {
  const { kv, env, zone } = await activeSubscriber();
  let t = T0 + 2 * HOUR + DAY + 1;
  assert.equal((await run(env, zone, t)).sent.length, 0);
  delete zone[`_dmarc.${DOMAIN}`];
  t += DAY + 1;
  assert.equal((await run(env, zone, t)).sent.length, 0, "first sighting waits");
  const { sent } = await run(env, zone, t + 15 * 60000 + 1);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /Action needed: Your DMARC record was removed/);
  assert.match(sent[0].text, /\/ack\?a=sub_ABC12345&t=[0-9a-f]{32}/);
  // next day, still missing: not repeated
  assert.equal((await run(env, zone, t + DAY + 20 * 60000)).sent.length, 0);
  const acct = JSON.parse(await kv.get("acct:sub_ABC12345"));
  assert.deepEqual(acct.state.open, ["dmarc-gone"]);
});

test("a blip that is gone 15 minutes later never emails", async () => {
  const { env, zone } = await activeSubscriber();
  const t = T0 + 2 * HOUR + DAY + 1;
  const saved = zone[`_dmarc.${DOMAIN}`];
  delete zone[`_dmarc.${DOMAIN}`];
  assert.equal((await run(env, zone, t)).sent.length, 0);
  zone[`_dmarc.${DOMAIN}`] = saved;
  assert.equal((await run(env, zone, t + 15 * 60000 + 1)).sent.length, 0);
});

test("homepage down is confirmed, alerted once, and recovery is reported", async () => {
  const { env, zone } = await activeSubscriber();
  let t = T0 + 2 * HOUR + DAY + 1;
  const down = () => ({ throw: true });
  assert.equal((await run(env, zone, t, down)).sent.length, 0);
  let s = (await run(env, zone, t + 15 * 60000 + 1, down)).sent;
  assert.equal(s.length, 1);
  assert.match(s[0].subject, /isn't loading/);
  assert.doesNotMatch(s[0].text, /\/ack\?/, "no 'I meant to do this' for a down site");
  t += 15 * 60000 + 1 + 6 * HOUR + 1;
  assert.equal((await run(env, zone, t, down)).sent.length, 0, "not repeated while down");
  s = (await run(env, zone, t + 6 * HOUR + 1)).sent;
  assert.equal(s.length, 1);
  assert.match(s[0].subject, /Back to normal/);
});

test("monthly check-in after 30 days", async () => {
  const { env, zone } = await activeSubscriber();
  const { sent } = await run(env, zone, T0 + 2 * HOUR + 31 * DAY);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /Monthly check-in: launchpad\.test looks healthy/);
});

test("cancel stops checks, emails once, and keeps the record only 30 days", async () => {
  const { kv, env } = await activeSubscriber();
  const f = stubFetch();
  await onSubscription(env, ev("customer.subscription.deleted", { id: "sub_ABC12345", status: "canceled" }), { id: "sub_ABC12345", status: "canceled" }, T0 + 3 * DAY);
  await onSubscription(env, ev("customer.subscription.deleted", { id: "sub_ABC12345", status: "canceled" }), { id: "sub_ABC12345", status: "canceled" }, T0 + 3 * DAY);
  f.restore();
  assert.equal(f.sent.filter((m) => m.to[0] === "founder@launchpad.test").length, 1);
  const e = kv.m.get("acct:sub_ABC12345");
  assert.equal(JSON.parse(e.v).status, "canceled");
  assert.equal(e.ttl, 30 * 86400);
  assert.equal((await run(env, healthy(), T0 + 10 * DAY)).sent.length, 0);
});

test("unpaid subscription pauses checks", async () => {
  const { kv, env, zone } = await activeSubscriber();
  await onSubscription(env, ev("customer.subscription.updated", { id: "sub_ABC12345", status: "unpaid" }), { id: "sub_ABC12345", status: "unpaid" });
  delete zone[`_dmarc.${DOMAIN}`];
  const t = T0 + 2 * HOUR + DAY + 1;
  await run(env, zone, t);
  assert.equal((await run(env, zone, t + 7 * HOUR)).sent.length, 0);
  assert.equal(JSON.parse(await kv.get("acct:sub_ABC12345")).pending ?? null, null);
});

test("webhook: bad signatures are refused; a signed checkout is processed", async () => {
  const kv = memKV(); const env = baseEnv(kv);
  const ctx = { waitUntil() {} };
  const bad = await worker.fetch(new Request("https://w/stripe", { method: "POST", headers: { "Stripe-Signature": "t=1,v1=" + "0".repeat(64) }, body: "{}" }), env, ctx);
  assert.equal(bad.status, 400);
  const { raw, header } = signStripe(ev("checkout.session.completed", session()), env.STRIPE_WEBHOOK_SECRET);
  const f = stubFetch({ resolve: fixtureResolver(healthy()) });
  const ok = await worker.fetch(new Request("https://w/stripe", { method: "POST", headers: { "Stripe-Signature": header }, body: raw }), env, ctx);
  f.restore();
  assert.equal(ok.status, 200);
  assert.ok(await kv.get("acct:sub_ABC12345"));
});

test("ack: GET only shows a button; POST with the right token makes the new setup normal; a wrong token is refused", async () => {
  const { kv, env, zone } = await activeSubscriber();
  delete zone[`_dmarc.${DOMAIN}`];
  const t = T0 + 2 * HOUR + DAY + 1;
  await run(env, zone, t);
  const { sent } = await run(env, zone, t + 15 * 60000 + 1);
  const link = sent[0].text.match(/https:\/\/\S+\/ack\?\S+/)[0];
  const u = new URL(link);
  const ctx = { waitUntil() {} };
  const g = await worker.fetch(new Request(link), env, ctx);
  assert.equal(g.status, 200);
  assert.match(await g.text(), /<form method="post"/);
  assert.deepEqual(JSON.parse(await kv.get("acct:sub_ABC12345")).state.open, ["dmarc-gone"]);
  const wrong = await worker.fetch(new Request("https://w/ack", { method: "POST", body: new URLSearchParams({ a: "sub_ABC12345", t: "0".repeat(32) }) }), env, ctx);
  assert.equal(wrong.status, 400);
  const p = await worker.fetch(new Request("https://w/ack", { method: "POST", body: new URLSearchParams({ a: u.searchParams.get("a"), t: u.searchParams.get("t") }) }), env, ctx);
  assert.equal(p.status, 200);
  assert.deepEqual(JSON.parse(await kv.get("acct:sub_ABC12345")).state.open, []);
  assert.equal((await run(env, zone, t + DAY + 20 * 60000)).sent.length, 0, "no alert after acknowledging");
});

test("emails escape what the buyer typed", async () => {
  const kv = memKV(); const env = baseEnv(kv);
  const s = session({ custom_fields: [{ key: "domain", text: { value: "<script>x</script>" } }] });
  const f = stubFetch();
  await onCheckout(env, ev("checkout.session.completed", s), s, T0);
  f.restore();
  assert.doesNotMatch(f.sent[0].html, /<script>/);
});
