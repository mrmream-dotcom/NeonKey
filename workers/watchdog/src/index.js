// NeonKey Founder Watchdog Worker ($9/mo or $90/yr, one domain).
//   POST /stripe   Stripe webhook (signature checked first): checkout.session.completed creates the subscriber,
//                  customer.subscription.updated/deleted pause or stop checks.
//   GET  /ack      "I meant to do this" page from an alert email (shows a confirm button; a GET never changes data,
//                  so link scanners can't trigger it). POST /ack applies it.
//   GET  /health   { ok, subscribers }
//   cron            every 10 minutes: works through subscribers that are due, inside a fixed subrequest budget.
// Storage: KV `acct:<stripe subscription id>` = the subscriber (email, domain, state). Metadata { n: next check ms,
// s: status } so a run can pick due subscribers from one list call. Canceled subscribers are deleted after 30 days.
// Secrets (set by Michael, never in the repo or chat): STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, WATCHDOG_SECRET.
import { verifyStripeEvent } from "./verify.js";
import {
  dohResolve, watchableDomain, Budget, BudgetError, budgeted, snapshot, step, acknowledge, health, webCheck, expiryCheck,
  expiryAlert, ownershipRecord, verifyOwnership, ackToken, sortAlerts, DAY,
} from "./engine.js";
import { dnsHostFromNs } from "./audit.js";
import { welcomeEmail, reminderEmail, startedEmail, alertEmail, recoveredEmail, monthlyEmail, needsDomainEmail, canceledEmail, adminEmail, esc } from "./email.js";

const MIN = 60000;
const HOUR = 60 * MIN;
const CONFIRM_DELAY = 15 * MIN; // second look before any alert
const KEEP_CANCELED = 30 * 86400; // seconds
const ACTIVE_SUB = new Set(["active", "trialing", "past_due"]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    if (url.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } });
    if (url.pathname === "/health" && request.method === "GET") {
      const list = await env.WATCHDOG.list({ prefix: "acct:" });
      return json(200, { ok: true, subscribers: list.keys.filter((k) => k.metadata?.s === "active").length });
    }
    if (url.pathname === "/stripe") {
      if (request.method !== "POST") return json(405, { ok: false });
      return handleStripe(request, env, json);
    }
    if (url.pathname === "/ack") return handleAck(request, env, url);
    return json(404, { ok: false });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runDue(env));
  },
};

// ---------------- Stripe ----------------

/** "plink_a:monthly,plink_b:yearly" -> { plink_a: "monthly", plink_b: "yearly" } */
export function paymentLinks(env) {
  const out = {};
  for (const part of String(env.PAYMENT_LINKS || "").split(",")) {
    const [id, plan] = part.split(":").map((x) => x && x.trim());
    if (id) out[id] = plan || "monthly";
  }
  return out;
}

export function isWatchdogCheckout(o, env) {
  if (!o || o.object !== "checkout.session" || o.mode !== "subscription" || !o.subscription) return false;
  if (o.status && o.status !== "complete") return false;
  return Boolean(paymentLinks(env)[o.payment_link] || o.metadata?.offer === "nk_watchdog");
}

const fieldValue = (o, key) => {
  const f = (o.custom_fields || []).find((x) => x.key === key);
  return f?.text?.value || f?.dropdown?.value || null;
};

async function handleStripe(request, env, json) {
  const sig = request.headers.get("Stripe-Signature");
  if (!sig || !env.STRIPE_WEBHOOK_SECRET) return json(400, { ok: false });
  const raw = await request.text();
  if (raw.length > 512 * 1024) return json(413, { ok: false });
  let event;
  try {
    event = await verifyStripeEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    console.log("watchdog: bad webhook signature");
    return json(400, { ok: false });
  }
  if (event.livemode && env.ALLOW_LIVE !== "true") return json(200, { ok: true, ignored: "live" });
  const o = event.data?.object;
  try {
    if (event.type === "checkout.session.completed" && isWatchdogCheckout(o, env)) return json(200, await onCheckout(env, event, o));
    if ((event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") && o?.id) return json(200, await onSubscription(env, event, o));
  } catch (e) {
    console.log("watchdog: webhook handling failed", String(e?.message || e));
    return json(500, { ok: false }); // Stripe retries
  }
  return json(200, { ok: true, ignored: event.type });
}

export async function onCheckout(env, event, o, now = Date.now()) {
  const id = o.subscription;
  const key = `acct:${id}`;
  if (await env.WATCHDOG.get(key)) return { ok: true, duplicate: true };
  const email = String(o.customer_details?.email || "").trim().toLowerCase();
  const given = fieldValue(o, "domain");
  const domain = watchableDomain(given);
  const plan = paymentLinks(env)[o.payment_link] || o.metadata?.plan || "monthly";
  const acct = { id, customer: o.customer || null, email, given, domain, plan, livemode: Boolean(event.livemode), status: domain ? "verifying" : "needs-domain", subStatus: "active", created: new Date(now).toISOString(), reminders: 0, alertsSent: 0 };
  const ctx = mailCtx(env);
  if (domain) {
    const record = await ownershipRecord(id, domain, env.WATCHDOG_SECRET);
    let host = { label: null, help: null };
    try { host = dnsHostFromNs((await dohResolve(domain, "NS")).answers); } catch { /* the email works without it */ }
    acct.nextAt = now + 10 * MIN;
    await save(env, acct);
    await send(env, { to: email, ...welcomeEmail({ domain, record, dnsHost: host.label, dnsHelp: host.help }, ctx) }, `wd-welcome-${id}`);
  } else {
    acct.nextAt = now + 365 * DAY;
    await save(env, acct);
    await send(env, { to: email, ...needsDomainEmail({ given }, ctx) }, `wd-needsdomain-${id}`);
  }
  await notify(env, domain ? `new subscriber (${plan})` : "new subscriber needs a domain", [`${event.livemode ? "" : "[TEST] "}New Founder Watchdog subscriber.`, `Email: ${email}`, `Domain: ${domain || `(not usable: "${given || ""}")`}`, `Plan: ${plan}`, `Subscription: ${id}`, domain ? "Next: nothing. They add one TXT record and checks start on their own." : `Next: reply to them for their domain, then set "domain" and status "verifying" on KV key ${key}.`], `wd-admin-new-${id}`);
  return { ok: true, created: id };
}

export async function onSubscription(env, event, o, now = Date.now()) {
  const key = `acct:${o.id}`;
  const acct = await load(env, key);
  if (!acct) return { ok: true, ignored: "not a watchdog subscription" };
  if (event.type === "customer.subscription.deleted" || o.status === "canceled") {
    if (acct.status === "canceled") return { ok: true, duplicate: true };
    acct.status = "canceled";
    acct.canceledAt = new Date(now).toISOString();
    acct.nextAt = now + 365 * DAY;
    await save(env, acct, KEEP_CANCELED);
    await send(env, { to: acct.email, ...canceledEmail({ domain: acct.domain }, mailCtx(env)) }, `wd-canceled-${acct.id}`);
    await notify(env, "subscriber canceled", [`Founder Watchdog subscription ended.`, `Email: ${acct.email}`, `Domain: ${acct.domain || "-"}`, `Subscription: ${acct.id}`], `wd-admin-cancel-${acct.id}`);
    return { ok: true, canceled: acct.id };
  }
  acct.subStatus = o.status;
  await save(env, acct);
  return { ok: true, subStatus: o.status };
}

// ---------------- scheduled checks ----------------

export async function runDue(env, { now = Date.now(), resolve = dohResolve, fetcher = fetch } = {}) {
  const budget = new Budget(Number(env.MAX_SUBREQUESTS || 45));
  const list = await env.WATCHDOG.list({ prefix: "acct:" });
  const due = list.keys
    .filter((k) => (k.metadata?.s === "verifying" || k.metadata?.s === "active") && Number(k.metadata?.n || 0) <= now)
    .sort((a, b) => Number(a.metadata.n) - Number(b.metadata.n));
  const done = [];
  for (const k of due) {
    // Leave room for the heaviest step (a first look needs about 35 subrequests); a smaller daily check needs about 15.
    const acct = await load(env, k.name);
    if (!acct) continue;
    const need = acct.status === "verifying" ? 3 : acct.state ? 24 : 36;
    if (budget.left() < need) break;
    try {
      await checkOne(env, acct, { now, budget, resolve: budgeted(resolve, budget), fetcher });
      done.push(acct.id);
    } catch (e) {
      if (e instanceof BudgetError) break; // nothing saved for this one; it's picked up next run
      console.log("watchdog: check failed", acct.id, String(e?.message || e));
      acct.nextAt = now + HOUR;
      acct.lastError = String(e?.message || e).slice(0, 200);
      await save(env, acct);
    }
  }
  return { checked: done, used: budget.used };
}

export async function checkOne(env, acct, { now, budget, resolve, fetcher }) {
  if (!ACTIVE_SUB.has(acct.subStatus || "active")) { acct.nextAt = now + 6 * HOUR; return save(env, acct); }
  if (acct.status === "verifying") return checkOwnership(env, acct, { now, budget, resolve, fetcher });
  if (acct.status !== "active") return;
  if (!acct.state) return firstLook(env, acct, { now, budget, resolve, fetcher });
  return dailyCheck(env, acct, { now, budget, resolve, fetcher });
}

async function checkOwnership(env, acct, { now, budget, resolve, fetcher }) {
  const ok = await verifyOwnership(acct.id, acct.domain, env.WATCHDOG_SECRET, resolve);
  if (ok) {
    acct.status = "active";
    acct.verifiedAt = new Date(now).toISOString();
    if (budget.left() >= 33) return firstLook(env, acct, { now, budget, resolve, fetcher });
    acct.nextAt = now; // first look next run
    return save(env, acct);
  }
  const age = now - Date.parse(acct.created);
  const record = await ownershipRecord(acct.id, acct.domain, env.WATCHDOG_SECRET);
  if ((age > 2 * DAY && acct.reminders === 0) || (age > 7 * DAY && acct.reminders === 1)) {
    acct.reminders += 1;
    budget.take(1);
    await send(env, { to: acct.email, ...reminderEmail({ domain: acct.domain, record }, mailCtx(env)) }, `wd-remind-${acct.id}-${acct.reminders}`);
    if (acct.reminders === 2) {
      budget.take(1);
      await notify(env, "subscriber still not verified after 7 days", [`${acct.email} (${acct.domain}) hasn't added the verification record after a week. They're paying but nothing is watched yet.`, `Next: reply to them and offer help, or refund. Subscription: ${acct.id}`], `wd-admin-stuck-${acct.id}`);
    }
  }
  acct.nextAt = now + (age < 2 * DAY ? HOUR : 6 * HOUR);
  return save(env, acct);
}

async function firstLook(env, acct, { now, budget, resolve, fetcher }) {
  const snap = await snapshot(acct.domain, { resolve, discover: true, now });
  const web = await webCheck(acct.domain, { fetcher, budget });
  const expiresAt = await expiryCheck(acct.domain, { fetcher, budget });
  acct.state = { last: snap, good: snap, open: [], selectors: Object.keys(snap.dkim || {}) };
  acct.web = { up: web.up, status: web.status, since: new Date(now).toISOString(), suspect: false };
  acct.expiry = { at: expiresAt, checkedAt: now, warned: [] };
  acct.lastReportAt = now;
  acct.alertsSent = 0;
  acct.nextAt = now + DAY;
  budget.take(2);
  await send(env, { to: acct.email, ...startedEmail({ domain: acct.domain, snap, problems: health(snap), web, expiresAt }, mailCtx(env)) }, `wd-started-${acct.id}`);
  await notify(env, `now watching ${acct.domain}`, [`${acct.email} verified ${acct.domain}. First look sent.`, `Problems today: ${health(snap).map((x) => x.text).join(" ") || "none"}`, `Homepage: ${web.up ? "up" : "down"}. Expires: ${expiresAt || "not published"}.`], `wd-admin-verified-${acct.id}`);
  return save(env, acct);
}

/**
 * Daily: DNS snapshot, homepage, and (weekly) expiry. Any new DNS or homepage problem is re-checked 15 minutes later and
 * only emailed if it is still there (pending round).
 */
async function dailyCheck(env, acct, { now, budget, resolve, fetcher }) {
  const ctx = mailCtx(env);
  const snap = await snapshot(acct.domain, { resolve, selectors: acct.state.selectors || [], now });
  const r = step(acct.state, snap);
  const web = await webCheck(acct.domain, { fetcher, budget });
  const webAlert = acct.web?.up !== false && !web.up ? { severity: "critical", id: "web-down", title: `${acct.domain} isn't loading`, detail: web.status ? `Your homepage answered with an error (HTTP ${web.status}).` : "Your homepage didn't load over HTTPS. That can mean the site is down, the domain isn't pointing at it, or the security certificate expired.", fix: "Open the site in a browser. If it's down for you too, check with your website host; if it shows a certificate warning, renew the certificate there." } : null;
  const candidates = [...r.alerts, ...(webAlert ? [webAlert] : [])];
  const pendingIds = new Set(acct.pending?.ids || []);

  if (candidates.length && !acct.pending) {
    acct.pending = { ids: candidates.map((a) => a.id), at: now };
    acct.nextAt = now + CONFIRM_DELAY;
    return save(env, acct);
  }

  let toSend = candidates.filter((a) => pendingIds.has(a.id));
  const fresh = candidates.filter((a) => !pendingIds.has(a.id));
  if (fresh.length) {
    // Something new appeared during the second look: start a fresh confirmation round for everything still showing.
    acct.pending = { ids: candidates.map((a) => a.id), at: now };
    acct.nextAt = now + CONFIRM_DELAY;
    return save(env, acct);
  }
  acct.pending = null;

  // Commit the DNS state. Alerts that didn't confirm are dropped (step() will raise them again if they come back).
  acct.state = { ...r.state, selectors: acct.state.selectors, open: r.state.open.filter((id) => toSend.some((a) => a.id === id) || (acct.state.open || []).includes(id)) };

  // Homepage state
  const wasDown = acct.web?.up === false;
  acct.web = { up: web.up, status: web.status, since: wasDown === !web.up ? acct.web?.since : new Date(now).toISOString() };

  // Expiry, weekly
  if (!acct.expiry || now - Number(acct.expiry.checkedAt || 0) > 7 * DAY) {
    const at = await expiryCheck(acct.domain, { fetcher, budget });
    acct.expiry = { at: at || acct.expiry?.at || null, checkedAt: now, warned: at && at !== acct.expiry?.at ? [] : acct.expiry?.warned || [] };
  }
  const ex = expiryAlert(acct.domain, acct.expiry?.at, acct.expiry?.warned || [], now);
  if (ex) { toSend.push(ex.alert); acct.expiry.warned = [...(acct.expiry.warned || []), ex.level]; }

  toSend = sortAlerts(toSend);
  if (toSend.length) {
    budget.take(1);
    const ackUrl = toSend.some((a) => a.id !== "web-down" && !a.id.startsWith("expiry")) ? await ackLink(env, acct.id) : null;
    await send(env, { to: acct.email, ...alertEmail({ domain: acct.domain, alerts: toSend, ackUrl }, ctx) }, `wd-alert-${acct.id}-${now}`);
    acct.alertsSent = (acct.alertsSent || 0) + 1;
    acct.lastAlertAt = now;
  }
  if (r.resolved && !toSend.length) { budget.take(1); await send(env, { to: acct.email, ...recoveredEmail({ domain: acct.domain, what: "your email and DNS records" }, ctx) }, `wd-ok-dns-${acct.id}-${now}`); }
  if (wasDown && web.up) { budget.take(1); await send(env, { to: acct.email, ...recoveredEmail({ domain: acct.domain, what: "your homepage" }, ctx) }, `wd-ok-web-${acct.id}-${now}`); }

  if (now - Number(acct.lastReportAt || 0) > 30 * DAY && budget.left() >= 1) {
    budget.take(1);
    await send(env, { to: acct.email, ...monthlyEmail({ domain: acct.domain, snap, problems: health(snap), web, expiresAt: acct.expiry?.at, alertsSent: acct.alertsSent || 0 }, ctx) }, `wd-monthly-${acct.id}-${new Date(now).toISOString().slice(0, 7)}`);
    acct.lastReportAt = now;
    acct.alertsSent = 0;
  }
  acct.lastCheckAt = now;
  acct.nextAt = now + (web.up ? DAY : 6 * HOUR);
  return save(env, acct);
}

// ---------------- "I meant to do this" ----------------

async function ackLink(env, id) {
  return `${env.PUBLIC_URL}/ack?a=${encodeURIComponent(id)}&t=${await ackToken(id, env.WATCHDOG_SECRET)}`;
}

async function handleAck(request, env, url) {
  const page = (title, body, status = 200) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} | Founder Watchdog</title><style>body{margin:0;background:#0b0d17;color:#e8eaf6;font:16px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif}main{max-width:560px;margin:10vh auto;padding:0 20px}button{background:#22d3ee;color:#0b0d17;border:0;border-radius:10px;padding:12px 18px;font-weight:700;font-size:16px;cursor:pointer}a{color:#22d3ee}</style></head><body><main><h1>${esc(title)}</h1>${body}</main></body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer" } });
  let a, t;
  if (request.method === "POST") {
    const f = await request.formData();
    a = String(f.get("a") || ""); t = String(f.get("t") || "");
  } else if (request.method === "GET") {
    a = url.searchParams.get("a") || ""; t = url.searchParams.get("t") || "";
  } else return page("Not allowed", "<p>Use the link in your alert email.</p>", 405);
  if (!/^sub_[A-Za-z0-9]{6,80}$/.test(a) || !/^[0-9a-f]{32}$/.test(t) || t !== (await ackToken(a, env.WATCHDOG_SECRET))) return page("Link not valid", "<p>This link doesn't match an alert. Reply to the alert email and we'll help.</p>", 400);
  const acct = await load(env, `acct:${a}`);
  if (!acct || acct.status !== "active" || !acct.state) return page("Nothing to update", "<p>We couldn't find an active Watchdog for this link.</p>", 404);
  if (request.method === "GET") return page("Did you make this change on purpose?", `<p>If yes, we'll treat the current setup of <strong>${esc(acct.domain)}</strong> as normal and stop warning about it. We'll still alert you about anything that changes after this.</p><form method="post" action="/ack"><input type="hidden" name="a" value="${esc(a)}"><input type="hidden" name="t" value="${esc(t)}"><button type="submit">Yes, I meant to do this</button></form>`);
  acct.state = acknowledge(acct.state);
  acct.ackedAt = new Date().toISOString();
  await save(env, acct);
  return page("Got it", `<p>The current setup of <strong>${esc(acct.domain)}</strong> is now the normal one. We'll keep watching for anything that changes from here.</p>`);
}

// ---------------- storage and email helpers ----------------

async function load(env, key) {
  const v = await env.WATCHDOG.get(key);
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

async function save(env, acct, ttl) {
  const opts = { metadata: { n: Number(acct.nextAt || 0), s: acct.status } };
  if (ttl) opts.expirationTtl = ttl;
  await env.WATCHDOG.put(`acct:${acct.id}`, JSON.stringify(acct), opts);
}

const mailCtx = (env) => ({ portal: env.PORTAL_URL || null, address: env.MAILING_ADDRESS || null });

async function notify(env, subject, lines, idem) {
  return send(env, { to: env.NOTIFY_TO, ...adminEmail(subject, lines), internal: true }, idem);
}

/** Resend send with an idempotency key, so a Stripe retry or a re-run never sends the same email twice. */
export async function send(env, msg, idem) {
  if (!env.RESEND_API_KEY) { console.log("watchdog: no RESEND_API_KEY, email skipped", msg.subject); return false; }
  if (env.SEND_EMAILS === "off") { console.log("watchdog: SEND_EMAILS off, skipped", msg.subject); return false; }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", ...(idem ? { "Idempotency-Key": String(idem).slice(0, 256) } : {}) },
      body: JSON.stringify({
        from: env.FROM_ADDRESS,
        to: [msg.to],
        ...(env.BCC_ADDRESS && !msg.internal ? { bcc: [env.BCC_ADDRESS] } : {}),
        reply_to: env.REPLY_TO,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        tags: [{ name: "kind", value: msg.internal ? "watchdog_admin" : "watchdog" }],
      }),
    });
    if (!r.ok) console.log("watchdog: resend failed", r.status);
    return r.ok;
  } catch {
    console.log("watchdog: resend error");
    return false;
  }
}
