// NeonKey "Unlock the Week" welcome worker.
//
// Routes:
//   POST /kit/<WEBHOOK_PATH_TOKEN>      Kit webhook (subscriber.subscriber_activate)
//   GET|POST /unsubscribe?e=..&t=..     HMAC-signed unsubscribe (GET page + RFC 8058 one-click POST)
//   anything else                        404
//
// Privacy: subscriber email addresses are never logged. The KV dedupe key is a
// SHA-256 hash of the normalized address, never the address itself.

import { SUBJECT, renderWelcome, renderPage } from "./email.js";

const KIT_API = "https://api.kit.com/v4";
const RESEND_API = "https://api.resend.com";
const MAX_EVENTS_PER_REQUEST = 25;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path.startsWith("/kit/") && request.method === "POST") {
        const token = path.slice("/kit/".length);
        if (!env.WEBHOOK_PATH_TOKEN || !(await safeEqual(token, env.WEBHOOK_PATH_TOKEN))) {
          return notFound();
        }
        return await handleKitWebhook(request, env);
      }

      if (path === "/unsubscribe" && (request.method === "GET" || request.method === "POST")) {
        return await handleUnsubscribe(request, url, env);
      }

      return notFound();
    } catch (err) {
      console.log("unhandled error", err && err.message ? err.message : "unknown");
      return new Response("Internal error", { status: 500 });
    }
  },
};

// ---------------------------------------------------------------- webhook ---

async function handleKitWebhook(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const candidates = extractSubscribers(body).slice(0, MAX_EVENTS_PER_REQUEST);
  const results = { received: candidates.length, sent: 0, duplicate: 0, skipped: 0, failed: 0 };

  for (const s of candidates) {
    const outcome = await processSubscriber(s, env);
    results[outcome] = (results[outcome] || 0) + 1;
  }

  console.log("kit webhook processed", JSON.stringify(results));
  // Legacy Kit webhooks do not retry, so a 5xx gains nothing; still surface failures.
  return json({ ok: results.failed === 0, ...results }, results.failed ? 500 : 200);
}

// Supports both the legacy /v4/webhooks payload ({ subscriber: {...} })
// and the newer webhook-endpoints envelope ({ events: [{ type, data: { subscriber } }] }).
function extractSubscribers(body) {
  const out = [];
  if (body && typeof body === "object") {
    if (body.subscriber && typeof body.subscriber === "object") out.push(body.subscriber);
    if (Array.isArray(body.events)) {
      for (const ev of body.events) {
        if (ev && ev.type === "subscriber.activated" && ev.data && ev.data.subscriber) {
          out.push(ev.data.subscriber);
        }
      }
    }
  }
  return out.filter((s) => s && (typeof s.id === "number" || /^\d+$/.test(String(s.id))));
}

async function processSubscriber(payloadSub, env) {
  // 1. Re-fetch from Kit: never trust the webhook body alone.
  const res = await kitFetch(env, `/subscribers/${encodeURIComponent(String(payloadSub.id))}`);
  if (!res.ok) {
    console.log("kit recheck failed", res.status);
    return "skipped";
  }
  const data = await res.json().catch(() => null);
  const sub = data && data.subscriber;
  if (!sub || sub.state !== "active" || !sub.email_address) {
    console.log("kit recheck: subscriber not active");
    return "skipped";
  }
  const email = normalizeEmail(sub.email_address);
  if (payloadSub.email_address && normalizeEmail(payloadSub.email_address) !== email) {
    console.log("kit recheck: email mismatch");
    return "skipped";
  }

  // 2. Dedupe: one welcome per address, ever.
  const key = `welcome:${await sha256Hex(email)}`;
  if (await env.WELCOME_SENT.get(key)) return "duplicate";
  await env.WELCOME_SENT.put(key, JSON.stringify({ status: "sending", at: new Date().toISOString() }));

  // 3. Send.
  const sent = await sendWelcome(env, { email, firstName: sub.first_name, idempotencyKey: key });
  if (!sent.ok) {
    await env.WELCOME_SENT.delete(key);
    console.log("resend send failed", sent.status);
    return "failed";
  }
  await env.WELCOME_SENT.put(
    key,
    JSON.stringify({ status: "sent", at: new Date().toISOString(), resend_id: sent.id })
  );
  return "sent";
}

async function sendWelcome(env, { email, firstName, idempotencyKey }) {
  const unsubscribeUrl = await buildUnsubscribeUrl(env, email);
  const { html, text } = renderWelcome({ firstName, unsubscribeUrl });

  const headers = {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: env.FROM_ADDRESS,
      to: [email],
      reply_to: env.REPLY_TO,
      subject: SUBJECT,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${env.REPLY_TO}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [{ name: "type", value: "welcome" }],
    }),
  });
  const out = await res.json().catch(() => ({}));
  return { ok: res.ok && !!out.id, status: res.status, id: out.id };
}

// ------------------------------------------------------------ unsubscribe ---

async function handleUnsubscribe(request, url, env) {
  const isOneClick = request.method === "POST";
  const e = url.searchParams.get("e") || "";
  const t = url.searchParams.get("t") || "";
  const email = normalizeEmail(e);

  const valid = email && t && (await safeEqual(t, await unsubToken(env, email)));
  if (!valid) {
    return isOneClick
      ? new Response("Invalid unsubscribe link", { status: 400 })
      : html(
          renderPage(
            "That link didn't work",
            "This unsubscribe link looks incomplete or invalid. Reply to any NeonKey email or write to hello@neonkey.tech and I'll remove you by hand."
          ),
          400
        );
  }

  const lookup = await kitFetch(
    env,
    `/subscribers?status=all&email_address=${encodeURIComponent(email)}`
  );
  if (!lookup.ok) return unsubError(isOneClick);
  const list = await lookup.json().catch(() => null);
  const sub = list && Array.isArray(list.subscribers) ? list.subscribers[0] : null;

  if (sub && sub.state !== "cancelled") {
    const res = await kitFetch(env, `/subscribers/${sub.id}/unsubscribe`, {
      method: "POST",
      body: "{}",
    });
    if (!res.ok && res.status !== 404) return unsubError(isOneClick);
  }
  // Not found or already cancelled: treat as success (idempotent).

  if (isOneClick) return new Response("Unsubscribed", { status: 200 });
  return html(
    renderPage(
      "You're unsubscribed",
      "You won't get any more Unlock the Week emails from NeonKey. If that was a mistake, you can sign up again anytime at neonkey.tech."
    )
  );
}

function unsubError(isOneClick) {
  if (isOneClick) return new Response("Temporary error", { status: 502 });
  return html(
    renderPage(
      "Something went wrong",
      "I couldn't process your unsubscribe just now. Please try the link again in a minute, or write to hello@neonkey.tech and I'll remove you by hand."
    ),
    502
  );
}

async function buildUnsubscribeUrl(env, email) {
  const t = await unsubToken(env, email);
  return `${env.PUBLIC_BASE_URL}/unsubscribe?e=${encodeURIComponent(email)}&t=${t}`;
}

async function unsubToken(env, email) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.UNSUB_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`unsub:${email}`));
  return base64url(new Uint8Array(sig));
}

// ---------------------------------------------------------------- helpers ---

function kitFetch(env, path, init = {}) {
  return fetch(`${KIT_API}${path}`, {
    ...init,
    headers: {
      "X-Kit-Api-Key": env.KIT_API_KEY,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

// Same rule as /^[^\s@]+@[^\s@]+\.[^\s@]+$/ (a dot inside the domain), but checked
// without a backtracking regex and with the length cap first (avoids polynomial ReDoS).
function normalizeEmail(e) {
  const s = String(e || "").trim().toLowerCase();
  if (s.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(s)) return "";
  const domain = s.slice(s.indexOf("@") + 1);
  return domain.slice(1, -1).includes(".") ? s : "";
}

async function sha256Hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Constant-time comparison via HMAC of both sides.
async function safeEqual(a, b) {
  const k = await crypto.subtle.importKey(
    "raw",
    crypto.getRandomValues(new Uint8Array(32)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.sign("HMAC", k, enc.encode(String(a))),
    crypto.subtle.sign("HMAC", k, enc.encode(String(b))),
  ]);
  const xa = new Uint8Array(x);
  const ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i];
  return diff === 0;
}

function notFound() {
  return new Response("Not found", { status: 404 });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
