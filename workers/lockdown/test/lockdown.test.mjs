// Run: npm test. Fake secrets, fixture DNS, stubbed Resend and KV. No network, no real keys.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker, { recheckAll, dueCheck } from "../src/index.js";
import { audit, cleanDomain, addInclude, joinTxt } from "../src/audit.js";
import { reportEmail } from "../src/email.js";

const SECRET = "whsec_unit_test_only";
const PLINK = "plink_lockdown_test";
const DAY = 86400000;

// ---- fixture DNS (Cloudflare DoH JSON shape) ----
const T = { NS: 2, CNAME: 5, MX: 15, TXT: 16 };
let zone = {};
const q = (s) => `"${s}"`;
function setZones() {
  zone = {
    // Google Workspace, nothing set up yet, GoDaddy DNS
    "bare.test": { MX: ["1 aspmx.l.google.com."], NS: ["ns1.domaincontrol.com."], TXT: [q("google-site-verification=abc")] },
    // Microsoft 365, SPF exists but misses outlook and ends +all, DMARC exists, DKIM on
    "m365.test": { MX: ["0 m365-test.mail.protection.outlook.com."], NS: ["a.ns.cloudflare.com."], TXT: [q("v=spf1 include:servers.mcsv.net +all")] },
    "_dmarc.m365.test": { TXT: [q("v=DMARC1; p=quarantine; rua=mailto:d@m365.test")] },
    "selector1._domainkey.m365.test": { CNAME: ["selector1-m365-test._domainkey.x.onmicrosoft.com."] },
    // Fully done Google domain
    "done.test": { MX: ["1 smtp.google.com."], NS: ["dns1.registrar-servers.com."], TXT: [q("v=spf1 include:_spf.google.com ~all")] },
    "_dmarc.done.test": { TXT: [q("v=DMARC1; p=none")] },
    "google._domainkey.done.test": { TXT: ['"v=DKIM1; k=rsa; p=MIIBIjANBgkq" "hkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA"'] },
    // Two SPF records + Zoho: needs a person
    "messy.test": { MX: ["10 mx.zoho.com."], NS: ["ns1.wixdns.net."], TXT: [q("v=spf1 include:zoho.com ~all"), q("v=spf1 include:sendgrid.net ~all")] },
    // No MX
    "nomail.test": { MX: [], NS: ["ns1.domaincontrol.com."], TXT: [] },
  };
}
const nx = new Set(["typo.test"]);

let sent = [];
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  if (u.hostname === "cloudflare-dns.com") {
    const name = u.searchParams.get("name").replace(/\.$/, "");
    const type = u.searchParams.get("type");
    if (nx.has(name)) return Response.json({ Status: 3, Answer: [] });
    const data = zone[name]?.[type] || [];
    return Response.json({ Status: 0, Answer: data.map((d) => ({ name, type: T[type], data: d })) });
  }
  if (u.hostname === "api.resend.com") {
    sent.push({ body: JSON.parse(init.body), headers: init.headers });
    return Response.json({ id: "email_1" });
  }
  throw new Error(`unexpected fetch ${url}`);
};

function kv() {
  const m = new Map();
  return {
    m,
    async get(k, type) { const v = m.get(k); return v === undefined ? null : type === "json" ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, v); },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
  };
}

let env;
beforeEach(() => {
  setZones();
  sent = [];
  env = { STRIPE_WEBHOOK_SECRET: SECRET, RESEND_API_KEY: "re_fake", FROM_ADDRESS: "NeonKey 🔑 <hello@neonkey.tech>", NOTIFY_TO: "hello@neonkey.tech", REPLY_TO: "hello@neonkey.tech", BCC_ADDRESS: "bcc@example.com", LOCKDOWN_PAYMENT_LINK: PLINK, ALLOW_LIVE: "false", CUSTOMER_EMAILS: "send", ORDERS: kv() };
});

function signed(event, secret = SECRET) {
  const payload = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return new Request("https://w.example/webhook", { method: "POST", headers: { "Stripe-Signature": `t=${t},v1=${sig}` }, body: payload });
}
const session = (domain, extra = {}) => ({ id: `cs_test_${domain.replace(/\W/g, "_")}`, object: "checkout.session", mode: "payment", payment_status: "paid", payment_link: PLINK, amount_total: 4900, customer_details: { email: "Pat@Owner.example", name: "Pat Owner" }, custom_fields: [{ key: "domain", type: "text", text: { value: domain } }], ...extra });
const ev = (obj, type = "checkout.session.completed") => ({ id: `evt_${obj.id}`, object: "event", type, livemode: false, data: { object: obj } });

// ---- engine ----
test("cleanDomain accepts what people type at checkout", () => {
  assert.equal(cleanDomain("https://www.Shop.com/contact"), "shop.com");
  assert.equal(cleanDomain("me@shop.co.uk"), "shop.co.uk");
  assert.equal(cleanDomain(" shop.com. "), "shop.com");
  assert.equal(cleanDomain("not a domain"), null);
  assert.equal(cleanDomain("<script>.com"), null);
});

test("joinTxt glues split TXT chunks", () => {
  assert.equal(joinTxt('"v=spf1 include:a" " ~all"'), "v=spf1 include:a ~all");
});

test("addInclude keeps existing senders and puts the include before all", () => {
  assert.equal(addInclude("v=spf1 include:servers.mcsv.net ~all", "include:spf.protection.outlook.com"), "v=spf1 include:servers.mcsv.net include:spf.protection.outlook.com ~all");
});

test("bare Google domain gets SPF + DMARC records and a DKIM click, with GoDaddy steps", async () => {
  const a = await audit("bare.test", { contactEmail: "pat@bare.test" });
  assert.equal(a.provider.key, "google");
  assert.equal(a.dnsHost.label, "GoDaddy");
  assert.deepEqual(a.fixes.map((f) => [f.id, f.host, f.value]), [["spf", "@", "v=spf1 include:_spf.google.com ~all"], ["dmarc", "_dmarc", "v=DMARC1; p=none"]]);
  assert.deepEqual(a.buyerSteps.map((s) => s.id), ["dkim"]);
  assert.equal(a.human.length, 0);
  assert.equal(a.locked, false);
});

test("DMARC is always monitor mode with no rua, whatever the buyer's email", async () => {
  for (const contactEmail of ["pat@gmail.com", "pat@bare.test"]) {
    const d = (await audit("bare.test", { contactEmail })).fixes.find((f) => f.id === "dmarc");
    assert.equal(d.value, "v=DMARC1; p=none");
    assert.match(d.why, /monitor mode/);
  }
});

test("SPF senders are named for the buyer, and the report shows DKIM as Not verified", async () => {
  const { sendersIn } = await import("../src/audit.js");
  assert.deepEqual(sendersIn("v=spf1 include:servers.mcsv.net include:sendgrid.net ~all"), ["Mailchimp", "SendGrid"]);
  const { renderReport } = await import("../src/report.js");
  const a = await audit("bare.test");
  const html = renderReport({ a, order: { id: "cs_test_abc12345" } });
  assert.match(html, /Not verified/);
  assert.doesNotMatch(html, /10 minutes|stop working| -all\b/);
  assert.match(html, />1\/4<\/div><div class="l">checks<br>passing/);
  assert.doesNotMatch(html, />SAMPLE</);
  const sample = renderReport({ a, order: {}, sample: true });
  assert.match(sample, />SAMPLE</);
  assert.match(sample, /included in your full report/);
});

test("Microsoft 365 SPF is edited in place: outlook added, +all made safe, existing senders kept", async () => {
  const a = await audit("m365.test");
  const spf = a.fixes.find((f) => f.id === "spf");
  assert.equal(spf.action, "replace");
  assert.equal(spf.current, "v=spf1 include:servers.mcsv.net +all");
  assert.equal(spf.value, "v=spf1 include:servers.mcsv.net include:spf.protection.outlook.com ~all");
  assert.equal(a.fixes.some((f) => f.id === "dmarc"), false, "existing DMARC is left alone");
  assert.deepEqual(a.dkim, ["selector1"]);
  assert.equal(a.dnsHost.label, "Cloudflare");
});

test("finished domain reads as locked", async () => {
  const a = await audit("done.test");
  assert.equal(a.locked, true);
  assert.equal(a.fixes.length + a.buyerSteps.length + a.human.length, 0);
});

test("duplicate SPF and an unsupported provider go to a person, no SPF written", async () => {
  const a = await audit("messy.test");
  assert.ok(a.human.some((h) => /Zoho/.test(h)));
  assert.ok(a.human.some((h) => /2 SPF records/.test(h)));
  assert.equal(a.fixes.some((f) => f.id === "spf"), false);
});

test("typo domain, no MX and free-mail domains go straight to a person", async () => {
  assert.match((await audit("typo.test")).human[0], /doesn't exist/);
  assert.match((await audit("nomail.test")).human[0], /no mail server/);
  assert.match((await audit("gmail.com")).human[0], /personal mailbox/);
});

// ---- webhook ----
test("rejects a bad signature and sends nothing", async () => {
  const r = await worker.fetch(signed(ev(session("bare.test")), "whsec_wrong"), env);
  assert.equal(r.status, 400);
  assert.equal(sent.length, 0);
});

test("ignores other Payment Links, unpaid sessions and live events while ALLOW_LIVE is off", async () => {
  for (const e of [ev(session("bare.test", { payment_link: "plink_support" })), ev(session("bare.test", { payment_status: "unpaid" })), { ...ev(session("bare.test")), livemode: true }]) {
    const r = await worker.fetch(signed(e), env);
    assert.equal(r.status, 200);
  }
  assert.equal(sent.length, 0);
});

test("paid Lockdown: buyer gets the branded report, hello@ gets an FYI, all with From + BCC", async () => {
  const r = await worker.fetch(signed(ev(session("https://www.bare.test/"))), env);
  assert.equal(r.status, 200);
  assert.equal(sent.length, 2);
  const [buyer, notice] = sent.map((s) => s.body);
  assert.deepEqual(buyer.to, ["pat@owner.example"]);
  assert.equal(buyer.from, env.FROM_ADDRESS);
  assert.deepEqual(buyer.bcc, ["bcc@example.com"]);
  assert.equal(buyer.reply_to, "hello@neonkey.tech");
  assert.match(buyer.subject, /^\[TEST\] 🔑 Your Email Lockdown report for bare\.test/);
  assert.match(buyer.html, /1 of 4 checks passing/);
  assert.equal(buyer.attachments.length, 1);
  assert.match(buyer.attachments[0].filename, /NeonKey-Email-Report-bare\.test\.html/);
  assert.match(Buffer.from(buyer.attachments[0].content, "base64").toString("utf8"), /Recommended changes/);
  assert.match(buyer.html, /included in your \$49/);
  assert.doesNotMatch(buyer.html + buyer.text, /10 minutes|stop working/);
  assert.match(buyer.html, /v=spf1 include:_spf\.google\.com ~all/);
  assert.match(buyer.html, /godaddy\.com\/help\/add-a-txt-record/);
  assert.match(buyer.html, /Your \$49 counts toward any NeonKey package/);
  assert.match(buyer.text, /from \$250 with your \$49 credit/);
  assert.match(buyer.html, /Hi Pat,/);
  assert.deepEqual(notice.to, ["hello@neonkey.tech"]);
  assert.equal(notice.reply_to, "pat@owner.example");
  assert.match(notice.subject, /^\[TEST\] FYI: Email Lockdown new order · bare\.test/);
  const order = JSON.parse(env.ORDERS.m.get("order:cs_test_https___www_bare_test_"));
  assert.equal(order.status, "open");
  assert.equal(order.domain, "bare.test");
});

test("Stripe retry (same session) sends nothing twice", async () => {
  const e = ev(session("bare.test"));
  await worker.fetch(signed(e), env);
  await worker.fetch(signed(e), env);
  await worker.fetch(signed(ev(session("bare.test"), "checkout.session.async_payment_succeeded")), env);
  assert.equal(sent.length, 2);
});

test("shadow mode sends the buyer's email to hello@ only", async () => {
  env.CUSTOMER_EMAILS = "shadow";
  await worker.fetch(signed(ev(session("bare.test"))), env);
  assert.ok(sent.every((s) => s.body.to[0] === "hello@neonkey.tech"));
  assert.match(sent[0].body.subject, /\[SHADOW for pat@owner\.example\]/);
});

test("anything unsafe to automate is flagged ACTION NEEDED and the buyer gets a holding email", async () => {
  await worker.fetch(signed(ev(session("typo.test"))), env);
  const [buyer, notice] = sent.map((s) => s.body);
  assert.match(buyer.subject, /one quick check/);
  assert.doesNotMatch(buyer.html, /v=spf1/);
  assert.match(notice.subject, /ACTION NEEDED/);
  const order = [...env.ORDERS.m.values()].map((v) => JSON.parse(v))[0];
  assert.equal(order.status, "human");
});

test("an invalid domain at checkout is flagged without a DNS lookup", async () => {
  await worker.fetch(signed(ev(session("not a domain"))), env);
  assert.match(sent[1].body.subject, /ACTION NEEDED/);
});

test("already-done domain: buyer hears it's in good shape, no rechecks queued", async () => {
  await worker.fetch(signed(ev(session("done.test"))), env);
  assert.match(sent[0].body.subject, /records already in place/);
  assert.equal(JSON.parse([...env.ORDERS.m.values()][0]).status, "done");
});

test("DNS outage returns 500 so Stripe retries, and sends nothing", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => (String(url).includes("cloudflare-dns") ? new Response("down", { status: 502 }) : real(url, init));
  try {
    const r = await worker.fetch(signed(ev(session("bare.test"))), env);
    assert.equal(r.status, 500);
    assert.equal(sent.length, 0);
  } finally {
    globalThis.fetch = real;
  }
});

// ---- rechecks ----
test("recheck schedule: day 2, 5, 10", () => {
  const o = { created: 0, checks: 0 };
  assert.equal(dueCheck(o, 1 * DAY), -1);
  assert.equal(dueCheck(o, 2 * DAY), 0);
  assert.equal(dueCheck({ created: 0, checks: 1 }, 4 * DAY), -1);
  assert.equal(dueCheck({ created: 0, checks: 1 }, 5 * DAY), 1);
  assert.equal(dueCheck({ created: 0, checks: 3 }, 30 * DAY), -1);
});

test("rechecks: quiet on day 2, reminder on day 5, ACTION NEEDED on day 10, done email once fixed", async () => {
  await worker.fetch(signed(ev(session("bare.test"))), env);
  const key = [...env.ORDERS.m.keys()][0];
  const created = JSON.parse(env.ORDERS.m.get(key)).created;
  sent = [];

  await recheckAll(env, created + 2 * DAY);
  assert.equal(sent.length, 0, "day 2 still open: no email");

  await recheckAll(env, created + 5 * DAY);
  assert.equal(sent.length, 2);
  assert.match(sent[0].body.subject, /bare\.test is at 1 of 4\. Want us to finish it\?/);
  assert.match(sent[0].body.html, /DO IT/);
  assert.ok(sent[0].body.attachments?.length === 1);
  assert.deepEqual(sent[0].body.to, ["pat@owner.example"]);
  sent = [];

  await recheckAll(env, created + 10 * DAY);
  assert.equal(sent.length, 1);
  assert.match(sent[0].body.subject, /ACTION NEEDED: Email Lockdown not finished after 10 days/);
  assert.equal(JSON.parse(env.ORDERS.m.get(key)).status, "human");
  sent = [];
  await recheckAll(env, created + 20 * DAY);
  assert.equal(sent.length, 0, "closed orders are left alone");
});

test("buyer fixes everything by day 2: locked-down email with the $49 credit", async () => {
  await worker.fetch(signed(ev(session("bare.test"))), env);
  const created = JSON.parse([...env.ORDERS.m.values()][0]).created;
  zone["bare.test"].TXT.push(q("v=spf1 include:_spf.google.com ~all"));
  zone["_dmarc.bare.test"] = { TXT: [q("v=DMARC1; p=none; rua=mailto:pat@bare.test")] };
  zone["google._domainkey.bare.test"] = { TXT: [q("v=DKIM1; k=rsa; p=MIIBIjAN")] };
  sent = [];
  await recheckAll(env, created + 2 * DAY);
  assert.equal(sent.length, 2);
  assert.match(sent[0].body.subject, /bare\.test: all four records published/);
  assert.match(sent[0].body.html, /up from 1 of 4/);
  assert.ok(sent[0].body.attachments?.length === 1);
  assert.match(sent[0].body.html, /Your \$49 counts toward any NeonKey package/);
  assert.match(sent[1].body.subject, /FYI: Email Lockdown locked down/);
});

test("buyer-supplied text is escaped in the HTML email", () => {
  const m = reportEmail({ name: "<b>x</b>", a: { domain: "a.test", provider: null, dnsHost: { label: null }, fixes: [{ id: "spf", type: "TXT", host: "@", value: "<img src=x>", action: "add", why: "w" }], buyerSteps: [], human: [], notes: [], locked: false } });
  assert.doesNotMatch(m.html, /<img src=x>/);
  assert.doesNotMatch(m.html, /<b>x<\/b>/);
});
