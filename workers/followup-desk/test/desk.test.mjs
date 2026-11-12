// Run: npm test. Fake secrets, in-memory KV, stubbed Resend. No network, no real keys.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker, { runAccount, hourly, inbound, handleDeliveryEvent, stripQuoted } from "../src/index.js";
import { backup, BACKUP_HOUR_UTC } from "../src/ops.js";
import { parseList, nextDue, isDue, fill, message, parseDate, validDays, inSendWindow, DAY, DAILY_CAP } from "../src/engine.js";
import { fromAddress, followUpEmail } from "../src/mail.js";
import { getAccount } from "../src/store.js";

const SECRET = "whsec_unit_test_only";
const RESEND_SECRET = "whsec_" + Buffer.from("resend-test-secret").toString("base64");
const PLINK = "plink_desk_test";

// ---- fakes ----
class KV {
  constructor() { this.m = new Map(); }
  async get(k, type) { const v = this.m.get(k); return v === undefined ? null : type === "json" ? JSON.parse(v) : v; }
  async put(k, v) { this.m.set(k, String(v)); }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
let env, sent;
const ctx = { waitUntil: (p) => p };
beforeEach(() => {
  sent = [];
  env = {
    DESK: new KV(),
    STRIPE_WEBHOOK_SECRET: SECRET, RESEND_API_KEY: "re_test", RESEND_WEBHOOK_SECRET: RESEND_SECRET,
    DESK_PAYMENT_LINK: PLINK, ALLOW_LIVE: "true", APP_URL: "https://desk.example", DESK_DOMAIN: "desk.neonkey.tech",
    FROM_ADDRESS: "NeonKey 🔑 <hello@neonkey.tech>", NOTIFY_TO: "hello@neonkey.tech", REPLY_TO: "hello@neonkey.tech", BCC_ADDRESS: "michael@example.com",
  };
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    sent.push(JSON.parse(init.body));
    return new Response("{}", { status: 200 });
  };
});

function stripeReq(event) {
  const raw = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", SECRET).update(`${t}.${raw}`).digest("hex");
  return new Request("https://desk.example/stripe", { method: "POST", body: raw, headers: { "Stripe-Signature": `t=${t},v1=${sig}` } });
}
const checkout = (over = {}) => ({
  id: "evt_1", type: "checkout.session.completed", livemode: true,
  data: { object: { object: "checkout.session", id: "cs_1", status: "complete", payment_link: PLINK, subscription: "sub_1", customer: "cus_1", customer_details: { email: "Owner@Roofing.test", name: "Pat Owner" }, custom_fields: [{ key: "business", text: { value: "Smith Roofing" } }], ...over } },
});

async function signup() {
  const r = await worker.fetch(stripeReq(checkout()), env, ctx);
  assert.equal(r.status, 200);
  const welcome = sent.find((m) => m.subject.includes("ready"));
  const link = welcome.text.match(/https:\/\/desk\.example(\/d\/[A-Za-z0-9_-]+)/)[1];
  const id = await env.DESK.get("email:owner@roofing.test");
  return { link, id };
}
const form = (obj) => { const f = new FormData(); for (const [k, v] of Object.entries(obj)) f.append(k, v); return f; };
const post = (path, obj) => worker.fetch(new Request(`https://desk.example${path}`, { method: "POST", body: form(obj) }), env, ctx);
const get = (path) => worker.fetch(new Request(`https://desk.example${path}`), env, ctx);
async function setup(link) {
  const r = await post(`${link}/setup`, { business: "Smith Roofing", replyTo: "pat@roofing.test", signoff: "Pat, Smith Roofing", timezone: "America/Chicago" });
  assert.equal(r.status, 303);
  assert.match(r.headers.get("Location"), /m=setup/);
}

// Tuesday Nov 10 2026, 10:00 AM Central = 16:00 UTC.
const TUE_10AM = Date.UTC(2026, 10, 10, 16, 0);

// ---- engine ----
test("parseList reads a QuickBooks-style CSV with a header", () => {
  const { rows, skipped } = parseList(`Customer,Estimate No.,Date,Email,Total\n"Smith, Jane",1001,11/02/2026,jane@ex.test,"$4,500.00"\nBob Lee,1002,11/03/2026,,"$900"\n`, TUE_10AM);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { name: "Smith, Jane", email: "jane@ex.test", job: "1001", amount: "$4,500", sentOn: Date.UTC(2026, 10, 2, 12) });
  assert.equal(skipped.length, 1);
});

test("parseList reads plain lines in any order", () => {
  const { rows } = parseList("Jane Smith, jane@ex.test, Kitchen remodel, 11/3/2026\nBob <bob@ex.test>\n", TUE_10AM);
  assert.equal(rows[0].name, "Jane Smith");
  assert.equal(rows[0].job, "Kitchen remodel");
  assert.equal(rows[0].sentOn, Date.UTC(2026, 10, 3, 12));
  assert.equal(rows[1].name, "Bob");
  assert.equal(rows[1].email, "bob@ex.test");
});

test("dates and days validate", () => {
  assert.equal(parseDate("2/30/2026"), null);
  assert.equal(parseDate("2026-02-28"), Date.UTC(2026, 1, 28, 12));
  assert.deepEqual(validDays(["2", "5", "9"]), [2, 5, 9]);
  assert.equal(validDays(["5", "5", "9"]), null);
  assert.equal(validDays(["0", "5", "9"]), null);
});

test("schedule: day 3/7/14, never two follow-ups within 2 days", () => {
  const sentOn = Date.UTC(2026, 10, 1, 12);
  const item = { status: "open", step: 0, sentOn };
  assert.equal(nextDue(item, [3, 7, 14]), sentOn + 3 * DAY);
  // Added late (sent 20 days ago): first goes now, second waits 2 days instead of firing at once.
  const late = { status: "open", step: 1, sentOn: TUE_10AM - 20 * DAY, lastSentAt: TUE_10AM };
  assert.equal(isDue(late, [3, 7, 14], TUE_10AM + DAY), false);
  assert.equal(isDue(late, [3, 7, 14], TUE_10AM + 2 * DAY), true);
  assert.equal(nextDue({ step: 3, sentOn }, [3, 7, 14]), null);
});

test("send window is weekday 9-noon in the owner's zone", () => {
  assert.equal(inSendWindow(TUE_10AM, "America/Chicago"), true);
  assert.equal(inSendWindow(TUE_10AM, "America/Anchorage"), false); // 7 AM there
  assert.equal(inSendWindow(Date.UTC(2026, 10, 14, 16), "America/Chicago"), false); // Saturday
});

test("templates fill in, and the sender name can't break the header", () => {
  const s = { business: "Smith Roofing", signoff: "Pat", templates: undefined };
  assert.equal(fill("Hi {first_name}, {job}{amount_phrase} - {signoff}", { name: "jane smith", job: "the roof", amount: "$900" }, s), "Hi Jane, the roof ($900) - Pat");
  assert.equal(message({ kind: "estimate", step: 0, name: "", job: "the deck" }, s).subject, "Your estimate for the deck");
  assert.equal(fromAddress(env, 'Evil"\r\nBcc: x@y.test <a>'), '"EvilBcc xy.test a" <followups@desk.neonkey.tech>');
  const f = followUpEmail({ kind: "estimate", step: 0, name: "<b>x</b>", job: "<script>" }, s, "https://desk.example/u/a/b");
  assert.ok(!f.html.includes("<script>"));
});

// ---- signup ----
test("checkout creates an account and emails a private link, once", async () => {
  const { link, id } = await signup();
  assert.match(link, /^\/d\/[A-Za-z0-9_-]{43}$/);
  const acct = await getAccount(env, id);
  assert.equal(acct.settings.business, "Smith Roofing");
  assert.equal(acct.billing, "active");
  assert.ok(![...env.DESK.m.keys()].some((k) => k.includes(link.slice(3))), "raw token is never stored");
  const welcome = sent.find((m) => m.subject === "Your Follow-Up Desk is ready");
  assert.deepEqual(welcome.to, ["owner@roofing.test"]);
  assert.deepEqual(welcome.bcc, ["michael@example.com"]);
  assert.ok(sent.some((m) => m.to[0] === "hello@neonkey.tech" && m.subject.startsWith("FYI")));
  const n = sent.length;
  await worker.fetch(stripeReq(checkout()), env, ctx);
  assert.equal(sent.length, n, "re-delivered event does nothing");
});

test("any listed payment link creates an account (founding monthly and yearly links)", async () => {
  const multi = { ...env, DESK_PAYMENT_LINK: `plink_regular, ${PLINK} ,plink_yearly` };
  const r = await worker.fetch(stripeReq(checkout({ id: "cs_multi", payment_link: "plink_yearly" })), multi, ctx);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ignored, undefined);
  assert.ok(sent.some((m) => m.to[0] === "owner@roofing.test"), "welcome email sent");
  const none = await worker.fetch(stripeReq(checkout({ id: "cs_none", payment_link: "plink_yearly" })), { ...env, DESK_PAYMENT_LINK: "" }, ctx);
  assert.equal((await none.json()).ignored, "other_offer");
});

test("other payment links and bad signatures are ignored", async () => {
  const r = await worker.fetch(stripeReq(checkout({ payment_link: "plink_other" })), env, ctx);
  assert.equal((await r.json()).ignored, "other_offer");
  const bad = new Request("https://desk.example/stripe", { method: "POST", body: "{}", headers: { "Stripe-Signature": "t=1,v1=" + "0".repeat(64) } });
  assert.equal((await worker.fetch(bad, env, ctx)).status, 400);
  assert.equal(sent.length, 0);
});

// ---- dashboard ----
test("dashboard: bad token 404s, setup, add, duplicate, import, escaping", async () => {
  assert.equal((await get("/d/" + "x".repeat(43))).status, 404);
  const { link, id } = await signup();
  const page = await get(link);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("Content-Security-Policy"), /default-src 'none'/);
  assert.match(await page.text(), /get your Desk running/);
  await setup(link);
  let r = await post(`${link}/add`, { name: '<img src=x onerror=alert(1)>', email: "jane@ex.test", kind: "estimate", job: "Deck", date: "2026-11-02" });
  assert.match(r.headers.get("Location"), /m=added/);
  r = await post(`${link}/add`, { name: "Jane again", email: "JANE@ex.test", kind: "estimate", job: "", date: "" });
  assert.match(r.headers.get("Location"), /m=dup/);
  r = await post(`${link}/import`, { kind: "invoice", list: "Bob, bob@ex.test, Roof, $1200\njane@ex.test, again\nnope" });
  assert.match(r.headers.get("Location"), /m=imported/);
  const acct = await getAccount(env, id);
  assert.equal(acct.items.length, 2);
  assert.equal(acct.items[1].amount, "$1,200");
  const body = await (await get(link)).text();
  assert.ok(!body.includes("<img src=x"));
  assert.ok(body.includes("&lt;img src=x"));
});

test("settings validate days and email", async () => {
  const { link, id } = await signup();
  await setup(link);
  let r = await post(`${link}/settings`, { business: "Smith Roofing", replyTo: "pat@roofing.test", signoff: "Pat", timezone: "America/Denver", d0: "7", d1: "3", d2: "14" });
  assert.match(r.headers.get("Location"), /settings\?m=baddays/);
  r = await post(`${link}/settings`, { business: "Smith Roofing", replyTo: "pat@roofing.test", signoff: "Pat", timezone: "America/Denver", d0: "2", d1: "5", d2: "10", bccMe: "1", estimate_s0: "Hello {first_name}", estimate_b0: "Body" });
  assert.match(r.headers.get("Location"), /settings\?m=saved/);
  const acct = await getAccount(env, id);
  assert.deepEqual(acct.settings.days, [2, 5, 10]);
  assert.equal(acct.settings.timezone, "America/Denver");
  assert.equal(acct.settings.templates.estimate[0].subject, "Hello {first_name}");
  assert.equal(acct.settings.templates.estimate[1].subject, "Re: Your estimate for {job}"); // blank fields keep the old one
});

// ---- sending ----
async function readyAccount() {
  const { link, id } = await signup();
  await setup(link);
  await post(`${link}/add`, { name: "Jane Smith", email: "jane@ex.test", kind: "estimate", job: "the deck", date: "2026-11-02" });
  sent = [];
  return { link, id, acct: await getAccount(env, id) };
}

test("cron sends a due follow-up in the window, as the business, with a stop-on-reply address", async () => {
  const { acct } = await readyAccount();
  const out = await runAccount(env, acct, TUE_10AM); // Nov 2 + 3 days = due
  assert.equal(out.sent, 1);
  const m = sent[0];
  assert.equal(m.from, '"Smith Roofing" <followups@desk.neonkey.tech>');
  assert.deepEqual(m.to, ["jane@ex.test"]);
  assert.match(m.reply_to, /^r-[a-z0-9]{12}-[a-z0-9]{9}@desk\.neonkey\.tech$/);
  assert.deepEqual(m.bcc, ["pat@roofing.test"], "owner copy, not Michael");
  assert.match(m.text, /Hi Jane,/);
  assert.ok(m.headers["List-Unsubscribe"]);
  // Same hour again: nothing new is due.
  assert.equal((await runAccount(env, await getAccount(env, acct.id), TUE_10AM + 60000)).sent, 0);
});

test("nothing goes out outside the window, when paused, or before setup", async () => {
  const { acct, link } = await readyAccount();
  assert.equal((await runAccount(env, acct, TUE_10AM - 4 * 3600000)).sent, 0); // 6 AM
  await post(`${link}/pause`, { paused: "1" });
  assert.equal((await runAccount(env, await getAccount(env, acct.id), TUE_10AM)).sent, 0);
  assert.equal(sent.length, 0);
});

test("a reply stops follow-ups and reaches the owner; Reply goes to the customer", async () => {
  const { acct } = await readyAccount();
  await runAccount(env, acct, TUE_10AM);
  const to = sent[0].reply_to;
  sent = [];
  const raw = `From: Jane Smith <jane@ex.test>\r\nTo: ${to}\r\nSubject: Re: Your estimate for the deck\r\nContent-Type: text/plain\r\n\r\nYes, let's do it. Can you start Monday?\r\n\r\nOn Tue, Nov 10, 2026 at 10:00 AM Smith Roofing wrote:\r\n> Hi Jane\r\n`;
  const r = await inbound({ to, from: "jane@ex.test", raw, headers: new Headers() }, env);
  assert.equal(r, "replied");
  const fwd = sent[0];
  assert.deepEqual(fwd.to, ["pat@roofing.test"]);
  assert.equal(fwd.reply_to, "jane@ex.test");
  assert.equal(fwd.bcc, undefined, "customer correspondence is not BCC'd to Michael");
  assert.match(fwd.text, /Can you start Monday/);
  assert.ok(!fwd.text.includes("> Hi Jane"));
  const after = await getAccount(env, acct.id);
  assert.equal(after.items[0].status, "replied");
  sent = [];
  assert.equal((await runAccount(env, after, TUE_10AM + 5 * DAY)).sent, 0);
});

test("the stop marker wins even over a stale copy of the account", async () => {
  const { acct } = await readyAccount();
  const stale = structuredClone(acct);
  const to = `r-${acct.id}-${acct.items[0].id}@desk.neonkey.tech`;
  await inbound({ to, from: "jane@ex.test", raw: `From: jane@ex.test\r\nSubject: Re: hi\r\n\r\nNo thanks\r\n`, headers: new Headers() }, env);
  sent = [];
  assert.equal((await runAccount(env, stale, TUE_10AM)).sent, 0);
});

test("out-of-office replies don't stop follow-ups; owner replying to their copy is caught", async () => {
  const { acct } = await readyAccount();
  const to = `r-${acct.id}-${acct.items[0].id}@desk.neonkey.tech`;
  const r = await inbound({ to, from: "jane@ex.test", raw: `From: jane@ex.test\r\nSubject: Automatic reply: Your estimate\r\nAuto-Submitted: auto-replied\r\n\r\nI'm away\r\n`, headers: new Headers() }, env);
  assert.equal(r, "auto");
  assert.equal((await getAccount(env, acct.id)).items[0].status, "open");
  const o = await inbound({ to, from: "pat@roofing.test", raw: `From: pat@roofing.test\r\nSubject: Re: x\r\n\r\nJane, call me\r\n`, headers: new Headers() }, env);
  assert.equal(o, "owner");
  assert.match(sent.at(-1).subject, /didn't reach/);
  let rejected = "";
  assert.equal(await inbound({ to: "r-zzzzzzzzzzzz-aaaaaaaaa@desk.neonkey.tech", raw: "", setReject: (x) => (rejected = x) }, env), "unknown");
  assert.ok(rejected);
});

test("Won / Lost / Stop / Reopen from the dashboard", async () => {
  const { acct, link } = await readyAccount();
  const id = acct.items[0].id;
  await post(`${link}/item`, { id, to: "won" });
  assert.equal((await getAccount(env, acct.id)).items[0].status, "won");
  assert.equal((await runAccount(env, await getAccount(env, acct.id), TUE_10AM)).sent, 0);
  await post(`${link}/item`, { id, to: "stopped" });
  await post(`${link}/item`, { id, to: "open" });
  assert.equal((await getAccount(env, acct.id)).items[0].status, "open");
  assert.equal((await runAccount(env, await getAccount(env, acct.id), TUE_10AM)).sent, 1);
});

test("three follow-ups then done; daily cap holds", async () => {
  const { acct } = await readyAccount();
  let a = acct;
  for (const d of [0, 7, 14]) { await runAccount(env, a, Date.UTC(2026, 10, 2 + 3 + d, 16)); a = await getAccount(env, acct.id); }
  // Nov 5 (Thu), Nov 12 (Thu), Nov 19 (Thu)
  assert.equal(a.items[0].step, 3);
  assert.equal(a.items[0].status, "done");
  // Cap
  const many = await getAccount(env, acct.id);
  for (let i = 0; i < DAILY_CAP + 5; i++) many.items.push({ id: `cap${String(i).padStart(6, "0")}`, kind: "estimate", name: "x", email: `x${i}@ex.test`, sentOn: TUE_10AM - 10 * DAY, step: 0, status: "open", sends: [] });
  sent = [];
  const out = await runAccount(env, many, TUE_10AM);
  assert.equal(out.sent, DAILY_CAP);
});

test("bounces and spam complaints stop that job", async () => {
  const { acct } = await readyAccount();
  const item = acct.items[0].id;
  assert.equal(await handleDeliveryEvent(env, { type: "email.bounced", data: { tags: { acct: acct.id, item } } }), "bounced");
  assert.equal((await getAccount(env, acct.id)).items[0].status, "bounced");
  // Signed webhook end to end
  const body = JSON.stringify({ type: "email.complained", data: { tags: [{ name: "acct", value: acct.id }, { name: "item", value: item }] } });
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", Buffer.from("resend-test-secret")).update(`msg_1.${ts}.${body}`).digest("base64");
  const r = await worker.fetch(new Request("https://desk.example/resend", { method: "POST", body, headers: { "svix-id": "msg_1", "svix-timestamp": String(ts), "svix-signature": `v1,${sig}` } }), env, ctx);
  assert.equal(r.status, 200);
  const bad = await worker.fetch(new Request("https://desk.example/resend", { method: "POST", body, headers: { "svix-id": "msg_1", "svix-timestamp": String(ts), "svix-signature": "v1,AAAA" } }), env, ctx);
  assert.equal(bad.status, 400);
});

test("recipient can stop follow-ups with one click", async () => {
  const { acct } = await readyAccount();
  const path = `/u/${acct.id}/${acct.items[0].id}`;
  assert.match(await (await get(path)).text(), /Stop these follow-ups\?/);
  await post(path, {});
  assert.equal((await getAccount(env, acct.id)).items[0].status, "stopped");
});

test("cancel stops sending; data is deleted 30 days later; signing up again restores it", async () => {
  const { acct } = await readyAccount();
  const ev = { id: "evt_2", type: "customer.subscription.deleted", livemode: true, data: { object: { object: "subscription", id: "sub_1", status: "canceled" } } };
  await worker.fetch(stripeReq(ev), env, ctx);
  let a = await getAccount(env, acct.id);
  assert.equal(a.billing, "canceled");
  sent = [];
  assert.equal((await runAccount(env, a, TUE_10AM)).sent, 0);
  // Re-subscribe within 30 days keeps the list.
  await worker.fetch(stripeReq(checkout({ id: "cs_2", subscription: "sub_2" })), env, ctx);
  a = await getAccount(env, acct.id);
  assert.equal(a.billing, "active");
  assert.equal(a.items.length, 1);
  // Cancel again and let 31 days pass.
  await worker.fetch(stripeReq({ ...ev, data: { object: { ...ev.data.object, id: "sub_2" } } }), env, ctx);
  a = await getAccount(env, acct.id);
  const out = await runAccount(env, a, a.canceledAt + 31 * DAY);
  assert.equal(out.deleted, true);
  assert.deepEqual([...env.DESK.m.keys()].sort(), ["sess:cs_1", "sess:cs_2"]); // only the 90-day checkout markers remain
});

test("cancel at period end: Michael hears right away with the reason; dashboard offers Pause; undo is noticed", async () => {
  const { acct, link } = await readyAccount();
  env.PORTAL_URL = "https://billing.example/login";
  const sub = { object: "subscription", id: "sub_1", status: "active", cancel_at_period_end: true, cancel_at: 1796083200, cancellation_details: { feedback: "too_expensive", comment: "Slow <season>" } };
  sent = [];
  await worker.fetch(stripeReq({ id: "evt_c1", type: "customer.subscription.updated", livemode: true, data: { object: sub } }), env, ctx);
  let a = await getAccount(env, acct.id);
  assert.equal(a.billing, "active");
  assert.equal(a.cancelScheduled, true);
  const notice = sent.find((m) => m.subject.includes("cancel scheduled"));
  assert.ok(notice, "notice sent to hello@");
  assert.match(notice.text, /too expensive/);
  assert.match(notice.text, /Slow <season>/);
  assert.match(notice.text, /2026-12-01/);
  assert.ok(!/<season>/.test(notice.html), "comment is escaped in the HTML notice");
  assert.ok(!sent.some((m) => m.to === "owner@roofing.test" || (Array.isArray(m.to) && m.to.includes("owner@roofing.test"))), "nothing goes to the customer");
  // Same event again: no second notice.
  sent = [];
  await worker.fetch(stripeReq({ id: "evt_c2", type: "customer.subscription.updated", livemode: true, data: { object: sub } }), env, ctx);
  assert.equal(sent.length, 0);
  // Follow-ups still run until the period ends.
  assert.equal((await runAccount(env, a, TUE_10AM)).sent, 1);
  // Dashboard shows the banner with Pause and a way back, escaped.
  const page = await (await get(link)).text();
  assert.match(page, /set to end at the close of this billing period/);
  assert.match(page, /Turn it back on in Billing/);
  assert.match(page, /Billing and cancel/);
  // Customer turns the cancellation off.
  sent = [];
  await worker.fetch(stripeReq({ id: "evt_c3", type: "customer.subscription.updated", livemode: true, data: { object: { ...sub, cancel_at_period_end: false, cancellation_details: {} } } }), env, ctx);
  a = await getAccount(env, acct.id);
  assert.equal(a.cancelScheduled, undefined);
  assert.ok(sent.some((m) => /turned their cancellation back off/.test(m.text)));
  // Period ends: the canceled notice carries the reason too.
  sent = [];
  await worker.fetch(stripeReq({ id: "evt_c4", type: "customer.subscription.deleted", livemode: true, data: { object: { ...sub, status: "canceled" } } }), env, ctx);
  const done = sent.find((m) => m.subject.includes("canceled"));
  assert.match(done.text, /too expensive/);
});

test("sign-in link: same page either way, rate limited", async () => {
  await signup();
  sent = [];
  const a = await (await post("/login", { email: "owner@roofing.test" })).text();
  const b = await (await post("/login", { email: "nobody@ex.test" })).text();
  assert.equal(a, b);
  await post("/login", { email: "owner@roofing.test" });
  assert.equal(sent.length, 1);
});

test("stripQuoted keeps only the new text", () => {
  assert.equal(stripQuoted("Sounds good\n\nOn Tue, Nov 10, 2026, Smith Roofing <x@y> wrote:\n> old"), "Sounds good");
});

test("getting-started checklist tracks progress and disappears when done", async () => {
  const { link, id } = await signup();
  await setup(link);
  let body = await (await get(link)).text();
  assert.match(body, /Getting started/);
  assert.match(body, /1 of 4 done/);
  await post(`${link}/add`, { name: "Jane", email: "jane@ex.test", kind: "estimate", job: "Deck", date: "" });
  await post(`${link}/test`, {});
  assert.ok((await getAccount(env, id)).previewSent);
  body = await (await get(link)).text();
  assert.ok(!body.includes("Getting started"));
  assert.match(body, /Paste a list/);
});

test("HTML-only replies become plain text with no markup left", async () => {
  const { htmlToText } = await import("../src/index.js");
  const t = htmlToText('<style>p{x}</style><p>Yes &amp; thanks</p><script>alert(1)</script><<script>x</script>b>done<br>ok');
  assert.ok(!t.includes("<") && !t.includes(">"));
  assert.match(t, /Yes & thanks/);
  assert.ok(!t.includes("alert"));
  assert.match(htmlToText("<".repeat(50000)), /^$/);
});

test("ids use only the 36 allowed characters at the right length", async () => {
  const { randomId } = await import("../src/engine.js");
  for (let i = 0; i < 200; i++) assert.match(randomId(12), /^[a-z0-9]{12}$/);
});

// ---- ops: alerts, heartbeat, backup ----
class R2 {
  constructor() { this.m = new Map(); }
  async put(k, v, opts) { this.m.set(k, { body: String(v), opts }); }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) { return { objects: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; }
}
const health = async () => { const r = await get("/health"); return { status: r.status, body: await r.json() }; };

test("/health is 503 until the hourly run has run, then 200", async () => {
  let h = await health();
  assert.equal(h.status, 503);
  assert.deepEqual(h.body.problems, ["no hourly run recorded yet"]);
  const now = Date.now();
  await hourly(env, now);
  h = await health();
  assert.equal(h.status, 200);
  assert.equal(h.body.ok, true);
  assert.equal(sent.length, 0, "a clean run sends no alert");
});

test("/health goes 503 when the hourly run is late", async () => {
  await hourly(env, Date.now() - 3 * 3600000);
  const h = await health();
  assert.equal(h.status, 503);
  assert.deepEqual(h.body.problems, ["hourly run is late"]);
});

test("a follow-up Resend refuses: alert to NOTIFY_TO, retried next hour, /health 503", async () => {
  const { acct } = await readyAccount();
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push(body);
    return new Response("{}", { status: body.to[0] === "jane@ex.test" ? 500 : 200 });
  };
  const totals = await hourly(env, TUE_10AM);
  assert.equal(totals.sendFailures, 1);
  const alerts = sent.filter((m) => m.to[0] === "hello@neonkey.tech");
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].subject, /URGENT.*Follow-Up Desk problem/);
  assert.match(alerts[0].text, /1 email\(s\) not sent/);
  assert.match(alerts[0].text, new RegExp(acct.id));
  assert.ok(!alerts[0].text.includes("jane@ex.test"), "alert names the account, not the customer's client");
  const after = await getAccount(env, acct.id);
  assert.equal(after.items[0].step || 0, 0, "not counted as sent, so it retries");
  // Read /health a minute after that run, not at the real clock: the run is pinned to TUE_10AM, so once the real
  // time is 2+ hours past it, "hourly run is late" would also show (this test went red on Nov 11 2026 that way).
  const realNow = Date.now;
  Date.now = () => TUE_10AM + 60000;
  try {
    const h = await health();
    assert.equal(h.status, 503);
    assert.deepEqual(h.body.problems, ["last hourly run had failures"]);
  } finally {
    Date.now = realNow;
  }
});

test("a request that throws alerts NOTIFY_TO without the private link in it", async () => {
  const { link } = await readyAccount();
  env.DESK.get = async () => { throw new Error("KV down"); };
  const r = await get(link);
  assert.equal(r.status, 500);
  const a = sent.find((m) => m.to[0] === "hello@neonkey.tech");
  assert.ok(a);
  assert.match(a.text, /GET \/d\/<link> failed/);
  assert.match(a.text, /KV down/);
  assert.ok(!a.text.includes(link.slice(3)), "token not in the alert");
});

test("nightly backup: every key except ops:, in wrangler bulk format, old copies pruned", async () => {
  env.BACKUP = new R2();
  const { id } = await readyAccount();
  await env.BACKUP.put("desk/2026-10-01.json", "[]");
  await env.BACKUP.put("desk/2026-11-04.json", "[]");
  const at = Date.UTC(2026, 10, 10, BACKUP_HOUR_UTC, 5);
  await hourly(env, at);
  const obj = env.BACKUP.m.get("desk/2026-11-10.json");
  assert.ok(obj, "tonight's backup written");
  const entries = JSON.parse(obj.body);
  const keys = entries.map((e) => e.key);
  assert.ok(keys.includes(`acct:${id}`));
  assert.ok(keys.includes("email:owner@roofing.test"));
  assert.ok(keys.some((k) => k.startsWith("tok:")));
  assert.ok(!keys.some((k) => k.startsWith("ops:")));
  assert.ok(entries.every((e) => typeof e.value === "string"));
  assert.equal(JSON.parse(entries.find((e) => e.key === `acct:${id}`).value).id, id);
  assert.ok(!env.BACKUP.m.has("desk/2026-10-01.json"), "older than 7 days removed");
  assert.ok(env.BACKUP.m.has("desk/2026-11-04.json"), "6 days old kept");
  const b = await env.DESK.get("ops:lastBackup", "json");
  assert.equal(b.keys, entries.length);
});

test("no backup outside the backup hour, and /health flags a missing backup", async () => {
  env.BACKUP = new R2();
  const now = Date.now();
  const hour = new Date(now).getUTCHours();
  await hourly(env, hour === BACKUP_HOUR_UTC ? now - 3600000 : now);
  if (hour !== BACKUP_HOUR_UTC) assert.equal(env.BACKUP.m.size, 0);
  const h = await health();
  assert.ok(h.body.problems.includes("nightly backup is late"));
  await backup(env, now);
  const h2 = await health();
  assert.ok(!h2.body.problems.includes("nightly backup is late"));
});

// ---- one-tap buttons, payment link, trial nudges ----
test("follow-ups carry Yes / Question buttons, plus Pay when a payment link is set; invoices get no Yes", async () => {
  const { acct, link } = await readyAccount();
  await runAccount(env, acct, TUE_10AM);
  const m = sent[0];
  const item = acct.items[0];
  assert.ok(m.html.includes(`https://desk.example/a/${acct.id}/${item.id}/yes`));
  assert.ok(m.html.includes(`/a/${acct.id}/${item.id}/ask`));
  assert.match(m.text, /Yes, let's go ahead: https:\/\/desk\.example\/a\//);
  assert.doesNotMatch(m.html, /Pay the deposit/);

  let r = await post(`${link}/settings`, { business: "Smith Roofing", replyTo: "pat@roofing.test", signoff: "Pat", timezone: "America/Chicago", d0: "3", d1: "7", d2: "14", buttons: "1", payUrl: "javascript:alert(1)" });
  assert.match(r.headers.get("Location"), /settings\?m=badpay/);
  r = await post(`${link}/settings`, { business: "Smith Roofing", replyTo: "pat@roofing.test", signoff: "Pat", timezone: "America/Chicago", d0: "3", d1: "7", d2: "14", buttons: "1", payUrl: "https://buy.stripe.com/test_abc" });
  assert.match(r.headers.get("Location"), /settings\?m=saved/);
  const { followUpEmail: fue } = await import("../src/mail.js");
  const { actionUrls } = await import("../src/mail.js");
  const a2 = await getAccount(env, acct.id);
  const est = fue({ ...a2.items[0], step: 1 }, a2.settings, "https://u", actionUrls(env, a2, a2.items[0]));
  assert.match(est.html, /Pay the deposit/);
  assert.ok(est.html.includes('href="https://buy.stripe.com/test_abc"'));
  const inv = fue({ ...a2.items[0], kind: "invoice", step: 0 }, a2.settings, "https://u", actionUrls(env, a2, a2.items[0]));
  assert.doesNotMatch(inv.html, /go ahead/);
  assert.match(inv.html, /Pay the invoice/);
  assert.match(inv.html, /I have a question/);

  // Buttons off: none at all (the payment link still shows).
  await post(`${link}/settings`, { business: "Smith Roofing", replyTo: "pat@roofing.test", signoff: "Pat", timezone: "America/Chicago", d0: "3", d1: "7", d2: "14", payUrl: "https://buy.stripe.com/test_abc" });
  const a3 = await getAccount(env, acct.id);
  const off = fue({ ...a3.items[0], step: 1 }, a3.settings, "https://u", actionUrls(env, a3, a3.items[0]));
  assert.doesNotMatch(off.html, /\/a\//);
  assert.match(off.html, /Pay the deposit/);
});

test("Yes button: GET only shows a form; POST tells the owner (Reply goes to the customer) and stops follow-ups", async () => {
  const { acct } = await readyAccount();
  const item = acct.items[0];
  const path = `/a/${acct.id}/${item.id}/yes`;
  const page = await get(path);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Yes, let&#39;s go ahead|Yes, let's go ahead/);
  assert.equal((await getAccount(env, acct.id)).items[0].status, "open", "a link scanner opening the link changes nothing");
  assert.equal(sent.length, 0);

  const r = await post(path, { note: "Can you start <b>Monday</b>?", phone: "555-0100 <x>" });
  assert.match(await r.text(), /it's sent/);
  const after = await getAccount(env, acct.id);
  assert.equal(after.items[0].status, "replied");
  assert.ok(await env.DESK.get(`stop:${acct.id}:${item.id}`));
  assert.equal(sent.length, 1);
  const m = sent[0];
  assert.deepEqual(m.to, ["pat@roofing.test"]);
  assert.equal(m.reply_to, "jane@ex.test");
  assert.equal(m.bcc, undefined);
  assert.match(m.subject, /Good news: Jane Smith wants to go ahead with the deck/);
  assert.ok(m.html.includes("&lt;b&gt;Monday&lt;/b&gt;"), "customer text is escaped");
  assert.match(m.text, /Phone: 555-0100/);
  assert.doesNotMatch(m.text, /<x>/);

  // A second tap within 10 minutes doesn't email the owner again.
  await post(path, { note: "again" });
  assert.equal(sent.length, 1);
});

test("Question button needs a question; unknown links 404; invoices have no Yes page", async () => {
  const { acct } = await readyAccount();
  const item = acct.items[0];
  let r = await post(`/a/${acct.id}/${item.id}/ask`, { note: "  " });
  assert.match(await r.text(), /Please type your question/);
  assert.equal(sent.length, 0);
  r = await post(`/a/${acct.id}/${item.id}/ask`, { note: "Does that include permits?" });
  assert.match(await r.text(), /it's sent/);
  assert.match(sent[0].subject, /^Question: Jane Smith has a question about the deck/);
  assert.equal((await get(`/a/${acct.id}/zzzzzzzzz/yes`)).status, 404);
  assert.equal((await get(`/a/zzzzzzzzzzzz/${item.id}/yes`)).status, 404);
  const a = await getAccount(env, acct.id);
  a.items[0].kind = "invoice";
  await env.DESK.put(`acct:${a.id}`, JSON.stringify(a));
  assert.equal((await get(`/a/${acct.id}/${item.id}/yes`)).status, 404);
});

test("preview buttons work without touching any real job", async () => {
  const { acct } = await readyAccount();
  const r = await post(`/a/${acct.id}/test/yes`, { note: "hi" });
  assert.match(await r.text(), /it's sent/);
  assert.match(sent[0].subject, /^\[Preview\] Good news/);
  assert.equal((await getAccount(env, acct.id)).items[0].status, "open");
});

test("trial nudges: day 1, 3 and 10, only while empty, only in daytime, never stacked", async () => {
  const { id } = await signup();
  sent = [];
  let acct = await getAccount(env, id);
  const start = TUE_10AM;
  acct.created = start;
  await env.DESK.put(`acct:${id}`, JSON.stringify(acct));
  // Day 0: nothing.
  await runAccount(env, await getAccount(env, id), start + 3600000);
  assert.equal(sent.length, 0);
  // Day 1 at 3 AM Central: too early.
  await runAccount(env, await getAccount(env, id), start + DAY - 7 * 3600000);
  assert.equal(sent.length, 0);
  // Day 1 at 10 AM: nudge 1, with a working dashboard link.
  await runAccount(env, await getAccount(env, id), start + DAY);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /Add your first estimate/);
  assert.match(sent[0].text, /Finish setup|https:\/\/desk\.example\/d\//);
  assert.deepEqual(sent[0].to, ["owner@roofing.test"]);
  // Same day again: nothing new.
  await runAccount(env, await getAccount(env, id), start + DAY + 3600000);
  assert.equal(sent.length, 1);
  // Day 12 (missed day 3): only one email, the day-10 one.
  await runAccount(env, await getAccount(env, id), start + 12 * DAY);
  assert.equal(sent.length, 2);
  assert.match(sent[1].subject, /Still want help/);
  await runAccount(env, await getAccount(env, id), start + 13 * DAY);
  assert.equal(sent.length, 2);
});

test("no trial nudges once a follow-up has been added", async () => {
  const { acct } = await readyAccount();
  const a = await getAccount(env, acct.id);
  a.created = TUE_10AM - 2 * DAY;
  await env.DESK.put(`acct:${a.id}`, JSON.stringify(a));
  await runAccount(env, await getAccount(env, a.id), TUE_10AM - 4 * 3600000); // 6 AM: outside the send window, inside nothing
  await runAccount(env, await getAccount(env, a.id), TUE_10AM + 6 * 3600000); // 4 PM: no sends due, nudge hours
  assert.ok(sent.every((m) => !/estimate \(2 minutes\)|waiting on\?|help with follow-ups/.test(m.subject)));
});
