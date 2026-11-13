// Run: npm test (node --test). Stubbed KV and Resend, no network, no keys.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { handleWatchdog, WD_TTL } from "../src/watchdog.js";
import { validateWdAnswers, qualifyWd, cleanWdDomain } from "../../../src/data/watchdog.ts";

const sha256Hex = async (s) => createHash("sha256").update(s).digest("hex");
const normalizeEmail = (e) => { const s = String(e || "").trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : ""; };
const cleanSource = (src) => (src && typeof src.l === "string" ? `landed on ${src.l}` : "");

let kv, sent, resendOk;
function makeKv() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.has(k) ? m.get(k).v : null; },
    async put(k, v, o = {}) { m.set(k, { v, o }); },
  };
}
const env = () => ({ QUIZ_RL: kv, FROM_ADDRESS: "NeonKey <hello@neonkey.tech>", REPLY_TO: "hello@neonkey.tech", LEAD_TO: "hello@neonkey.tech", BCC_ADDRESS: "bcc@example.test", RL_SALT: "t" });
const h = () => ({ sha256Hex, normalizeEmail, cleanSource, resendSend: async (_env, payload) => { sent.push(payload); return { ok: resendOk, status: resendOk ? 200 : 500 }; } });
const reply = (status, body) => ({ status, body });
const req = (ip = "1.2.3.4") => ({ headers: new Map([["CF-Connecting-IP", ip]]) });
const good = { email: "ana@acme.test", domain: "https://www.Acme.test/", answers: { dns: "self", domains: "one", plan: "monthly", watch: ["email", "ssl"], from: "preflight" }, src: { l: "/founders/preflight/" } };

beforeEach(() => { kv = makeKv(); sent = []; resendOk = true; });

test("qualified signup: stores entry with metadata, confirms once, sends lead copy", async () => {
  const r = await handleWatchdog(req(), env(), structuredClone(good), reply, h());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, repeat: false, qualified: true });
  const entries = [...kv.m].filter(([k]) => k.startsWith("wd:entry:"));
  assert.equal(entries.length, 1);
  const [, { v, o }] = entries[0];
  const e = JSON.parse(v);
  assert.equal(e.domain, "acme.test");
  assert.equal(e.emailOnDomain, true);
  assert.equal(o.expirationTtl, WD_TTL);
  assert.deepEqual(o.metadata, { q: 1, from: "preflight", plan: "monthly", dns: "self", created: e.created });
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0].to, ["ana@acme.test"]);
  assert.match(sent[0].text, /isn't built yet/);
  assert.match(sent[0].text, /\$9 a month or \$90 a year/);
  assert.deepEqual(sent[1].to, ["hello@neonkey.tech"]);
  assert.equal(sent[1].reply_to, "ana@acme.test");
  assert.match(sent[1].subject, /^Qualified Watchdog waitlist: acme\.test$/);
  assert.match(sent[1].text, /First touch: landed on \/founders\/preflight\//);
});

test("repeat signup updates the entry and sends no second confirmation", async () => {
  await handleWatchdog(req(), env(), structuredClone(good), reply, h());
  sent = [];
  const again = structuredClone(good);
  again.answers.plan = "free_only";
  const r = await handleWatchdog(req(), env(), again, reply, h());
  assert.equal(r.body.repeat, true);
  assert.equal(r.body.qualified, false);
  assert.equal(sent.length, 1, "only the lead copy");
  assert.match(sent[0].subject, /^Updated/);
  const [, { o }] = [...kv.m].find(([k]) => k.startsWith("wd:entry:"));
  assert.equal(o.metadata.q, 0);
});

test("unqualified reasons: personal mailbox domain, unsure DNS, only if free", () => {
  const a = validateWdAnswers({ dns: "unsure", domains: "one", plan: "free_only", watch: [], from: "nowhere" });
  assert.equal(a.from, "direct");
  const q = qualifyWd("gmail.com", a);
  assert.equal(q.qualified, false);
  assert.deepEqual(q.reasons, ["personal mailbox domain", "unsure who manages DNS", "only if free"]);
  assert.equal(qualifyWd("acme.test", { ...a, dns: "other", plan: "yearly" }).controlIntent, "helper");
  assert.equal(qualifyWd("acme.test", { ...a, dns: "other", plan: "yearly" }).qualified, true);
});

test("rejects bad input before touching KV or email", async () => {
  for (const bad of [
    { ...good, email: "nope" },
    { ...good, domain: "not a domain" },
    { ...good, answers: { ...good.answers, dns: "root" } },
    { ...good, answers: { ...good.answers, watch: ["email", "<script>"] } },
    { ...good, answers: undefined },
  ]) {
    const r = await handleWatchdog(req(), env(), structuredClone(bad), reply, h());
    assert.equal(r.status, 400);
  }
  assert.equal(kv.m.size, 0);
  assert.equal(sent.length, 0);
});

test("per-IP and global daily limits", async () => {
  const e = env();
  e.WD_IP_DAILY_LIMIT = "2";
  for (let i = 0; i < 2; i++) assert.equal((await handleWatchdog(req(), e, { ...structuredClone(good), email: `a${i}@acme.test` }, reply, h())).status, 200);
  assert.equal((await handleWatchdog(req(), e, { ...structuredClone(good), email: "a9@acme.test" }, reply, h())).status, 429);
  assert.equal((await handleWatchdog(req("9.9.9.9"), e, { ...structuredClone(good), email: "b@acme.test" }, reply, h())).status, 200);
  e.WD_GLOBAL_DAILY_LIMIT = "3";
  assert.equal((await handleWatchdog(req("8.8.8.8"), e, { ...structuredClone(good), email: "c@acme.test" }, reply, h())).status, 429);
});

test("failed confirmation email stores nothing and counts nothing", async () => {
  resendOk = false;
  const r = await handleWatchdog(req(), env(), structuredClone(good), reply, h());
  assert.equal(r.status, 502);
  assert.equal(kv.m.size, 0);
});

test("domain cleaning matches what people paste", () => {
  assert.equal(cleanWdDomain("me@Shop.com"), "shop.com");
  assert.equal(cleanWdDomain("https://www.shop.co.uk/path?x=1"), "shop.co.uk");
  assert.equal(cleanWdDomain("localhost"), null);
  assert.equal(cleanWdDomain(42), null);
});
