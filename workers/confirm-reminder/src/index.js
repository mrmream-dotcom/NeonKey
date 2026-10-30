// NeonKey "Unlock the Week" confirmation reminder worker.
//
// Kit (free plan) has no built-in confirmation reminder, no API to resend a confirmation
// email, and no API to confirm a subscriber. Re-adding someone to the same form through the
// API does not resend it either ("Subscribers already added to the specified form will not
// receive the Incentive Email again"). What Kit does do is send a new confirmation email when
// a person signs up to the opt-in again more than 12 hours after the last one. So:
//
//   cron (hourly)  -> list form subscribers in state "inactive" who joined 24-48h ago
//                  -> skip anyone already reminded (KV), re-check state in Kit
//                  -> send ONE NeonKey reminder via Resend, record it in KV forever
//   GET  /c?s&t    -> signed confirm page: the person's own browser re-submits Kit's form,
//                     so Kit itself emails a fresh confirmation link
//   GET  /u?s&t    -> signed unsubscribe page; POST /u?s&t unsubscribes in Kit (RFC 8058 one-click)
//   POST /test/<TEST_TOKEN>  test hook, only exists while the TEST_TOKEN secret is set
//
// Privacy: addresses are never logged and never stored. KV keys are SHA-256 hashes.

import { SUBJECT, renderReminder, renderPage, renderConfirmPage, renderStopPage } from "./email.js";

const KIT_API = "https://api.kit.com/v4";
const RESEND_API = "https://api.resend.com";
const HOUR = 3600 * 1000;
const WINDOW_START_H = 24; // remind no earlier than 24h after joining the form
const WINDOW_END_H = 48; // and give up after 48h
const MAX_SENDS_PER_RUN = 50;
const MAX_ATTEMPTS = 3;
const TEST_EMAIL = "mrmream2@gmail.com"; // the only address the test hook will ever touch

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runReminders(env, { now: event.scheduledTime || Date.now() }).then(
        (r) => console.log("reminder run", JSON.stringify(r)),
        (e) => console.log("reminder run failed", e && e.message ? e.message : "unknown")
      )
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (path === "/c" && request.method === "GET") return await handleConfirm(url, env);
      if (path === "/u" && (request.method === "GET" || request.method === "POST")) {
        return await handleStop(request, url, env);
      }
      if (path.startsWith("/test/") && request.method === "POST") {
        if (!env.TEST_TOKEN || !(await safeEqual(path.slice(6), env.TEST_TOKEN))) return notFound();
        return await handleTest(request, env);
      }
      return notFound();
    } catch (err) {
      console.log("unhandled error", err && err.message ? err.message : "unknown");
      return new Response("Internal error", { status: 500 });
    }
  },
};

// ------------------------------------------------------------------ cron ---

async function runReminders(env, { now, dryRun = false }) {
  const after = new Date(now - WINDOW_END_H * HOUR).toISOString();
  const before = new Date(now - WINDOW_START_H * HOUR).toISOString();
  const r = { window: { after, before }, candidates: 0, sent: 0, duplicate: 0, skipped: 0, failed: 0, would_send: 0 };

  let cursor = null;
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ status: "inactive", added_after: after, added_before: before, per_page: "500" });
    if (cursor) q.set("after", cursor);
    const res = await kitFetch(env, `/forms/${env.KIT_FORM_ID}/subscribers?${q}`);
    if (!res.ok) throw new Error(`kit list ${res.status}`);
    const data = await res.json();
    for (const s of data.subscribers || []) {
      const added = Date.parse(s.added_at || s.created_at || "");
      if (!(added >= now - WINDOW_END_H * HOUR && added <= now - WINDOW_START_H * HOUR)) continue;
      r.candidates++;
      if (r.sent >= MAX_SENDS_PER_RUN) break;
      const outcome = await remindOne(env, s, { dryRun });
      r[outcome] = (r[outcome] || 0) + 1;
    }
    const pg = data.pagination || {};
    if (!pg.has_next_page || !pg.end_cursor || r.sent >= MAX_SENDS_PER_RUN) break;
    cursor = pg.end_cursor;
  }
  return r;
}

// opts.keyPrefix / opts.allowActive exist only for the test hook.
async function remindOne(env, listed, { dryRun = false, keyPrefix = "remind", allowActive = false } = {}) {
  const email = normalizeEmail(listed.email_address);
  if (!email) return "skipped";
  const hash = await sha256Hex(email);
  const key = `${keyPrefix}:${hash}`;
  if (await env.REMINDED.get(key)) return "duplicate";

  // Re-check in Kit right before sending: never remind confirmed, unsubscribed, bounced or complained people.
  const res = await kitFetch(env, `/subscribers/${encodeURIComponent(String(listed.id))}`);
  if (!res.ok) return "skipped";
  const sub = ((await res.json().catch(() => null)) || {}).subscriber;
  if (!sub || normalizeEmail(sub.email_address) !== email) return "skipped";
  if (sub.state !== "inactive" && !(allowActive && sub.state === "active")) return "skipped";
  // Anyone who used the unsubscribe link on a reminder (belt and braces; Kit state covers it too).
  if (await env.REMINDED.get(`stop:${hash}`)) return "skipped";

  if (dryRun) return "would_send";

  await env.REMINDED.put(key, JSON.stringify({ status: "sending", at: new Date().toISOString() }));
  const sent = await sendReminder(env, { email, id: sub.id, firstName: sub.first_name, idempotencyKey: key });
  if (sent.ok) {
    await env.REMINDED.put(key, JSON.stringify({ status: "sent", at: new Date().toISOString(), resend_id: sent.id }));
    return "sent";
  }
  // Retry on a later run (inside the 24h Resend idempotency window), at most MAX_ATTEMPTS times.
  const attemptsKey = `attempts:${keyPrefix}:${hash}`;
  const attempts = Number((await env.REMINDED.get(attemptsKey)) || 0) + 1;
  if (attempts >= MAX_ATTEMPTS || (sent.status >= 400 && sent.status < 500 && sent.status !== 429)) {
    await env.REMINDED.put(key, JSON.stringify({ status: "gave_up", at: new Date().toISOString(), http: sent.status }));
  } else {
    await env.REMINDED.put(attemptsKey, String(attempts), { expirationTtl: 3 * 24 * 3600 });
    await env.REMINDED.delete(key);
  }
  console.log("resend send failed", sent.status);
  return "failed";
}

async function sendReminder(env, { email, id, firstName, idempotencyKey }) {
  const confirmUrl = `${env.PUBLIC_BASE_URL}/c?s=${id}&t=${await sign(env, `confirm:${id}`)}`;
  const stopUrl = `${env.PUBLIC_BASE_URL}/u?s=${id}&t=${await sign(env, `stop:${id}`)}`;
  const { html, text } = renderReminder({ firstName, confirmUrl, stopUrl });
  const res = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: env.FROM_ADDRESS,
      to: [email],
      reply_to: env.REPLY_TO,
      subject: SUBJECT,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${stopUrl}>, <mailto:${env.REPLY_TO}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [{ name: "type", value: "confirm_reminder" }],
    }),
  }).catch(() => null);
  if (!res) return { ok: false, status: 0 };
  const out = await res.json().catch(() => ({}));
  return { ok: res.ok && !!out.id, status: res.status, id: out.id };
}

// ---------------------------------------------------------- confirm page ---

async function handleConfirm(url, env) {
  const sub = await verifiedSubscriber(env, url, "confirm");
  if (sub === "invalid") {
    return page("That link didn't work", "This link looks incomplete. You can sign up again anytime at neonkey.tech/newsletter/.", 400);
  }
  if (!sub) return page("Something went wrong", "I couldn't load your signup just now. Please try the link again in a minute.", 502);
  if (sub.state === "active") {
    return page("You're already confirmed", "Your Unlock the Week subscription is confirmed. Nothing else to do.");
  }
  if (sub.state !== "inactive") {
    return page("This link is no longer active", "This signup was closed. If you'd like Unlock the Week, you can sign up again anytime at neonkey.tech/newsletter/.");
  }
  const kitFormAction = `https://app.kit.com/forms/${env.KIT_FORM_ID}/subscriptions`;
  return htmlResponse(renderConfirmPage({ email: sub.email_address, kitFormAction }));
}

// ------------------------------------------------------------ unsubscribe ---

async function handleStop(request, url, env) {
  const isPost = request.method === "POST";
  const sub = await verifiedSubscriber(env, url, "stop");
  if (sub === "invalid") {
    return isPost
      ? new Response("Invalid unsubscribe link", { status: 400 })
      : page("That link didn't work", "This unsubscribe link looks incomplete. Write to hello@neonkey.tech and I'll remove you by hand.", 400);
  }
  if (!sub) {
    return isPost
      ? new Response("Temporary error", { status: 502 })
      : page("Something went wrong", "I couldn't process that just now. Please try again in a minute, or write to hello@neonkey.tech.", 502);
  }
  if (!isPost) return htmlResponse(renderStopPage({ actionUrl: url.pathname + url.search }));

  const email = normalizeEmail(sub.email_address);
  if (email) await env.REMINDED.put(`stop:${await sha256Hex(email)}`, new Date().toISOString());
  if (sub.state !== "cancelled") {
    const res = await kitFetch(env, `/subscribers/${sub.id}/unsubscribe`, { method: "POST", body: "{}" });
    if (!res.ok && res.status !== 404) {
      return new Response("Temporary error", { status: 502 });
    }
  }
  const ct = request.headers.get("content-type") || "";
  const body = ct.includes("form") ? await request.text().catch(() => "") : "";
  if (body.includes("List-Unsubscribe=One-Click")) return new Response("Unsubscribed", { status: 200 });
  return page("You're unsubscribed", "You won't get any more emails from NeonKey. If that was a mistake, you can sign up again anytime at neonkey.tech.");
}

// Returns the Kit subscriber for a signed ?s=<id>&t=<sig> link, "invalid" for a bad link, or null on Kit errors.
async function verifiedSubscriber(env, url, purpose) {
  const id = url.searchParams.get("s") || "";
  const t = url.searchParams.get("t") || "";
  if (!/^\d{1,15}$/.test(id) || !t || !(await safeEqual(t, await sign(env, `${purpose}:${id}`)))) return "invalid";
  const res = await kitFetch(env, `/subscribers/${id}`);
  if (res.status === 404) return "invalid";
  if (!res.ok) return null;
  const sub = ((await res.json().catch(() => null)) || {}).subscriber;
  return sub && sub.email_address ? sub : null;
}

// ---------------------------------------------------------------- test hook ---
// POST /test/<TEST_TOKEN>  {"mode":"dry"}  -> real query, counts only, nothing sent or stored
//                          {"mode":"send"} -> runs the reminder for TEST_EMAIL only, ignoring the
//                                             24h window (and its confirmed state, since that
//                                             address is already confirmed). Separate KV prefix,
//                                             so a second call proves dedupe without a 2nd email.
// Locked by deleting the TEST_TOKEN secret.

async function handleTest(request, env) {
  const body = await request.json().catch(() => ({}));
  if (body.mode === "dry") {
    return json(await runReminders(env, { now: Date.now(), dryRun: true }));
  }
  if (body.mode === "send") {
    const res = await kitFetch(env, `/subscribers?status=all&email_address=${encodeURIComponent(TEST_EMAIL)}`);
    if (!res.ok) return json({ ok: false, kit: res.status }, 502);
    const sub = (((await res.json().catch(() => null)) || {}).subscribers || [])[0];
    if (!sub) return json({ ok: false, error: "test subscriber not found" }, 404);
    const outcome = await remindOne(env, sub, { keyPrefix: "test-remind", allowActive: true });
    return json({ ok: outcome === "sent" || outcome === "duplicate", outcome, kit_state: sub.state, subscriber_id: sub.id });
  }
  return json({ ok: false, error: "mode must be dry or send" }, 400);
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

function normalizeEmail(e) {
  const s = String(e || "").trim().toLowerCase();
  if (s.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(s)) return "";
  const domain = s.slice(s.indexOf("@") + 1);
  return domain.slice(1, -1).includes(".") ? s : "";
}

async function sign(env, msg) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.LINK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return base64url(new Uint8Array(sig));
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

async function safeEqual(a, b) {
  const k = await crypto.subtle.importKey("raw", crypto.getRandomValues(new Uint8Array(32)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
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
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

function page(title, message, status = 200) {
  return htmlResponse(renderPage(title, message), status);
}

function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}
