// neonkey-lockdown: runs the $49 Email Lockdown end to end with no manual step.
//   POST /webhook  Stripe checkout.session.completed / async_payment_succeeded for the Email Lockdown Payment Link only.
//                  Reads the domain the buyer typed at checkout, audits its public DNS, emails the buyer a branded
//                  report with the exact records, and emails hello@ (BCC Michael) a notice. ACTION NEEDED only when
//                  something can't be written safely (wrong domain, unusual provider, duplicate records, ...).
//   cron (daily)   rechecks open orders on day 2, 5 and 10: "locked down" email when everything passes, one friendly
//                  reminder on day 5, and an ACTION NEEDED notice to Michael if it's still open on day 10.
//   POST /webhook  charge.refunded for a Lockdown payment: marks the order refunded (stops rechecks) and sets the
//                  Lead Tracker row's Outcome to "refunded".
//   Lead Tracker   every paid order is written to the NeonKey Accounts sheet (see sheet.js); a failed write is retried
//                  by the daily cron.
//   GET  /health   { ok, live, customerEmails }
// Secrets (wrangler secret put, never committed): STRIPE_WEBHOOK_SECRET (this endpoint's own whsec_), RESEND_API_KEY,
//   BROWSER_TOKEN (optional: Cloudflare API token with Browser Rendering Edit; without it the report is sent as HTML),
//   GOOGLE_SA_KEY (optional: Google service account JSON key; without it the Lead Tracker sync is off).
// No Stripe API key: everything needed is in the signed webhook event.
import { verifyStripeEvent } from "./verify.js";
import { audit, cleanDomain, openItems } from "./audit.js";
import { reportEmail, doneEmail, reminderEmail, noticeEmail } from "./email.js";
import { renderReport, checks } from "./report.js";
import { renderPdf } from "./pdf.js";
import { recordPaid, recordRefund } from "./sheet.js";

const passingCount = (a) => checks(a).filter((c) => c.status === "ok").length;

// The branded report rides along as a PDF (Cloudflare Browser Rendering). If that isn't set up or fails,
// it falls back to the same report as an HTML file, which opens in any browser and prints to PDF.
function b64utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export async function reportAttachment(env, a, order) {
  const html = renderReport({ a, order });
  const pdf = await renderPdf(env, html);
  if (pdf) return { pdf: true, attachments: [{ filename: `NeonKey-Email-Report-${a.domain}.pdf`, content: pdf }] };
  return { pdf: false, attachments: [{ filename: `NeonKey-Email-Report-${a.domain}.html`, content: b64utf8(html) }] };
}

const DAY = 86400000;
export const RECHECK_DAYS = [2, 5, 10];
const ORDER_TTL = 180 * 86400; // KV keeps an order 180 days (covers the card-dispute window), then it expires on its own.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

    if (url.pathname === "/health" && request.method === "GET") return json(200, { ok: true, live: env.ALLOW_LIVE === "true", customerEmails: customerMode(env) });
    if (url.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } });
    if (url.pathname !== "/webhook") return json(404, { ok: false });
    if (request.method !== "POST") return json(405, { ok: false });

    const sig = request.headers.get("Stripe-Signature");
    if (!sig || !env.STRIPE_WEBHOOK_SECRET) return json(400, { ok: false });
    const raw = await request.text();
    if (raw.length > 512 * 1024) return json(413, { ok: false });
    let event;
    try {
      event = await verifyStripeEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      console.log("lockdown: bad webhook signature");
      return json(400, { ok: false });
    }
    if (event.livemode && env.ALLOW_LIVE !== "true") return json(200, { ok: true, ignored: "live" });

    const s = event.data?.object || {};
    if (event.type === "charge.refunded" && s.object === "charge") {
      const r = await handleRefund(env, s);
      return json(200, { ok: true, refund: r });
    }
    const relevant = (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") && s.object === "checkout.session";
    if (!relevant) return json(200, { ok: true, ignored: event.type });
    if (s.payment_link !== env.LOCKDOWN_PAYMENT_LINK) return json(200, { ok: true, ignored: "other_offer" });
    if (s.payment_status !== "paid") return json(200, { ok: true, ignored: "unpaid" }); // async methods arrive later as async_payment_succeeded

    const ok = await handleOrder(env, s, event.livemode);
    return ok ? json(200, { ok: true }) : json(500, { ok: false }); // 500 -> Stripe retries
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(recheckAll(env));
  },
};

export function customerMode(env) {
  return env.CUSTOMER_EMAILS === "send" ? "send" : "shadow";
}

function orderFromSession(s, livemode) {
  const field = (s.custom_fields || []).find((f) => f.key === "domain");
  const rawDomain = field?.text?.value || "";
  return {
    id: s.id,
    livemode: Boolean(livemode),
    email: (s.customer_details?.email || "").trim().toLowerCase(),
    name: s.customer_details?.name || "",
    business: s.customer_details?.business_name || "",
    rawDomain,
    domain: cleanDomain(rawDomain),
    created: Date.now(),
    paidAt: s.created ? s.created * 1000 : Date.now(),
    paymentIntent: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id || "",
    amount: typeof s.amount_total === "number" ? s.amount_total / 100 : null,
    checks: 0,
    status: "open",
  };
}

export async function handleOrder(env, s, livemode) {
  const key = `order:${s.id}`;
  const existing = await env.ORDERS.get(key, "json");
  if (existing && existing.reported) return true; // Stripe retry or the async event after completed: already done

  const order = existing || orderFromSession(s, livemode);
  order.customerMode = customerMode(env);
  if (!order.email) {
    await sendNotice(env, "error", order, null, "Stripe sent no buyer email on this checkout. Look it up in Stripe.");
    order.reported = true;
    await env.ORDERS.put(key, JSON.stringify(order), { expirationTtl: ORDER_TTL });
    return true;
  }

  let a;
  if (!order.domain) {
    a = { domain: order.rawDomain || "(blank)", provider: null, dnsHost: { label: null, help: null }, fixes: [], buyerSteps: [], human: [`The domain typed at checkout ("${order.rawDomain}") isn't a valid domain. Ask the buyer for it.`], notes: [], locked: false };
  } else {
    try {
      a = await audit(order.domain, { contactEmail: order.email });
    } catch (e) {
      console.log("lockdown: audit failed", String(e));
      return false; // DNS hiccup: let Stripe retry the webhook
    }
  }

  const audited = Boolean(order.domain && a.mx);
  if (audited) order.before = passingCount(a);
  const att = audited && (a.fixes.length || a.buyerSteps.length || a.locked) ? await reportAttachment(env, a, order) : null;
  const mail = reportEmail({ name: order.name, a, pdf: att?.pdf });
  if (att) mail.attachments = att.attachments;
  const sentBuyer = await sendCustomer(env, order, mail, `lockdown-report-${order.id}`);
  if (!sentBuyer) return false;
  const sentNotice = await sendNotice(env, "new", order, a);
  if (!sentNotice) console.log("lockdown: notice failed after buyer email");

  order.reported = true;
  order.lastOpen = a.fixes ? openItems(a) : [];
  // Nothing to recheck when the audit couldn't run on a real domain or a person has to take over entirely.
  if (!order.domain || (!a.fixes.length && !a.buyerSteps.length && !a.locked)) order.status = "human";
  else if (a.locked) order.status = "done"; // already fine: the first email said so, nothing to recheck
  await syncPaid(env, order);
  await env.ORDERS.put(key, JSON.stringify(order), { expirationTtl: ORDER_TTL });
  if (order.paymentIntent) await env.ORDERS.put(`pi:${order.paymentIntent}`, key, { expirationTtl: ORDER_TTL });
  return true;
}

// Lead Tracker writes never block or fail an order: on error the order is marked "pending" and the cron retries.
export async function syncPaid(env, order) {
  try {
    order.sheet = await recordPaid(env, order);
  } catch (e) {
    console.log("lockdown: lead tracker write failed", String(e));
    order.sheet = "pending";
  }
}
async function syncRefund(env, order) {
  try {
    order.sheetRefund = await recordRefund(env, order);
  } catch (e) {
    console.log("lockdown: lead tracker refund write failed", String(e));
    order.sheetRefund = "pending";
  }
}

// Full refund of a Lockdown payment (found by its payment intent). Partial refunds and other offers are ignored.
export async function handleRefund(env, charge) {
  if (!charge.refunded || !charge.payment_intent) return "ignored";
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent.id;
  const key = await env.ORDERS.get(`pi:${pi}`);
  const order = key && (await env.ORDERS.get(key, "json"));
  if (!order) return "unknown";
  if (order.refunded) return "already";
  order.refunded = true;
  order.status = "refunded"; // no more rechecks or reminders
  if (order.sheet === "pending") order.sheetRefund = "with-paid"; // the retried paid write carries "refunded"
  else await syncRefund(env, order);
  await env.ORDERS.put(key, JSON.stringify(order), { expirationTtl: ORDER_TTL });
  return "refunded";
}

// Which recheck is due: day 2, 5, 10 after the order. Returns the index into RECHECK_DAYS or -1.
export function dueCheck(order, now) {
  const next = order.checks || 0;
  if (next >= RECHECK_DAYS.length) return -1;
  return now - order.created >= RECHECK_DAYS[next] * DAY ? next : -1;
}

export async function recheckAll(env, now = Date.now()) {
  let cursor;
  do {
    const page = await env.ORDERS.list({ prefix: "order:", cursor });
    for (const k of page.keys) {
      const order = await env.ORDERS.get(k.name, "json");
      if (!order) continue;
      if (order.sheet === "pending" || order.sheetRefund === "pending") {
        if (order.sheet === "pending") await syncPaid(env, order);
        if (order.sheetRefund === "pending") await syncRefund(env, order);
        await env.ORDERS.put(k.name, JSON.stringify(order), { expirationTtl: ORDER_TTL });
      }
      if (order.status !== "open") continue;
      try {
        await recheckOne(env, k.name, order, now);
      } catch (e) {
        console.log("lockdown: recheck failed", k.name, String(e));
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

export async function recheckOne(env, key, order, now = Date.now()) {
  const i = dueCheck(order, now);
  if (i < 0) return "not_due";
  order.customerMode = customerMode(env);
  const a = await audit(order.domain, { contactEmail: order.email });
  order.checks = i + 1;
  let result = "quiet";

  if (a.locked) {
    const att = await reportAttachment(env, a, order);
    const mail = doneEmail({ name: order.name, a, before: order.before, pdf: att.pdf });
    mail.attachments = att.attachments;
    await sendCustomer(env, order, mail, `lockdown-done-${order.id}`);
    await sendNotice(env, "done", order, a);
    order.status = "done";
    result = "done";
  } else if (RECHECK_DAYS[i] === 5) {
    const att = await reportAttachment(env, a, order);
    const mail = reminderEmail({ name: order.name, a, passing: passingCount(a), pdf: att.pdf });
    mail.attachments = att.attachments;
    await sendCustomer(env, order, mail, `lockdown-remind-${order.id}`);
    await sendNotice(env, "reminder", order, a);
    result = "reminded";
  } else if (i === RECHECK_DAYS.length - 1) {
    await sendNotice(env, "stuck", order, a, `Still open after ${RECHECK_DAYS[i]} days: ${openItems(a).join(", ") || "see the human notes"}. Offer to add the records for them (they invite us as a helper on their DNS account), or check in by email.`);
    order.status = "human";
    result = "stuck";
  }
  order.lastOpen = openItems(a);
  await env.ORDERS.put(key, JSON.stringify(order), { expirationTtl: ORDER_TTL });
  return result;
}

async function resend(env, payload, idem) {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idem },
      body: JSON.stringify({ from: env.FROM_ADDRESS, ...(env.BCC_ADDRESS ? { bcc: [env.BCC_ADDRESS] } : {}), ...payload }),
    });
    if (!r.ok) console.log("lockdown: resend failed", r.status);
    return r.ok;
  } catch {
    console.log("lockdown: resend error");
    return false;
  }
}

// Buyer emails. In shadow mode they go to hello@ only, so Michael can read the first real ones before buyers do.
function sendCustomer(env, order, mail, idem) {
  const shadow = customerMode(env) !== "send";
  const test = order.livemode ? "" : "[TEST] ";
  return resend(env, {
    to: [shadow ? env.NOTIFY_TO : order.email],
    reply_to: env.REPLY_TO,
    subject: `${test}${shadow ? `[SHADOW for ${order.email}] ` : ""}${mail.subject}`,
    html: mail.html,
    text: mail.text,
    ...(mail.attachments ? { attachments: mail.attachments } : {}),
    tags: [{ name: "kind", value: "lockdown_customer" }],
  }, `${idem}${shadow ? "-shadow" : ""}`);
}

function sendNotice(env, kind, order, a, extra) {
  const n = noticeEmail({ kind, order, a, extra });
  return resend(env, {
    to: [env.NOTIFY_TO],
    ...(order.email ? { reply_to: order.email } : {}),
    subject: `${order.livemode ? "" : "[TEST] "}${n.subject}`,
    html: n.html,
    text: n.text,
    ...(n.urgent ? { headers: { "X-Priority": "1 (Highest)", Importance: "high", Priority: "urgent" } } : {}),
    tags: [{ name: "kind", value: "lockdown_notice" }],
  }, `lockdown-notice-${kind}-${order.id}-${order.checks || 0}`);
}
