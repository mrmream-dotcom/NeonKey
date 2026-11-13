// Run: npm test. Synthetic fixture DNS only, no network, no keys, nothing sent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { baseline, snapshot, diff, confirmed, step, acknowledge, counted, fixtureResolver, ownershipRecord, verifyOwnership, renderAlert } from "../src/engine.mjs";
import { DOMAIN, healthy, timeline } from "../fixtures/timeline.mjs";

const ids = (alerts) => alerts.map((a) => `${a.severity}:${a.id}`);

test("baseline reuses the Lockdown audit: finds provider, DNS host and both DKIM selectors", async () => {
  const b = await baseline(DOMAIN, { resolve: fixtureResolver(healthy()) });
  assert.equal(b.provider.label, "Google Workspace");
  assert.equal(b.dnsHost.label, "Cloudflare");
  assert.equal(b.locked, true);
  assert.deepEqual(b.selectors.sort(), ["google", "resend"]);
  assert.equal(b.snapshot.spf.lookups, 2);
  assert.equal(b.snapshot.dmarc.policy, "quarantine");
});

test("daily snapshot stays far under the Worker subrequest budget", async () => {
  const full = counted(fixtureResolver(healthy()));
  await baseline(DOMAIN, { resolve: full });
  const daily = counted(fixtureResolver(healthy()));
  await snapshot(DOMAIN, { resolve: daily, selectors: ["google", "resend"] });
  assert.ok(full.calls > 40, `full audit uses ${full.calls} lookups`);
  assert.ok(daily.calls <= 12, `daily snapshot uses ${daily.calls} lookups`);
});

test("no change, no alert", async () => {
  const r = fixtureResolver(healthy());
  const a = await snapshot(DOMAIN, { resolve: r, selectors: ["google", "resend"] });
  const b = await snapshot(DOMAIN, { resolve: r, selectors: ["google", "resend"] });
  assert.deepEqual(diff(a, b), []);
});

test("synthetic drift timeline raises the right alert each day", async () => {
  const days = timeline();
  const sel = ["google", "resend"];
  const snaps = [];
  for (const d of days) snaps.push(await snapshot(DOMAIN, { resolve: fixtureResolver(d.zone), selectors: sel }));
  const got = snaps.slice(1).map((s, i) => ids(diff(snaps[i], s)));
  assert.deepEqual(got, [
    ["info:spf-senders"],
    ["critical:dmarc-gone"],
    [], // DMARC came back (count 0 -> 1): not an alert by itself; the weaker policy is caught against the last good state below
    ["warning:dkim-gone"],
    ["warning:ns-changed"],
    ["critical:spf-loosened"],
  ]);
  // Against the last known-good state, day 3 is a weaker DMARC with reports off.
  assert.deepEqual(ids(diff(snaps[1], snaps[3])), ["warning:dmarc-policy", "info:dmarc-reports"]);
});

test("losing the only DKIM key is critical", async () => {
  const z = healthy();
  delete z[`google._domainkey.${DOMAIN}`];
  const a = await snapshot(DOMAIN, { resolve: fixtureResolver(healthy()), selectors: ["google"] });
  const b = await snapshot(DOMAIN, { resolve: fixtureResolver(z), selectors: ["google"] });
  assert.deepEqual(ids(diff(a, b)), ["critical:dkim-gone"]);
});

test("a one-off blip is not confirmed, a real change is", async () => {
  const sel = ["google", "resend"];
  const good = await snapshot(DOMAIN, { resolve: fixtureResolver(healthy()), selectors: sel });
  const broken = healthy(); delete broken[`_dmarc.${DOMAIN}`];
  const blip = await snapshot(DOMAIN, { resolve: fixtureResolver(broken), selectors: sel });
  assert.deepEqual(confirmed(good, blip, good), []);
  assert.deepEqual(ids(confirmed(good, blip, blip)), ["critical:dmarc-gone"]);
});

test("domain that stops existing is one critical alert", async () => {
  const a = await snapshot(DOMAIN, { resolve: fixtureResolver(healthy()) });
  const b = await snapshot(DOMAIN, { resolve: fixtureResolver({}, new Set([DOMAIN])) });
  assert.deepEqual(ids(diff(a, b)), ["critical:domain-gone"]);
});

test("ownership proof: right TXT passes, missing or other account's token fails", async () => {
  const rec = await ownershipRecord("acct_1", DOMAIN, "test-secret");
  assert.equal(rec.host, `_neonkey-watchdog.${DOMAIN}`);
  assert.match(rec.value, /^neonkey-watchdog=[0-9a-f]{32}$/);
  const zone = { [rec.host]: { TXT: [`"${rec.value}"`] } };
  assert.equal(await verifyOwnership("acct_1", DOMAIN, "test-secret", fixtureResolver(zone)), true);
  assert.equal(await verifyOwnership("acct_2", DOMAIN, "test-secret", fixtureResolver(zone)), false);
  assert.equal(await verifyOwnership("acct_1", DOMAIN, "test-secret", fixtureResolver({})), false);
});

test("personal mailbox domains are refused at baseline", async () => {
  await assert.rejects(baseline("gmail.com", { resolve: fixtureResolver({}) }), /personal mailbox/);
});

test("alert email text leads with the worst news and says nothing was sent", async () => {
  const days = timeline();
  const a = await snapshot(DOMAIN, { resolve: fixtureResolver(days[1].zone), selectors: ["google"] });
  const b = await snapshot(DOMAIN, { resolve: fixtureResolver(days[2].zone), selectors: ["google"] });
  const text = renderAlert(DOMAIN, diff(a, b));
  assert.match(text, /^Something broke on launchpad\.test/);
  assert.match(text, /\[CRITICAL\] Your DMARC record was removed/);
  assert.match(text, /nothing was sent/);
  assert.equal(renderAlert(DOMAIN, []), null);
});

test("stateful step catches a record put back weaker, and reports each problem once", async () => {
  const days = timeline();
  const sel = ["google", "resend"];
  const snaps = [];
  for (const d of days) snaps.push(await snapshot(DOMAIN, { resolve: fixtureResolver(d.zone), selectors: sel }));
  let state = { last: snaps[0], good: snaps[0], open: [] };
  const got = [];
  for (const s of snaps.slice(1)) { const r = step(state, s); got.push(ids(r.alerts)); state = r.state; }
  assert.deepEqual(got, [
    ["info:spf-senders"],
    ["critical:dmarc-gone"],
    ["warning:dmarc-policy"],
    ["warning:dkim-gone"],
    ["warning:ns-changed"],
    ["critical:spf-loosened"],
  ]);
  // "I meant to do this": the current setup becomes the reference and nothing stays open.
  const acked = acknowledge(state);
  assert.deepEqual(step(acked, snaps[6]).alerts, []);
});

test("problem fixed: good state moves forward, nothing stays open", async () => {
  const sel = ["google"];
  const ok = await snapshot(DOMAIN, { resolve: fixtureResolver(healthy()), selectors: sel });
  const broken = healthy(); delete broken[`_dmarc.${DOMAIN}`];
  const bad = await snapshot(DOMAIN, { resolve: fixtureResolver(broken), selectors: sel });
  let r = step({ last: ok, good: ok, open: [] }, bad);
  assert.deepEqual(r.state.open, ["dmarc-gone"]);
  r = step(r.state, ok);
  assert.deepEqual(r.state.open, []);
  assert.equal(r.state.good, ok);
});
