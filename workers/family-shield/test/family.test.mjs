// Family Shield Worker tests: fake KV, stubbed Resend, a fake Claude client, signed fake Stripe events. No network, no secrets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, { cleanup } from "../src/index.js";
import { familyCheck, aiOpinion, SCHEMA, MODEL } from "../src/ai.js";
import { MEMBER_DAILY } from "../src/store.js";

const WHSEC = "whsec_test_secret";
const BASE = "https://fs.example";

function kv() {
  const m = new Map();
  return {
    m,
    async get(k, type) { const v = m.get(k); if (v === undefined) return null; return type === "json" ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; },
  };
}

function fakeClaude(reply, calls = []) {
  return {
    calls,
    messages: {
      async create(req) {
        calls.push(req);
        if (reply instanceof Error) throw reply;
        if (reply.stop_reason) return { stop_reason: reply.stop_reason, content: [] };
        return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(reply) }], usage: { input_tokens: 400, output_tokens: 90 } };
      },
    },
  };
}

function setup({ ai = { verdict: "scam", reasons: ["It asks for money in a hurry."], next_step: "Call them on the number you already have." }, aiEnabled = "true" } = {}) {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    sent.push(JSON.parse(init.body));
    return new Response("{}", { status: 200 });
  };
  const calls = [];
  const env = {
    FS: kv(), APP_URL: BASE, FROM_ADDRESS: "NeonKey 🔑 <hello@neonkey.tech>", NOTIFY_TO: "hello@neonkey.tech", BCC_ADDRESS: "bcc@example.com",
    RESEND_API_KEY: "re_test", STRIPE_WEBHOOK_SECRET: WHSEC, FS_PAYMENT_LINK: "plink_fs_month,plink_fs_year", ALLOW_LIVE: "false",
    AI_ENABLED: aiEnabled, AI_DAILY_CAP: "100", ANTHROPIC_CLIENT: fakeClaude(ai, calls), PORTAL_URL: "https://billing.stripe.com/p/login/x",
  };
  return { env, sent, calls };
}

async function signed(event) {
  const raw = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WHSEC), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return new Request(`${BASE}/stripe`, { method: "POST", headers: { "Stripe-Signature": `t=${t},v1=${hex}` }, body: raw });
}
const checkout = (over = {}) => ({
  type: "checkout.session.completed", livemode: false,
  data: { object: { object: "checkout.session", id: "cs_1", status: "complete", payment_link: "plink_fs_month", subscription: "sub_1", customer: "cus_1", customer_details: { email: "Owner@Example.com", name: "Pat Owner" }, ...over } },
});
const call = (env, path, { method = "GET", body, origin } = {}) => {
  const headers = {};
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (origin) headers.Origin = origin;
  return worker.fetch(new Request(BASE + path, { method, headers, body: body ? new URLSearchParams(body).toString() : undefined }), env, { waitUntil() {} });
};
const linkFrom = (mail, prefix) => (mail.text.match(new RegExp(`${BASE}/${prefix}/[A-Za-z0-9_-]{43}`)) || [])[0].slice(BASE.length);

async function signedUpOwner(s) {
  const r = await worker.fetch(await signed(checkout()), s.env, { waitUntil() {} });
  assert.equal(r.status, 200);
  const welcome = s.sent.find((m) => m.subject === "Your Family Shield is ready");
  const link = linkFrom(welcome, "f");
  await call(s.env, `${link}/consent`, { method: "POST", body: { name: "Pat", adult: "yes", agree: "yes" } });
  return { link, welcome };
}

test("rules copy matches the site's free checker exactly", () => {
  assert.equal(readFileSync(new URL("../src/rules.mjs", import.meta.url), "utf8"), readFileSync(new URL("../../../src/lib/scam-check.mjs", import.meta.url), "utf8"));
});

test("checkout from an unknown payment link creates nothing; checkout is closed when FS_PAYMENT_LINK is empty", async () => {
  const s = setup();
  let r = await worker.fetch(await signed(checkout({ payment_link: "plink_desk" })), s.env, {});
  assert.deepEqual(await r.json(), { ok: true, ignored: "other_offer" });
  s.env.FS_PAYMENT_LINK = "";
  r = await worker.fetch(await signed(checkout()), s.env, {});
  assert.deepEqual(await r.json(), { ok: true, ignored: "other_offer" });
  assert.equal([...s.env.FS.m.keys()].filter((k) => k.startsWith("fam:")).length, 0);
  assert.equal(s.sent.length, 0);
});

test("bad signature and live events are rejected or ignored", async () => {
  const s = setup();
  const bad = new Request(`${BASE}/stripe`, { method: "POST", headers: { "Stripe-Signature": "t=1,v1=" + "0".repeat(64) }, body: JSON.stringify(checkout()) });
  assert.equal((await worker.fetch(bad, s.env, {})).status, 400);
  const r = await worker.fetch(await signed({ ...checkout(), livemode: true }), s.env, {});
  assert.deepEqual(await r.json(), { ok: true, ignored: "live" });
});

test("signup creates one plan, emails a private link (BCC on welcome only), and a re-delivered event does nothing", async () => {
  const s = setup();
  await worker.fetch(await signed(checkout()), s.env, {});
  await worker.fetch(await signed(checkout()), s.env, {});
  assert.equal([...s.env.FS.m.keys()].filter((k) => k.startsWith("fam:")).length, 1);
  const welcome = s.sent.filter((m) => m.subject === "Your Family Shield is ready");
  assert.equal(welcome.length, 1);
  assert.deepEqual(welcome[0].to, ["owner@example.com"]);
  assert.deepEqual(welcome[0].bcc, ["bcc@example.com"]);
  const link = linkFrom(welcome[0], "f");
  // Only the token's hash is stored.
  assert.ok(![...s.env.FS.m.keys()].some((k) => k.includes(link.split("/")[2])));
});

test("first visit asks for 18+ consent before any check", async () => {
  const s = setup();
  await worker.fetch(await signed(checkout()), s.env, {});
  const link = linkFrom(s.sent[0], "f");
  let r = await call(s.env, link);
  assert.match(await r.text(), /I'm 18 or older/);
  r = await call(s.env, `${link}/check`, { method: "POST", body: { text: "Your package is on hold, pay $1.25 at usps-help.top" } });
  assert.equal(r.status, 303);
  assert.equal(s.calls.length, 0);
  r = await call(s.env, `${link}/consent`, { method: "POST", body: { name: "Pat", adult: "yes" } });
  assert.equal(r.status, 400);
  r = await call(s.env, `${link}/consent`, { method: "POST", body: { name: "Pat", adult: "yes", agree: "yes" } });
  assert.equal(r.status, 303);
  r = await call(s.env, link);
  assert.match(await r.text(), /Paste the message/);
});

test("a check uses rules + AI, shows the more severe verdict, and never stores the text", async () => {
  const s = setup({ ai: { verdict: "scam", reasons: ["It pushes you to pay now."], next_step: "Open the carrier's own app." } });
  const { link } = await signedUpOwner(s);
  const secret = "Hi it's me, new number. Need $400 for a bus home, unique-marker-7781";
  const r = await call(s.env, `${link}/check`, { method: "POST", body: { text: secret } });
  const page = await r.text();
  assert.match(page, /Looks like a scam/);
  assert.match(page, /It pushes you to pay now\./);
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].model, MODEL);
  assert.equal(s.calls[0].output_config.effort, "low");
  assert.deepEqual(s.calls[0].output_config.format, { type: "json_schema", schema: SCHEMA });
  assert.ok(!("tools" in s.calls[0]));
  assert.match(s.calls[0].messages[0].content, /<message>/);
  for (const v of s.env.FS.m.values()) assert.ok(!v.includes("unique-marker-7781"), "message text must not be stored");
  for (const m of s.sent) assert.ok(!JSON.stringify(m).includes("unique-marker-7781"), "message text must not be emailed");
});

test("the AI can raise the verdict but never lower it", async () => {
  const scamText = "URGENT: your account is locked. Verify your login at http://chase-secure-verify.top within 24 hours or it will be closed.";
  const s1 = setup({ ai: { verdict: "normal", reasons: [], next_step: "Looks fine." } });
  const low = await familyCheck(s1.env, scamText, { useAi: true, client: s1.env.ANTHROPIC_CLIENT });
  assert.equal(low.rules, "scam");
  assert.equal(low.verdict, "scam");
  const s2 = setup({ ai: { verdict: "scam", reasons: ["A stranger offering money."], next_step: "Ignore it." } });
  const up = await familyCheck(s2.env, "Hey, are we still on for lunch on Friday at noon?", { useAi: true, client: s2.env.ANTHROPIC_CLIENT });
  assert.equal(up.rules, "normal");
  assert.equal(up.verdict, "scam");
});

test("refusal, errors and the kill switch fall back to rules with a note", async () => {
  const text = "Your package is on hold, pay the $1.25 fee at usps-redeliver.top today";
  for (const reply of [{ stop_reason: "refusal" }, new Error("boom")]) {
    const s = setup({ ai: reply });
    assert.deepEqual(Object.keys(await aiOpinion(s.env, text, s.env.ANTHROPIC_CLIENT)), ["error"]);
    const r = await familyCheck(s.env, text, { useAi: true, client: s.env.ANTHROPIC_CLIENT });
    assert.equal(r.ai, null);
    assert.match(r.aiNote, /rules only/);
  }
  const s = setup({ aiEnabled: "false" });
  const { link } = await signedUpOwner(s);
  const page = await (await call(s.env, `${link}/check`, { method: "POST", body: { text } })).text();
  assert.match(page, /paused right now/);
  assert.equal(s.calls.length, 0);
});

test("daily limit per member, and the global AI cap switches to rules only", async () => {
  const s = setup();
  s.env.AI_DAILY_CAP = "2";
  const { link } = await signedUpOwner(s);
  const text = "Is this real? Click here to claim your prize now";
  for (let i = 0; i < MEMBER_DAILY; i++) assert.equal((await call(s.env, `${link}/check`, { method: "POST", body: { text } })).status, 200);
  assert.equal(s.calls.length, 2);
  assert.equal((await call(s.env, `${link}/check`, { method: "POST", body: { text } })).status, 429);
});

test("invites: owner only, 18+ consent on join, max 5 adults, removal kills the link", async () => {
  const s = setup();
  const { link } = await signedUpOwner(s);
  let r = await call(s.env, `${link}/invite`, { method: "POST", body: { name: "Sam", email: "sam@example.com" } });
  assert.match(await r.text(), /Invite sent to Sam/);
  const inv = s.sent.find((m) => m.to[0] === "sam@example.com");
  assert.ok(!inv.bcc, "invites are never BCC'd");
  const joinLink = linkFrom(inv, "join");
  r = await call(s.env, joinLink, { method: "POST", body: { name: "Sam", adult: "yes" } });
  assert.equal(r.status, 400);
  r = await call(s.env, joinLink, { method: "POST", body: { name: "Sam", adult: "yes", agree: "yes" } });
  assert.equal(r.status, 303);
  const samLink = r.headers.get("Location");
  assert.match(await (await call(s.env, samLink)).text(), /Paste the message/);
  // Used invite can't be reused.
  assert.equal((await call(s.env, joinLink)).status, 410);
  // A member can't invite.
  r = await call(s.env, `${samLink}/invite`, { method: "POST", body: { name: "X", email: "x@example.com" } });
  assert.equal(r.status, 303);
  // Fill the plan: owner + Sam + 3 invites = 5.
  for (const n of ["a", "b", "c"]) await call(s.env, `${link}/invite`, { method: "POST", body: { name: n, email: `${n}@example.com` } });
  r = await call(s.env, `${link}/invite`, { method: "POST", body: { name: "d", email: "d@example.com" } });
  assert.equal(r.status, 409);
  // Remove Sam.
  const fam = JSON.parse([...s.env.FS.m.entries()].find(([k]) => k.startsWith("fam:"))[1]);
  const sam = fam.members.find((m) => m.email === "sam@example.com");
  await call(s.env, `${link}/remove`, { method: "POST", body: { member: sam.id } });
  assert.equal((await call(s.env, samLink)).status, 404);
});

test("sharing stores only the verdict, known tell ids and the note", async () => {
  const s = setup();
  const { link } = await signedUpOwner(s);
  await call(s.env, `${link}/share`, { method: "POST", body: { verdict: "scam", tells: "toll,link-odd-ending,<script>", note: "Fake toll text going around" } });
  const fam = JSON.parse([...s.env.FS.m.entries()].find(([k]) => k.startsWith("fam:"))[1]);
  assert.deepEqual(fam.shares[0].tells, ["toll", "link-odd-ending"]);
  assert.equal(fam.shares[0].note, "Fake toll text going around");
  const page = await (await call(s.env, link)).text();
  assert.match(page, /An unpaid toll/);
});

test("cross-site POSTs are refused", async () => {
  const s = setup();
  const { link } = await signedUpOwner(s);
  const r = await call(s.env, `${link}/check`, { method: "POST", body: { text: "hello there friend" }, origin: "https://evil.example" });
  assert.equal(r.status, 403);
});

test("login never reveals whether an email is on a plan, and sends a link when it is", async () => {
  const s = setup();
  await signedUpOwner(s);
  const before = s.sent.length;
  const a = await (await call(s.env, "/login", { method: "POST", body: { email: "nobody@example.com" } })).text();
  const b = await (await call(s.env, "/login", { method: "POST", body: { email: "owner@example.com" } })).text();
  assert.equal(a, b);
  assert.equal(s.sent.filter((m) => m.subject === "Your Family Shield link").length, 1);
  assert.equal(s.sent.length, before + 1);
});

test("cancel turns checks off and deletes everything 30 days later", async () => {
  const s = setup();
  const { link } = await signedUpOwner(s);
  await worker.fetch(await signed({ type: "customer.subscription.deleted", livemode: false, data: { object: { object: "subscription", id: "sub_1", status: "canceled" } } }), s.env, {});
  assert.match(await (await call(s.env, link)).text(), /has ended/);
  assert.equal(await cleanup(s.env, Date.now()), 0);
  assert.equal(await cleanup(s.env, Date.now() + 31 * 86400 * 1000), 1);
  const left = [...s.env.FS.m.keys()].filter((k) => /^(fam|tok|email|sub):/.test(k));
  assert.deepEqual(left, []);
});

test("past-due plans run rules only", async () => {
  const s = setup();
  const { link } = await signedUpOwner(s);
  await worker.fetch(await signed({ type: "customer.subscription.updated", livemode: false, data: { object: { object: "subscription", id: "sub_1", status: "past_due" } } }), s.env, {});
  const page = await (await call(s.env, `${link}/check`, { method: "POST", body: { text: "Your package is on hold, pay $1.25" } })).text();
  assert.match(page, /rules only/);
  assert.equal(s.calls.length, 0);
});

test("pages carry a strict CSP and no inline script", async () => {
  const s = setup();
  const { link } = await signedUpOwner(s);
  const r = await call(s.env, link);
  assert.match(r.headers.get("Content-Security-Policy"), /default-src 'none'/);
  assert.doesNotMatch(await r.text(), /<script/i);
});
