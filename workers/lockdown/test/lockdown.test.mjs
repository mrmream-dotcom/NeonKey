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
    "zoho.test": { MX: ["10 mx.zoho.eu."], NS: ["ns1.cloudflare.com."], TXT: [] },
    "fm.test": { MX: ["10 in1-smtp.messagingengine.com."], NS: ["ns1.porkbun.com."], TXT: [q("v=spf1 include:spf.messagingengine.com ?all")] },
    "fwd.test": { MX: ["10 fwd1.porkbun.com.", "20 fwd2.porkbun.com."], NS: ["curitiba.ns.porkbun.com."], TXT: [q("v=spf1 include:_spf.porkbun.com ~all")] },
    "_dmarc.fwd.test": { TXT: [q("v=DMARC1; p=quarantine")] },
    "fwd2.test": { MX: ["10 fwd1.porkbun.com."], NS: ["curitiba.ns.porkbun.com."], TXT: [q("v=spf1 include:_spf.porkbun.com ~all")] },
    "_dmarc.fwd2.test": { TXT: [q("v=DMARC1; p=none")] },
    "resend._domainkey.fwd2.test": { TXT: [q("p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC")] },
    "messy.test": { MX: ["10 mail.mxroute.com."], NS: ["ns1.wixdns.net."], TXT: [q("v=spf1 include:zoho.com ~all"), q("v=spf1 include:sendgrid.net ~all")] },
    // No MX
    "nomail.test": { MX: [], NS: ["ns1.domaincontrol.com."], TXT: [] },
  };
}
const nx = new Set(["typo.test"]);

let sent = [];
let pdfCalls = [];
let pdfMode = "ok";
let gRows = [], gCalls = [], gTokenCalls = [], gMode = "ok";
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  if (u.hostname === "cloudflare-dns.com") {
    const name = u.searchParams.get("name").replace(/\.$/, "");
    const type = u.searchParams.get("type");
    if (nx.has(name)) return Response.json({ Status: 3, Answer: [] });
    const data = zone[name]?.[type] || [];
    return Response.json({ Status: 0, Answer: data.map((d) => ({ name, type: T[type], data: d })) });
  }
  if (u.hostname === "api.cloudflare.com" && u.pathname.endsWith("/browser-rendering/pdf")) {
    pdfCalls.push({ auth: init.headers.Authorization, body: JSON.parse(init.body) });
    if (pdfMode === "fail") return new Response("{}", { status: 500, headers: { "content-type": "application/json" } });
    return new Response(new TextEncoder().encode("%PDF-1.7\n" + "x".repeat(800)), { headers: { "content-type": "application/pdf" } });
  }
  if (u.hostname === "api.resend.com") {
    sent.push({ body: JSON.parse(init.body), headers: init.headers });
    return Response.json({ id: "email_1" });
  }
  if (u.hostname === "oauth2.googleapis.com") {
    gTokenCalls.push(Object.fromEntries(new URLSearchParams(init.body)));
    return Response.json({ access_token: "ya29.fake" });
  }
  if (u.hostname === "sheets.googleapis.com") {
    if (gMode === "fail") return new Response("{}", { status: 503 });
    const path = decodeURIComponent(u.pathname);
    gCalls.push({ method: init.method || "GET", path, body: init.body ? JSON.parse(init.body) : null });
    const col = (c) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    const setCells = (a1, values) => {
      const m = /!([A-Z]+)(\d+)/.exec(a1);
      const r = Number(m[2]) - 2, c0 = col(m[1]);
      while (gRows.length <= r) gRows.push([]);
      values[0].forEach((v, j) => { gRows[r][c0 + j] = String(v); });
    };
    if (path.endsWith("A2:Z")) return Response.json({ values: gRows.map((r) => r.slice(0, 26)) });
    if (path.endsWith("values:batchUpdate")) { JSON.parse(init.body).data.forEach((d) => setCells(d.range, d.values)); return Response.json({}); }
    if (path.endsWith(":append")) { gRows.push(JSON.parse(init.body).values[0].map(String)); return Response.json({}); }
    if (init.method === "PUT") { setCells(path, JSON.parse(init.body).values); return Response.json({}); }
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
  pdfCalls = [];
  pdfMode = "ok";
  gRows = []; gCalls = []; gTokenCalls = []; gMode = "ok";
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
  assert.ok(a.human.some((h) => /MXroute/.test(h)));
  assert.ok(a.human.some((h) => /2 SPF records/.test(h)));
  assert.equal(a.fixes.some((f) => f.id === "spf"), false);
});

test("more providers: Zoho EU gets zohomail.eu and a DKIM click, Fastmail gets its three DKIM CNAMEs", async () => {
  const z = await audit("zoho.test");
  assert.equal(z.provider.label, "Zoho Mail");
  assert.equal(z.human.length, 0);
  assert.equal(z.fixes.find((f) => f.id === "spf").value, "v=spf1 include:zohomail.eu ~all");
  assert.match(z.buyerSteps[0].help, /zoho\.com\/mail\/help/);
  const f = await audit("fm.test");
  assert.equal(f.fixes.find((x) => x.id === "spf").value, "v=spf1 include:spf.messagingengine.com ~all");
  assert.deepEqual(f.fixes.filter((x) => x.id === "dkim").map((x) => [x.type, x.host, x.value]), [1, 2, 3].map((i) => ["CNAME", `fm${i}._domainkey`, `fm${i}.fm.test.dkim.fmhosted.com`]));
  assert.equal(f.buyerSteps.length, 0);
});

test("forwarding (Porkbun): automatic report, asks where they send from; a key at a common name counts", async () => {
  const a = await audit("fwd.test");
  assert.equal(a.provider.label, "Porkbun email forwarding");
  assert.equal(a.human.length, 0);
  assert.equal(a.fixes.length, 0);
  assert.equal(a.buyerSteps[0].id, "dkim");
  assert.equal(a.buyerSteps[0].help, null);
  assert.match(a.buyerSteps[0].text, /send from/);
  const { reportEmail } = await import("../src/email.js");
  const m = reportEmail({ name: "Pat", a });
  assert.match(m.subject, /report for fwd\.test/);
  assert.match(m.text, /send from/);
  const b = await audit("fwd2.test");
  assert.deepEqual(b.dkim, ["resend"]);
  assert.equal(b.locked, true);
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
  assert.equal(notice.headers, undefined);
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
  assert.match(notice.subject, /🚨 URGENT · ACTION NEEDED/);
  assert.equal(notice.headers.Importance, "high");
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

test("with BROWSER_TOKEN set, the report goes out as a PDF and the email says so", async () => {
  env.BROWSER_TOKEN = "cf_fake";
  env.CF_ACCOUNT_ID = "acct123";
  const r = await worker.fetch(signed(ev(session("bare.test"))), env);
  assert.equal(r.status, 200);
  assert.equal(pdfCalls.length, 1);
  assert.equal(pdfCalls[0].auth, "Bearer cf_fake");
  assert.match(pdfCalls[0].body.html, /Recommended changes/);
  const buyer = sent[0].body;
  assert.match(buyer.attachments[0].filename, /NeonKey-Email-Report-bare\.test\.pdf$/);
  assert.match(Buffer.from(buyer.attachments[0].content, "base64").toString("latin1"), /^%PDF/);
});

test("if the PDF render fails, the buyer still gets the report as HTML", async () => {
  env.BROWSER_TOKEN = "cf_fake";
  env.CF_ACCOUNT_ID = "acct123";
  pdfMode = "fail";
  const r = await worker.fetch(signed(ev(session("bare.test"))), env);
  assert.equal(r.status, 200);
  assert.equal(pdfCalls.length, 1);
  assert.match(sent[0].body.attachments[0].filename, /\.html$/);
});

test("the already-protected email names the PDF when one is attached", () => {
  const a = { domain: "ok.test", provider: { label: "Google Workspace" }, mx: ["x"], dkim: ["google"], fixes: [], buyerSteps: [], human: [], notes: [], locked: true, dmarc: { policy: "quarantine" } };
  assert.match(reportEmail({ name: "Pat", a, pdf: true }).html, /attached as a PDF/);
  assert.doesNotMatch(reportEmail({ name: "Pat", a, pdf: true }).html, /monitor mode/);
  assert.match(reportEmail({ name: "Pat", a }).html, /Open it in any browser/);
});

test("protected domains get extra checks in the report and a next step in the email", async () => {
  const { extraChecks } = await import("../src/audit.js");
  const recs = { "_mta-sts.ok.test": ["v=STSv1; id=1"], "_smtp._tls.ok.test": [], "default._bimi.ok.test": [] };
  const txt = async (n) => recs[n] || [];
  const x = await extraChecks("ok.test", { dmarc: { policy: "none" }, spf: { lookups: 9 } }, "v=spf1 include:_spf.google.com -all", "v=DMARC1; p=none", txt);
  const by = Object.fromEntries(x.map((e) => [e.id, e]));
  assert.equal(by.enforce.status, "tip");
  assert.equal(by.reports.status, "tip");
  assert.equal(by.spfmode.status, "good");
  assert.equal(by.lookups.status, "tip");
  assert.equal(by.mtasts.status, "good");
  assert.equal(by.tlsrpt.status, "info");
  const q = await extraChecks("ok.test", { dmarc: { policy: "quarantine" }, spf: { lookups: 3 } }, "v=spf1 ~all", "v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@ok.test", txt);
  assert.match(q.find((e) => e.id === "enforce").detail, /25%/);
  assert.match(q.find((e) => e.id === "reports").detail, /dmarc@ok\.test/);

  const a = { domain: "ok.test", provider: { label: "Google Workspace" }, mx: ["x"], dkim: ["google"], fixes: [], buyerSteps: [], human: [], notes: [], locked: true, dmarc: { policy: "none" }, extras: x };
  const { renderReport } = await import("../src/report.js");
  const html = renderReport({ a, order: { id: "cs_test_x" } });
  assert.match(html, /Extra checks/);
  assert.match(html, /2 of 7 in place/);
  const m = reportEmail({ name: "Pat", a, pdf: true });
  assert.match(m.html, /7 extra checks/);
  assert.match(m.text, /Worth doing next: move from monitoring fakes to blocking them/);
});

// ---- Lead Tracker sync ----
const { privateKey } = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", privateKey)).toString("base64");
const SA_KEY = JSON.stringify({ client_email: "lockdown@neonkey-test.iam.gserviceaccount.com", private_key: `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n` });
const W = 22; // column W (0-based)
function liveSheetEnv() {
  Object.assign(env, { ALLOW_LIVE: "true", GOOGLE_SA_KEY: SA_KEY, LEAD_SHEET_ID: "sheet_test" });
  gRows = [
    ["FBX1", "Fairbanks 100", "Some Shop", "owner@shop.example"],
    ["IN3", "Inbound / Hot", "Pat", "pat@owner.example", "website contact form"],
  ];
}
const liveEv = (obj, type) => ({ ...ev(obj, type), livemode: true });
const paidSession = (domain, extra = {}) => session(domain, { payment_intent: "pi_live_1", created: Date.UTC(2026, 10, 5, 7, 0) / 1000, ...extra });

test("paid order fills the buyer's existing tracker row: won, AKST date, $, Stripe id, 0 hours", async () => {
  liveSheetEnv();
  const r = await worker.fetch(signed(liveEv(paidSession("done.test"))), env);
  assert.equal(r.status, 200);
  assert.equal(gTokenCalls[0].grant_type, "urn:ietf:params:oauth:grant-type:jwt-bearer");
  assert.equal(JSON.parse(Buffer.from(gTokenCalls[0].assertion.split(".")[1], "base64url")).iss, "lockdown@neonkey-test.iam.gserviceaccount.com");
  assert.equal(gRows.length, 2);
  assert.deepEqual(gRows[1].slice(W, W + 6), ["won", "2026-11-04", "49", "pi_live_1", "0", "0"]);
  assert.equal(JSON.parse(env.ORDERS.m.get("order:cs_test_done_test")).sheet, "written");
  // Stripe retry: nothing written twice
  await worker.fetch(signed(liveEv(paidSession("done.test"))), env);
  assert.equal(gRows.length, 2);
});

test("a new buyer gets an Inbound / Hot row with the lockdown49 offer", async () => {
  liveSheetEnv();
  await worker.fetch(signed(liveEv(paidSession("done.test", { customer_details: { email: "New@Buyer.example", name: "Sam New", business_name: "Sam's Bakery" } }))), env);
  assert.equal(gRows.length, 3);
  const row = gRows[2];
  assert.equal(row.length, 28);
  assert.deepEqual(row.slice(0, 4), ["IN4", "Inbound / Hot", "Sam New / Sam's Bakery", "new@buyer.example"]);
  assert.equal(row[8], "lockdown49 (Stripe)");
  assert.deepEqual(row.slice(W), ["won", "2026-11-04", "49", "pi_live_1", "0", "0"]);
});

test("orders a person must finish leave delivery and support hours blank", async () => {
  liveSheetEnv();
  await worker.fetch(signed(liveEv(paidSession("nomail.test"))), env);
  assert.deepEqual(gRows[1].slice(W, W + 4), ["won", "2026-11-04", "49", "pi_live_1"]);
  assert.equal(gRows[1][W + 4], undefined);
});

test("test-mode orders and the owner's own buys stay out of the tracker", async () => {
  liveSheetEnv();
  await worker.fetch(signed(ev(paidSession("done.test"))), env);
  await worker.fetch(signed(liveEv(paidSession("done.test", { id: "cs_own", customer_details: { email: "BCC@example.com", name: "Owner" } }))), env);
  assert.equal(gCalls.length, 0);
});

test("a full refund marks the row refunded and stops rechecks; partial refunds are ignored", async () => {
  liveSheetEnv();
  await worker.fetch(signed(liveEv(paidSession("bare.test"))), env);
  const charge = { id: "ch_1", object: "charge", payment_intent: "pi_live_1", refunded: false, amount_refunded: 1000 };
  let r = await worker.fetch(signed(liveEv(charge, "charge.refunded")), env);
  assert.equal((await r.json()).refund, "ignored");
  assert.equal(gRows[1][W], "won");
  r = await worker.fetch(signed(liveEv({ ...charge, refunded: true, amount_refunded: 4900 }, "charge.refunded")), env);
  assert.equal((await r.json()).refund, "refunded");
  assert.equal(gRows[1][W], "refunded");
  const order = JSON.parse(env.ORDERS.m.get("order:cs_test_bare_test"));
  assert.equal(order.status, "refunded");
  const before = sent.length;
  await recheckAll(env, order.created + 6 * DAY);
  assert.equal(sent.length, before);
  r = await worker.fetch(signed(liveEv({ ...charge, payment_intent: "pi_other", refunded: true }, "charge.refunded")), env);
  assert.equal((await r.json()).refund, "unknown");
});

test("if Google is down the order still goes out, and the daily run writes the row later", async () => {
  liveSheetEnv();
  gMode = "fail";
  const r = await worker.fetch(signed(liveEv(paidSession("done.test"))), env);
  assert.equal(r.status, 200);
  assert.equal(sent.length, 2);
  assert.equal(JSON.parse(env.ORDERS.m.get("order:cs_test_done_test")).sheet, "pending");
  // refund while the paid write is still pending: the retry carries it
  await worker.fetch(signed(liveEv({ id: "ch_2", object: "charge", payment_intent: "pi_live_1", refunded: true }, "charge.refunded")), env);
  gMode = "ok";
  await recheckAll(env);
  assert.equal(JSON.parse(env.ORDERS.m.get("order:cs_test_done_test")).sheet, "written");
  assert.equal(gRows[1][W], "refunded");
});

test("without GOOGLE_SA_KEY the sync is off and nothing calls Google", async () => {
  env.ALLOW_LIVE = "true";
  await worker.fetch(signed(liveEv(paidSession("done.test"))), env);
  assert.equal(gCalls.length + gTokenCalls.length, 0);
  assert.equal(JSON.parse(env.ORDERS.m.get("order:cs_test_done_test")).sheet, "off");
});
