// Run: npm test. Verified purchase tracking (src/analytics.js). No network: fetch is passed in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRef, purchaseFor, ga4Body, umamiBody, reportPurchase } from "../src/analytics.js";

const session = (o = {}, extra = {}) => ({
  id: "evt_1", type: "checkout.session.completed", livemode: true,
  data: { object: { object: "checkout.session", id: "cs_live_abc", mode: "payment", payment_status: "paid", amount_total: 2900, currency: "usd",
    client_reference_id: "nk1_smb_email-auth-29_home-offers_google_g123456789-1700000000", customer_details: { email: "buyer@example.com", name: "Pat Buyer" }, ...o } },
  ...extra,
});

test("parseRef reads lane, sku, location, src and the GA client id", () => {
  assert.deepEqual(parseRef("nk1_smb_email-auth-29_home-offers_google_g123456789-1700000000"),
    { lane: "smb", sku: "email-auth-29", location: "home-offers", src: "google", gaClientId: "123456789.1700000000" });
  assert.deepEqual(parseRef("nk1_smb_desk-250m_header"), { lane: "smb", sku: "desk-250m", location: "header", src: "", gaClientId: "" });
  assert.deepEqual(parseRef("not ours"), {});
  assert.deepEqual(parseRef(undefined), {});
});

test("a paid live checkout is a purchase with the session id as transaction id", () => {
  const p = purchaseFor(session());
  assert.equal(p.kind, "purchase");
  assert.equal(p.transactionId, "cs_live_abc");
  assert.equal(p.value, 29);
  assert.equal(p.currency, "USD");
  assert.equal(p.gaClientId, "123456789.1700000000");
  assert.equal(p.attributed, true);
});

test("a free-trial subscription checkout is trial_started with value 0", () => {
  const p = purchaseFor(session({ mode: "subscription", payment_status: "no_payment_required", amount_total: 0, client_reference_id: "nk1_smb_desk-founding-99m_home-offers" }));
  assert.equal(p.kind, "trial");
  assert.equal(p.value, 0);
  assert.equal(p.attributed, false);
  assert.match(p.gaClientId, /^\d+\.\d+$/);
  assert.equal(ga4Body(p).events[0].name, "trial_started");
});

test("nothing is reported for test mode, unpaid, or other event types", () => {
  assert.equal(purchaseFor(session({}, { livemode: false })), null);
  assert.equal(purchaseFor(session({ payment_status: "unpaid" })), null);
  assert.equal(purchaseFor(session({}, { type: "invoice.paid" })), null);
  assert.equal(purchaseFor(session({ object: "invoice" })), null);
});

test("no personal data leaves the Worker", () => {
  const p = purchaseFor(session());
  const all = JSON.stringify([ga4Body(p), umamiBody(p)]);
  assert.ok(!all.includes("buyer@example.com"));
  assert.ok(!all.includes("Pat Buyer"));
});

test("reportPurchase sends GA4 and Umami, and skips GA4 without the secret", async () => {
  const calls = [];
  const ok = async (url, init) => { calls.push({ url, body: JSON.parse(init.body), headers: init.headers }); return new Response(null, { status: 204 }); };
  let out = await reportPurchase({ GA4_API_SECRET: "unit_test_secret" }, session(), ok);
  assert.deepEqual(out, { ga4: "sent", umami: "sent" });
  const ga = calls.find((c) => c.url.startsWith("https://www.google-analytics.com/mp/collect"));
  assert.ok(ga.url.includes("measurement_id=G-425106TVS2"));
  assert.equal(ga.body.events[0].name, "purchase");
  assert.equal(ga.body.events[0].params.transaction_id, "cs_live_abc");
  const um = calls.find((c) => c.url === "https://cloud.umami.is/api/send");
  assert.equal(um.body.payload.name, "checkout_completed");
  assert.match(um.headers["User-Agent"], /^Mozilla\/5\.0/);

  calls.length = 0;
  out = await reportPurchase({}, session(), ok);
  assert.deepEqual(out, { ga4: "skipped", umami: "sent" });
  assert.equal(calls.length, 1);
});

test("reportPurchase never throws when the network fails", async () => {
  const boom = async () => { throw new Error("down"); };
  const out = await reportPurchase({ GA4_API_SECRET: "x" }, session(), boom);
  assert.deepEqual(out, { ga4: "failed", umami: "failed" });
});
