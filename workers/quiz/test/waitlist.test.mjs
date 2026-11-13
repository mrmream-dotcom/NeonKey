// Run: npm test (in workers/quiz). Stubbed KV and Resend, no network, no real keys.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { handleWaitlist, validateWaitlist, renderWaitlistEmail, PRODUCTS } from "../src/waitlist.js";

// Same rules as index.js normalizeEmail (kept in sync by the "matches index.js" test below).
const normalizeEmail = (e) => {
  const s = String(e || "").trim().toLowerCase();
  if (s.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(s)) return "";
  const domain = s.slice(s.indexOf("@") + 1);
  return domain.slice(1, -1).includes(".") ? s : "";
};
const sha256Hex = async (s) => createHash("sha256").update(s).digest("hex");
const cleanSource = (src) => (src && typeof src.l === "string" ? `landed on ${src.l}` : "");

let kv, sent, env, sendOk;
const reply = (status, body) => ({ status, body });
const req = (ip = "203.0.113.7") => ({ headers: new Map([["CF-Connecting-IP", ip]]) });
const deps = () => ({ normalizeEmail, sha256Hex, cleanSource, resendSend: async (_e, payload) => { sent.push(payload); return { ok: sendOk, status: sendOk ? 200 : 500 }; } });
const good = (over = {}) => ({ product: "family-shield", email: "Pat@Example.com", for_whom: "parents", consent: true, website: "", ...over });

beforeEach(() => {
  kv = new Map();
  sent = [];
  sendOk = true;
  env = {
    QUIZ_RL: { get: async (k) => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, v); } },
    FROM_ADDRESS: "NeonKey 🔑 <hello@neonkey.tech>", REPLY_TO: "hello@neonkey.tech", LEAD_TO: "hello@neonkey.tech", RL_SALT: "test",
  };
});
// Headers in the Worker are a Headers object; a Map has the same .get().

test("valid signup saves one record, emails the visitor and sends a lead copy", async () => {
  const r = await handleWaitlist(req(), env, good(), reply, deps());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, emailed: true });
  const recs = [...kv.keys()].filter((k) => k.startsWith("wl:family-shield:"));
  assert.equal(recs.length, 1);
  const rec = JSON.parse(kv.get(recs[0]));
  assert.equal(rec.email, "pat@example.com");
  assert.equal(rec.forWhom, "parents");
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0].to, ["pat@example.com"]);
  assert.equal(sent[0].from, "NeonKey 🔑 <hello@neonkey.tech>");
  assert.deepEqual(sent[1].to, ["hello@neonkey.tech"]);
});

test("the record key holds a hash, never the raw email", async () => {
  await handleWaitlist(req(), env, good(), reply, deps());
  for (const k of kv.keys()) assert.ok(!k.includes("example.com"), k);
});

test("joining twice keeps one record, the first join date, and sends no second email", async () => {
  await handleWaitlist(req(), env, good(), reply, deps());
  const key = [...kv.keys()].find((k) => k.startsWith("wl:"));
  const first = JSON.parse(kv.get(key)).joinedAt;
  const r = await handleWaitlist(req("198.51.100.2"), env, good({ email: " pat@example.com ", for_whom: "friends" }), reply, deps());
  assert.deepEqual(r.body, { ok: true, already: true });
  assert.equal([...kv.keys()].filter((k) => k.startsWith("wl:")).length, 1);
  const rec = JSON.parse(kv.get(key));
  assert.equal(rec.joinedAt, first);
  assert.equal(rec.forWhom, "friends");
  assert.equal(sent.length, 2);
});

test("consent must be exactly true", async () => {
  for (const consent of [undefined, false, "true", 1]) {
    const r = await handleWaitlist(req(), env, good({ consent }), reply, deps());
    assert.equal(r.status, 400, String(consent));
  }
  assert.equal(kv.size, 0);
  assert.equal(sent.length, 0);
});

test("only listed products are accepted", async () => {
  for (const product of ["", "founder-watchdog-x", "__proto__", "constructor", undefined]) {
    const r = await handleWaitlist(req(), env, good({ product }), reply, deps());
    assert.equal(r.status, 400, String(product));
  }
  assert.equal(kv.size, 0);
});

test("bad email is rejected", async () => {
  for (const email of ["", "nope", "a@b", "a@.com", "x".repeat(250) + "@ex.com"]) {
    const r = await handleWaitlist(req(), env, good({ email }), reply, deps());
    assert.equal(r.status, 400, email);
  }
});

test("unknown for_whom is dropped, not stored", () => {
  const v = validateWaitlist(good({ for_whom: "<script>" }), normalizeEmail);
  assert.equal(v.ok, true);
  assert.equal(v.value.forWhom, "");
});

test("per-IP daily limit", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await handleWaitlist(req(), env, good({ email: `p${i}@example.com` }), reply, deps())).status, 200);
  const r = await handleWaitlist(req(), env, good({ email: "p9@example.com" }), reply, deps());
  assert.equal(r.status, 429);
});

test("global daily limit", async () => {
  env.WAITLIST_GLOBAL_DAILY_LIMIT = "2";
  assert.equal((await handleWaitlist(req("1.1.1.1"), env, good({ email: "a1@example.com" }), reply, deps())).status, 200);
  assert.equal((await handleWaitlist(req("1.1.1.2"), env, good({ email: "a2@example.com" }), reply, deps())).status, 200);
  assert.equal((await handleWaitlist(req("1.1.1.3"), env, good({ email: "a3@example.com" }), reply, deps())).status, 429);
});

test("a failed email still saves the signup and says so", async () => {
  sendOk = false;
  const r = await handleWaitlist(req(), env, good(), reply, deps());
  assert.deepEqual(r.body, { ok: true, emailed: false });
  assert.equal([...kv.keys()].filter((k) => k.startsWith("wl:")).length, 1);
});

test("confirmation copy: planned price, nothing charged, removal, no promises", () => {
  const m = renderWaitlistEmail({ product: "family-shield" });
  assert.match(m.text, /\$7\/mo or \$70\/yr \(planned price\)/);
  assert.match(m.text, /Nothing is charged/);
  assert.match(m.text, /remove/);
  assert.match(m.text, /isn't built yet/);
  for (const banned of [/you're safe/i, /guarantee/i, /plain english/i, /\bMike\b/, /Neon Key/]) assert.doesNotMatch(m.text, banned);
  assert.doesNotMatch(m.html, /<script/i);
});

test("product list is a plain allowlist", () => {
  assert.deepEqual(Object.keys(PRODUCTS), ["family-shield"]);
  assert.equal(Object.getPrototypeOf(PRODUCTS), Object.prototype);
});

test("prototype keys never count as products", () => {
  for (const product of ["__proto__", "toString", "hasOwnProperty"]) assert.equal(validateWaitlist(good({ product }), normalizeEmail).ok, false, product);
});

test("normalizeEmail copy matches index.js", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.ok(src.includes('return domain.slice(1, -1).includes(".") ? s : "";'));
  assert.ok(src.includes('if (s.length > 254 || !/^[^\\s@]+@[^\\s@]+$/.test(s)) return "";'));
});
