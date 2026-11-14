// Run: npm test. Uses fake secrets and a stubbed Resend; no network, no real keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import worker from "../src/index.js";
import { describeEvent, productName } from "../src/events.js";
import { readFileSync } from "node:fs";

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

// Founder Stack auto-delivery
const PDF = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]); // "%PDF-1.7"
const kv = (bytes) => ({ get: async (key, type) => (key === "founder-stack/the-founder-stack-neonkey.pdf" && type === "arrayBuffer" && bytes ? bytes.buffer : null) });
const fsEnv = { ...env, FOUNDER_STACK_LINK: "plink_fs", PRODUCTS: kv(PDF) };
const fsSession = (extra = {}) => ({ id: "cs_test_1", mode: "payment", payment_status: "paid", amount_total: 9700, currency: "usd", invoice: "in_9", payment_link: "plink_fs", metadata: { offer: "nk_founder_stack_guide" }, customer_details: { email: "founder@example.com", name: "Ada Lovelace" }, custom_fields: [{ key: "domain", text: { value: "https://www.Example.com/" } }], ...extra });

test("paid Founder Stack checkout emails the buyer the PDF, BCC, idempotent, with the Lockdown domain", async () => {
  sent = [];
  const r = await worker.fetch(signed(ev("checkout.session.completed", fsSession())), fsEnv);
  assert.equal(r.status, 200);
  assert.equal(sent.length, 1);
  const b = sent[0].body;
  assert.deepEqual(b.to, ["founder@example.com"]);
  assert.deepEqual(b.bcc, ["bcc@example.com"]);
  assert.equal(b.from, env.FROM_ADDRESS);
  assert.equal(b.reply_to, "hello@neonkey.tech");
  assert.equal(sent[0].headers["Idempotency-Key"], "founder-stack-cs_test_1");
  assert.equal(b.attachments[0].filename, "The-Founder-Stack-NeonKey.pdf");
  assert.equal(Buffer.from(b.attachments[0].content, "base64").toString(), "%PDF-1.7");
  assert.match(b.text, /Hi Ada,/);
  assert.match(b.text, /your domain, example\.com,/);
  assert.match(b.subject, /^\[TEST\] Your copy of The Founder Stack/);
});

test("Founder Stack matched by Payment Link id alone; no domain asks for a reply", async () => {
  sent = [];
  await worker.fetch(signed(ev("checkout.session.completed", fsSession({ metadata: {}, custom_fields: [] }))), fsEnv);
  assert.equal(sent.length, 1);
  assert.match(sent[0].body.text, /Reply to this email with the domain/);
});

test("names and domains are escaped or rejected in the email", async () => {
  sent = [];
  await worker.fetch(signed(ev("checkout.session.completed", fsSession({ customer_details: { email: "a@example.com", name: "<b>x</b>" }, custom_fields: [{ key: "domain", text: { value: "<script>alert(1)</script>" } }] }))), fsEnv);
  const h = sent[0].body.html.toLowerCase();
  assert.ok(!h.includes("<b>x</b>") && !h.includes("<script") && !h.includes("alert(1)"));
  assert.ok(h.includes("&lt;b&gt;x&lt;/b&gt;"));
  assert.match(sent[0].body.text, /Reply to this email with the domain/);
});

test("unpaid Founder Stack checkout sends nothing until async_payment_succeeded", async () => {
  sent = [];
  await worker.fetch(signed(ev("checkout.session.completed", fsSession({ payment_status: "unpaid" }))), fsEnv);
  assert.equal(sent.length, 0);
  await worker.fetch(signed(ev("checkout.session.async_payment_succeeded", fsSession())), fsEnv);
  assert.equal(sent.length, 1);
});

test("other checkouts never get the guide", async () => {
  sent = [];
  await worker.fetch(signed(ev("checkout.session.completed", fsSession({ payment_link: "plink_other", metadata: { offer: "email_lockdown" }, invoice: null, amount_total: 4900 }))), fsEnv);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].body.to, ["hello@neonkey.tech"]);
  assert.equal(sent[0].body.attachments, undefined);
});

test("missing PDF returns 500 so Stripe retries, and sends nothing", async () => {
  sent = [];
  const r = await worker.fetch(signed(ev("checkout.session.completed", fsSession())), { ...fsEnv, PRODUCTS: kv(null) });
  assert.equal(r.status, 500);
  assert.equal(sent.length, 0);
});

test("Resend failure returns 500 so Stripe retries", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response("no", { status: 500 });
  const r = await worker.fetch(signed(ev("checkout.session.completed", fsSession())), fsEnv);
  globalThis.fetch = real;
  assert.equal(r.status, 500);
});

test("no buyer email alerts hello@ instead of retrying", async () => {
  sent = [];
  const r = await worker.fetch(signed(ev("checkout.session.completed", fsSession({ customer_details: {} }))), fsEnv);
  assert.equal(r.status, 200);
  assert.deepEqual(sent[0].body.to, ["hello@neonkey.tech"]);
  assert.match(sent[0].body.subject, /ACTION NEEDED/);
});

test("the Worker has no route that serves the PDF", async () => {
  for (const p of ["/", "/founder-stack/the-founder-stack-neonkey.pdf", "/download", "/webhook"]) {
    const r = await worker.fetch(new Request("https://w.example" + p), fsEnv);
    assert.ok([404, 405].includes(r.status), p);
  }
});

// Product names in notices (05-conversion-tracking-spec A7): this endpoint also gets Follow-Up Desk (and Watchdog)
// events, so nothing is called a "support plan" unless Stripe says it is one.

const subObj = (price, metadata = {}) => ({ id: "sub_1", status: "trialing", customer: "cus_1", start_date: 1800000000, metadata, items: { data: [{ price }] } });

test("new Follow-Up Desk subscription is named from metadata.offer, not 'support plan'", () => {
  const n = describeEvent(ev("customer.subscription.created", subObj({ id: "price_x" }, { offer: "nk_follow_up_desk", plan: "founding-monthly" })));
  assert.equal(n.subject, "New Follow-Up Desk subscription");
  assert.doesNotMatch(JSON.stringify(n), /support plan/i);
  assert.match(n.next, /dashboard link/);
});

test("Support Plan subscription keeps its welcome-note next step", () => {
  const n = describeEvent(ev("customer.subscription.created", subObj({ id: "price_sp", lookup_key: "nk_support_plan_monthly" })));
  assert.equal(n.subject, "New Support Plan subscription");
  assert.match(n.next, /welcome note/);
});

test("unknown subscription is just 'New subscription'", () => {
  const n = describeEvent(ev("customer.subscription.created", subObj({ id: "price_q" })));
  assert.equal(n.subject, "New subscription");
  assert.doesNotMatch(JSON.stringify(n), /support plan/i);
});

test("Watchdog cancel and past-due notices use the product name", () => {
  const o = { ...subObj({ id: "p", nickname: "Founder Watchdog monthly" }), cancel_at_period_end: true, cancel_at: 1800000000 };
  assert.equal(describeEvent(ev("customer.subscription.updated", o, { data: { object: o, previous_attributes: { cancel_at_period_end: false } } })).subject, "Founder Watchdog set to cancel");
  const pd = { ...subObj({ id: "p", nickname: "Founder Watchdog monthly" }), status: "past_due" };
  const n = describeEvent(ev("customer.subscription.updated", pd, { data: { object: pd, previous_attributes: { status: "active" } } }));
  assert.equal(n.subject, "Founder Watchdog past due");
  assert.equal(n.headline, "A Founder Watchdog payment is past due");
  assert.equal(describeEvent(ev("customer.subscription.deleted", subObj({ id: "p" }))).subject, "Subscription canceled");
});

test("first Desk invoice is 'first Follow-Up Desk payment' (from subscription metadata or line text)", () => {
  const viaMeta = describeEvent(ev("invoice.paid", { id: "in_d", amount_paid: 9900, currency: "usd", customer_email: "o@example.com", billing_reason: "subscription_create", parent: { subscription_details: { metadata: { offer: "follow-up-desk" } } } }));
  assert.equal(viaMeta.headline, "Paid: $99.00 (first Follow-Up Desk payment)");
  assert.match(viaMeta.subject, /^Invoice paid: \$99\.00 for Follow-Up Desk from o@example\.com$/);
  const viaLine = describeEvent(ev("invoice.paid", { id: "in_e", amount_paid: 25000, currency: "usd", billing_reason: "subscription_cycle", lines: { data: [{ description: "1 × Follow-Up Desk (at $250.00 / month)" }] } }));
  assert.equal(viaLine.headline, "Paid: $250.00 (Follow-Up Desk renewal)");
  const unknown = describeEvent(ev("invoice.paid", { id: "in_f", amount_paid: 100, currency: "usd", billing_reason: "subscription_create" }));
  assert.equal(unknown.headline, "Paid: $1.00 (first subscription payment)");
});

test("the Lead-Routing & Follow-Up System is not mistaken for the Follow-Up Desk", () => {
  assert.equal(productName({ lines: { data: [{ description: "Lead-Routing & Follow-Up System" }] } }), "");
  assert.equal(productName({ metadata: { offer: "nk_email_lockdown" } }), "Email Authentication Setup");
});

test("one-time checkout subject names the offer from metadata", () => {
  const n = describeEvent(ev("checkout.session.completed", { mode: "payment", payment_status: "paid", amount_total: 2900, currency: "usd", metadata: { offer: "nk_email_lockdown" }, customer_details: { email: "a@example.com" } }));
  assert.equal(n.subject, "Payment received: $29.00 for Email Authentication Setup from a@example.com");
});

test("wrangler.toml FOUNDER_STACK_LINK is the current $29 link listed in src/data/services.ts", () => {
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  const link = (toml.match(/^FOUNDER_STACK_LINK = "([^"]+)"/m) || [])[1];
  assert.equal(link, "plink_1UajXgCRxS1tvAi2Esh56b8q");
  const services = readFileSync(new URL("../../../src/data/services.ts", import.meta.url), "utf8");
  const guide = services.slice(services.indexOf("export const setupGuide"), services.indexOf("export const lockdownFlashSale"));
  assert.ok(guide.includes(link), "setupGuide in services.ts should name the same Payment Link");
});
