// Run: npm test. Uses fake secrets and a stubbed Resend; no network, no real keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import worker from "../src/index.js";

const SECRET = "whsec_unit_test_only";
const env = { STRIPE_WEBHOOK_SECRET: SECRET, RESEND_API_KEY: "re_fake", FROM_ADDRESS: "NeonKey 🔑 <hello@neonkey.tech>", NOTIFY_TO: "hello@neonkey.tech", BCC_ADDRESS: "bcc@example.com", ALLOW_LIVE: "false" };

let sent = [];
globalThis.fetch = async (url, init) => {
  sent.push({ url, body: JSON.parse(init.body), headers: init.headers });
  return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
};

function signed(event, secret = SECRET) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("https://w.example/webhook", { method: "POST", headers: { "Stripe-Signature": header, "Content-Type": "application/json" }, body: payload });
}
const ev = (type, object, extra = {}) => ({ id: `evt_${type.replace(/\W/g, "_")}`, object: "event", type, livemode: false, data: { object }, ...extra });

test("rejects a bad signature and sends nothing", async () => {
  sent = [];
  const r = await worker.fetch(signed(ev("invoice.paid", { amount_paid: 100 }), "whsec_wrong"), env);
  assert.equal(r.status, 400);
  assert.equal(sent.length, 0);
});

test("rejects a missing signature", async () => {
  const r = await worker.fetch(new Request("https://w.example/webhook", { method: "POST", body: "{}" }), env);
  assert.equal(r.status, 400);
});

test("invoice.paid emails hello@ with BCC, From NeonKey, test tag and idempotency key", async () => {
  sent = [];
  const r = await worker.fetch(signed(ev("invoice.paid", { id: "in_1", amount_paid: 24900, currency: "usd", customer_email: "owner@example.com", number: "NK-0001", billing_reason: "manual", lines: { data: [{ description: "Office Tech Tune-Up" }] } })), env);
  assert.equal(r.status, 200);
  assert.equal(sent.length, 1);
  const b = sent[0].body;
  assert.equal(b.from, env.FROM_ADDRESS);
  assert.deepEqual(b.to, ["hello@neonkey.tech"]);
  assert.deepEqual(b.bcc, ["bcc@example.com"]);
  assert.match(b.subject, /^\[TEST\] Invoice paid: \$249\.00/);
  assert.equal(b.reply_to, "owner@example.com");
  assert.equal(sent[0].headers["Idempotency-Key"], "stripe-evt_invoice_paid");
  assert.match(b.html, /dashboard\.stripe\.com\/test\/invoices\/in_1/);
});

test("subscription checkout completion is left to invoice.paid (no double notice)", async () => {
  sent = [];
  const r = await worker.fetch(signed(ev("checkout.session.completed", { mode: "subscription", payment_status: "paid", amount_total: 9900 })), env);
  assert.equal(r.status, 200);
  assert.equal(sent.length, 0);
});

test("unpaid checkout (delayed method) waits for async_payment_succeeded", async () => {
  sent = [];
  await worker.fetch(signed(ev("checkout.session.completed", { mode: "payment", payment_status: "unpaid", amount_total: 4900 })), env);
  assert.equal(sent.length, 0);
  await worker.fetch(signed(ev("checkout.session.async_payment_succeeded", { mode: "payment", payment_status: "paid", amount_total: 4900, customer_details: { email: "a@example.com" } })), env);
  assert.equal(sent.length, 1);
  assert.match(sent[0].body.subject, /Payment received: \$49\.00/);
});

test("dispute is flagged as action needed", async () => {
  sent = [];
  await worker.fetch(signed(ev("charge.dispute.created", { id: "dp_1", amount: 9900, currency: "usd", reason: "fraudulent", evidence_details: { due_by: 1800000000 } })), env);
  assert.match(sent[0].body.subject, /^\[TEST\] ACTION NEEDED: payment disputed/);
});

test("live events are ignored while ALLOW_LIVE is off", async () => {
  sent = [];
  const r = await worker.fetch(signed(ev("invoice.paid", { amount_paid: 100 }, { livemode: true })), env);
  assert.equal(r.status, 200);
  assert.equal(sent.length, 0);
});

test("a failed email returns 500 so Stripe retries", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 500 });
  const r = await worker.fetch(signed(ev("invoice.payment_failed", { id: "in_2", amount_due: 9900, currency: "usd" })), env);
  globalThis.fetch = orig;
  assert.equal(r.status, 500);
});

test("other paths 404, GET webhook 405", async () => {
  assert.equal((await worker.fetch(new Request("https://w.example/"), env)).status, 404);
  assert.equal((await worker.fetch(new Request("https://w.example/webhook"), env)).status, 405);
});

test("live events are processed (no [TEST] tag) when ALLOW_LIVE is on", async () => {
  sent = [];
  const r = await worker.fetch(signed(ev("invoice.paid", { id: "in_9", amount_paid: 9900, currency: "usd", customer_email: "c@example.com" }, { livemode: true })), { ...env, ALLOW_LIVE: "true" });
  assert.equal(r.status, 200);
  assert.equal(sent.length, 1);
  assert.match(sent[0].body.subject, /^Invoice paid/);
  assert.match(sent[0].body.html, /dashboard\.stripe\.com\/invoices\/in_9/);
});

test("replayed (old) signatures are rejected", async () => {
  sent = [];
  const payload = JSON.stringify(ev("invoice.paid", { amount_paid: 100 }));
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET, timestamp: Math.floor(Date.now() / 1000) - 3600 });
  const r = await worker.fetch(new Request("https://w.example/webhook", { method: "POST", headers: { "Stripe-Signature": header }, body: payload }), env);
  assert.equal(r.status, 400);
  assert.equal(sent.length, 0);
});

test("HTML in Stripe fields is escaped in the notice", async () => {
  sent = [];
  await worker.fetch(signed(ev("invoice.paid", { id: "in_x", amount_paid: 100, currency: "usd", customer_name: "<img src=x onerror=alert(1)>" })), env);
  assert.doesNotMatch(sent[0].body.html, /<img/);
});
