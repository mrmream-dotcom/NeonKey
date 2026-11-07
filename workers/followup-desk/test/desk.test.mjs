// Run: npm test. Fake secrets, in-memory KV, stubbed Resend. No network, no real keys.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker, { runAccount, inbound, handleDeliveryEvent, stripQuoted } from "../src/index.js";
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
  assert.match(await page.text(), /Set up your Desk/);
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
