// Test doubles: in-memory KV with metadata and TTL, a fetch stub that records Resend sends, and a Stripe signer.
import { createHmac } from "node:crypto";

export function memKV() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.has(k) ? m.get(k).v : null; },
    async put(k, v, o = {}) { m.set(k, { v, meta: o.metadata ?? null, ttl: o.expirationTtl ?? null }); },
    async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name, metadata: m.get(name).meta })), list_complete: true }; },
  };
}

/** Replaces globalThis.fetch. Resend calls are recorded; DoH calls answer from `zoneResolve`; web/RDAP from `web`. */
export function stubFetch({ resolve, web = () => ({ status: 200 }), rdap = () => null } = {}) {
  const sent = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith("https://api.resend.com/")) { sent.push({ ...JSON.parse(init.body), idem: init.headers?.["Idempotency-Key"] }); return new Response(JSON.stringify({ id: "re_test" }), { status: 200 }); }
    if (u.startsWith("https://cloudflare-dns.com/")) {
      const q = new URL(u);
      const type = q.searchParams.get("type");
      const r = resolve ? await resolve(q.searchParams.get("name"), type) : { status: 0, answers: [] };
      const code = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16 }[type];
      return new Response(JSON.stringify({ Status: r.status, Answer: r.answers.map((data) => ({ type: code, data })) }), { status: 200 });
    }
    if (u.startsWith("https://rdap.org/")) { const at = rdap(); return at ? new Response(JSON.stringify({ events: [{ eventAction: "expiration", eventDate: at }] }), { status: 200 }) : new Response("{}", { status: 404 }); }
    const w = web(u);
    if (w.throw) throw new TypeError("fetch failed");
    return new Response("ok", { status: w.status });
  };
  return { sent, restore: () => { globalThis.fetch = orig; } };
}

export function signStripe(payload, secret, t = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(payload);
  const sig = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return { raw, header: `t=${t},v1=${sig}` };
}

export function baseEnv(kv) {
  return { WATCHDOG: kv, STRIPE_WEBHOOK_SECRET: "whsec_test", RESEND_API_KEY: "re_test", WATCHDOG_SECRET: "test-secret", FROM_ADDRESS: "NeonKey <hello@neonkey.tech>", REPLY_TO: "hello@neonkey.tech", NOTIFY_TO: "hello@neonkey.tech", BCC_ADDRESS: "bcc@neonkey.test", ALLOW_LIVE: "true", PAYMENT_LINKS: "plink_month:monthly,plink_year:yearly", PORTAL_URL: "https://billing.stripe.com/p/login/test", PUBLIC_URL: "https://neonkey-watchdog.example.workers.dev", MAX_SUBREQUESTS: "45" };
}
