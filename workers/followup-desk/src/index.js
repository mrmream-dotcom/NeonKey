// neonkey-followup-desk: the self-serve Follow-Up Desk. Nobody at NeonKey has to touch an account.
//   POST /stripe          Stripe checkout.session.completed for the Follow-Up Desk Payment Link -> account + private
//                         dashboard link emailed to the buyer. customer.subscription.updated/deleted -> billing state.
//   GET  /d/<token>       the owner's dashboard (setup, add follow-ups, paste a list, Won/Lost/Stop, settings).
//   POST /d/<token>/...   dashboard forms (no JavaScript).
//   GET/POST /login       "email me a new link" (buyer email only; never says whether an account exists).
//   GET/POST /u/<a>/<i>   recipient "stop these emails" (also the one-click List-Unsubscribe target).
//   GET/POST /a/<a>/<i>/<yes|ask>  the customer's one-tap buttons: GET shows a short form (so link scanners can't
//                         trigger it), POST tells the owner right away and stops that job's follow-ups.
//   POST /resend          Resend webhook: email.bounced / email.complained -> that follow-up stops.
//   email()               Cloudflare Email Routing catch-all for DESK_DOMAIN: a reply to r-<acct>-<item>@ stops
//                         that job and is passed straight to the owner (hit Reply to answer the customer).
//   cron (hourly)         weekday 9-noon in each owner's time zone: send due follow-ups (max DAILY_CAP a day).
//                         Monday 8 AM: the weekly report. Daily: prune closed jobs, delete accounts 30 days after cancel.
//   GET  /health          { ok, live }
// Secrets (wrangler secret put, never committed): STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, RESEND_WEBHOOK_SECRET.
import PostalMime from "postal-mime";
import { verifyStripeEvent, verifyResendEvent } from "./verify.js";
import {
  DAY, MAX_OPEN, DAILY_CAP, REPORT_HOUR, KINDS, DEFAULT_TEMPLATES, TIMEZONES,
  isEmail, oneLine, clean, validDays, parseDate, parseList, normAmount, randomId, isDue, inSendWindow, localParts,
  validPayUrl, NUDGE_DAYS,
} from "./engine.js";
import { getAccount, putAccount, setStatus, accountByToken, issueToken, createAccount, deleteAccount, prune } from "./store.js";
import { welcomeEmail, linkEmail, reportEmail, forwardEmail, actionEmail, nudgeEmail, sendOwner, sendNotice, sendFollowUp } from "./mail.js";
import { alert, health, hourly as runHourly } from "./ops.js";
import { CSS, dashboardPage, settingsPage, loginPage, unsubPage, actionPage, notFoundPage, deskState } from "./pages.js";

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
};
const html = (body, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS } });
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const redirect = (to) => new Response(null, { status: 303, headers: { Location: to, ...SECURITY_HEADERS } });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    try {
      if (path === "/health") { const h = await health(env); return json(h.ok ? 200 : 503, h); }
      if (path === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } });
      if (path === "/app.css") return new Response(CSS, { headers: { "Content-Type": "text/css", "Cache-Control": "public, max-age=3600" } });
      if (path === "/" ) return redirect("/login");
      if (path === "/stripe" && method === "POST") return await stripeWebhook(request, env);
      if (path === "/resend" && method === "POST") return await resendWebhook(request, env);
      if (path === "/login") return await login(request, env, ctx);
      let m = path.match(/^\/u\/([a-z0-9]{12})\/([a-z0-9]{9})$/);
      if (m) return await unsubscribe(request, env, m[1], m[2]);
      m = path.match(/^\/a\/([a-z0-9]{12})\/([a-z0-9]{9}|test)\/(yes|ask)$/);
      if (m) return await customerAction(request, env, m[1], m[2], m[3]);
      m = path.match(/^\/d\/([A-Za-z0-9_-]{40,50})(?:\/([a-z]+))?$/);
      if (m) return await dashboard(request, env, m[1], m[2] || "");
      return html(notFoundPage(), 404);
    } catch (e) {
      const where = path.replace(/^\/d\/[^/]+/, "/d/<link>"); // never log or email the private dashboard token
      console.log("desk: error", method, where, String(e));
      ctx.waitUntil(alert(env, `Request ${method} ${where} failed`, String(e)));
      return json(500, { ok: false });
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(hourly(env, controller.scheduledTime || Date.now()));
  },

  async email(message, env) {
    try {
      await inbound(message, env);
    } catch (e) {
      console.log("desk: inbound failed", String(e));
      await alert(env, "Incoming email failed (a reply may not have stopped its follow-ups)", String(e));
      throw e;
    }
  },
};

// ---------- Stripe ----------
async function stripeWebhook(request, env) {
  const sig = request.headers.get("Stripe-Signature");
  if (!sig || !env.STRIPE_WEBHOOK_SECRET) return json(400, { ok: false });
  const raw = await request.text();
  if (raw.length > 512 * 1024) return json(413, { ok: false });
  let event;
  try {
    event = await verifyStripeEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return json(400, { ok: false });
  }
  if (event.livemode && env.ALLOW_LIVE !== "true") return json(200, { ok: true, ignored: "live" });
  const o = event.data?.object || {};

  if (event.type === "checkout.session.completed" && o.object === "checkout.session") {
    if (!deskLinks(env).includes(o.payment_link)) return json(200, { ok: true, ignored: "other_offer" });
    if (o.status !== "complete") return json(200, { ok: true, ignored: "incomplete" });
    const r = await handleSignup(env, o, event.livemode);
    return r ? json(200, { ok: true }) : json(500, { ok: false }); // 500 -> Stripe retries
  }
  if ((event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") && o.object === "subscription") {
    const r = await handleSubscription(env, o, event.type === "customer.subscription.deleted");
    return json(200, { ok: true, subscription: r });
  }
  return json(200, { ok: true, ignored: event.type });
}

/** DESK_PAYMENT_LINK may list several Payment Link ids, comma-separated (regular, founding monthly, founding yearly). */
export function deskLinks(env) {
  return String(env.DESK_PAYMENT_LINK || "").split(",").map((x) => x.trim()).filter(Boolean);
}

export async function handleSignup(env, s, livemode) {
  if (await env.DESK.get(`sess:${s.id}`)) return true; // re-delivered event
  const email = (s.customer_details?.email || "").trim().toLowerCase();
  if (!isEmail(email)) {
    await sendNotice(env, "error", { email, name: s.customer_details?.name, livemode }, `Checkout ${s.id} has no usable buyer email. Find the buyer in Stripe and send them a link.`);
    await env.DESK.put(`sess:${s.id}`, "noemail", { expirationTtl: 90 * 86400 });
    return true;
  }
  const field = (s.custom_fields || []).find((f) => f.key === "business");
  const business = oneLine(field?.text?.value || s.customer_details?.business_name || "", 60);
  const sub = typeof s.subscription === "string" ? s.subscription : s.subscription?.id || "";
  const customer = typeof s.customer === "string" ? s.customer : s.customer?.id || "";

  // Same buyer signing up again (say, after canceling): reuse the account so their list and settings come back.
  const existingId = await env.DESK.get(`email:${email}`);
  const existing = existingId && (await getAccount(env, existingId));
  let acct, token;
  if (existing) {
    acct = existing;
    acct.billing = "active";
    delete acct.canceledAt;
    if (sub && sub !== acct.subscription) {
      if (acct.subscription) await env.DESK.delete(`sub:${acct.subscription}`);
      acct.subscription = sub;
      await env.DESK.put(`sub:${sub}`, acct.id);
    }
    if (customer) acct.customer = customer;
    token = await issueToken(env, acct);
    await putAccount(env, acct);
    await env.DESK.put(`sess:${s.id}`, acct.id, { expirationTtl: 90 * 86400 });
  } else {
    ({ acct, token } = await createAccount(env, { email, name: s.customer_details?.name || "", business, customer, subscription: sub, session: s.id, livemode }));
  }
  const ok = await sendOwner(env, acct, welcomeEmail({ name: acct.name, link: `${env.APP_URL}/d/${token}` }), `desk-welcome-${s.id}`, { to: acct.email });
  if (!ok) {
    await env.DESK.delete(`sess:${s.id}`); // let Stripe retry the whole thing
    return false;
  }
  await sendNotice(env, "new", acct, existing ? "Returning customer: their old list and settings were kept." : "");
  return true;
}

export async function handleSubscription(env, sub, deleted) {
  const id = await env.DESK.get(`sub:${sub.id}`);
  const acct = id && (await getAccount(env, id));
  if (!acct) return "unknown";
  const before = acct.billing;
  acct.billing = deleted ? "canceled" : sub.status === "trialing" ? "trialing" : sub.status === "active" ? "active" : sub.status || "unknown";
  if (acct.billing === "canceled" && !acct.canceledAt) acct.canceledAt = Date.now();
  if (acct.billing !== "canceled") delete acct.canceledAt;
  await putAccount(env, acct);
  if (before !== acct.billing) await sendNotice(env, acct.billing === "canceled" ? "canceled" : "billing", acct, `Billing went from ${before} to ${acct.billing}.${acct.billing === "canceled" ? " Data is deleted on its own in 30 days." : ""}`);
  return acct.billing;
}

// ---------- Resend (bounces and spam complaints) ----------
async function resendWebhook(request, env) {
  const raw = await request.text();
  if (raw.length > 256 * 1024) return json(413, { ok: false });
  let event;
  try {
    event = await verifyResendEvent(raw, request.headers, env.RESEND_WEBHOOK_SECRET);
  } catch {
    return json(400, { ok: false });
  }
  const r = await handleDeliveryEvent(env, event);
  return json(200, { ok: true, result: r });
}

export async function handleDeliveryEvent(env, event) {
  if (!["email.bounced", "email.complained"].includes(event.type)) return "ignored";
  const raw = event.data?.tags;
  const tags = Array.isArray(raw) ? Object.fromEntries(raw.map((t) => [t.name, t.value])) : raw || {};
  const acct = tags.acct && (await getAccount(env, tags.acct));
  if (!acct || !tags.item) return "unknown";
  const bounced = event.type === "email.bounced";
  const item = await setStatus(env, acct, tags.item, bounced ? "bounced" : "stopped", bounced ? "Email couldn't be delivered" : "Marked as spam by the recipient");
  if (!item) return "unknown";
  await putAccount(env, acct);
  return bounced ? "bounced" : "stopped";
}

// ---------- replies (Cloudflare Email Routing) ----------
const AUTO_SUBJECT = /^(automatic reply|auto(matic)?[- ]?reply|out of (the )?office|ooo\b|away from|autoreply|i am out|i'm out)/i;

export async function inbound(message, env) {
  const to = String(message.to || "").toLowerCase();
  const m = to.match(/^r-([a-z0-9]{12})-([a-z0-9]{9}|test)@/);
  const acct = m && (await getAccount(env, m[1]));
  if (!acct) { message.setReject?.("Unknown address"); return "unknown"; }
  const itemId = m[2];
  const item = itemId === "test" ? { id: "test", name: "Preview customer", email: acct.settings.replyTo, job: "the preview" } : acct.items.find((i) => i.id === itemId);
  if (!item) { message.setReject?.("Unknown address"); return "unknown"; }

  const parsed = await PostalMime.parse(message.raw);
  const from = parsed.from?.address ? `${parsed.from.name ? parsed.from.name + " " : ""}<${parsed.from.address}>` : String(message.from || "");
  const fromAddr = (parsed.from?.address || message.from || "").toLowerCase();
  const subject = oneLine(parsed.subject || "", 200);
  const header = (k) => parsed.headers?.find((h) => h.key === k)?.value || message.headers?.get?.(k) || "";
  const auto = /auto-(replied|generated)/i.test(header("auto-submitted")) || /auto_reply|bulk|junk/i.test(header("precedence")) || Boolean(header("x-autoreply") || header("x-autorespond")) || AUTO_SUBJECT.test(subject);
  const unsubscribe = !auto && /^\s*(stop|unsubscribe)\s*$/i.test(subject) && !(parsed.text || "").trim();
  const owner = fromAddr && fromAddr === String(acct.settings.replyTo || "").toLowerCase() && itemId !== "test";

  if (owner) {
    // The owner replied to their own copy (BCC). That reply never reached the customer: tell them so.
    await sendOwner(env, acct, {
      subject: `Your reply didn't reach ${item.name || item.email}`,
      text: `You replied to your copy of a follow-up, so it came to the Follow-Up Desk instead of your customer. To answer ${item.name || ""} directly, email ${item.email}.\n\nYour message:\n${(parsed.text || "").slice(0, 5000)}`,
      html: `<p>You replied to your copy of a follow-up, so it came to the Follow-Up Desk instead of your customer. To answer ${escText(item.name || "")} directly, email <a href="mailto:${escText(item.email)}">${escText(item.email)}</a>.</p>`,
    }, undefined, { bcc: false });
    return "owner";
  }

  if (!auto && itemId !== "test") {
    await setStatus(env, acct, item.id, unsubscribe ? "stopped" : "replied", unsubscribe ? "Asked to stop" : "");
    await putAccount(env, acct);
  }

  // Pass the reply on. Attachments (photos, signed estimates) ride along, up to 10 MB in total.
  let size = 0;
  const attachments = [];
  for (const a of parsed.attachments || []) {
    const bytes = typeof a.content === "string" ? new TextEncoder().encode(a.content) : new Uint8Array(a.content);
    if (size + bytes.length > 10 * 1024 * 1024 || attachments.length >= 10) break;
    size += bytes.length;
    attachments.push({ filename: oneLine(a.filename || "attachment", 100), content: b64(bytes) });
  }
  const text = parsed.text || htmlToText(parsed.html || "");
  const mail = forwardEmail({ item, from, subject, text: stripQuoted(text), auto, unsubscribe });
  await sendOwner(env, acct, mail, undefined, { replyTo: isEmail(fromAddr) ? fromAddr : undefined, bcc: false, attachments });
  return auto ? "auto" : unsubscribe ? "unsubscribed" : "replied";
}

const escText = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function b64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
// Plain text from an HTML-only reply. A linear scan, no regex: drops tags and the contents of <style>/<script>,
// and the result is escaped again wherever it is shown. Never produces a "<", so nothing in it can become markup.
export function htmlToText(html) {
  const src = String(html).slice(0, 500000);
  let out = "";
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) { out += src.slice(i); break; }
    out += src.slice(i, lt);
    const gt = src.indexOf(">", lt);
    if (gt < 0) break;
    const tag = src.slice(lt + 1, gt).trim().toLowerCase();
    const name = tag.split(/[\s/]/)[0];
    if (name === "style" || name === "script") {
      const end = src.toLowerCase().indexOf(`</${name}`, gt);
      i = end < 0 ? src.length : src.indexOf(">", end) + 1 || src.length;
      continue;
    }
    if (["br", "p", "/p", "div", "/div", "li", "tr"].includes(name)) out += "\n";
    else out += " ";
    i = gt + 1;
  }
  out = out.replace(/&nbsp;/g, " ").replace(/&lt;/g, "‹").replace(/&gt;/g, "›").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  return out.split("<").join("‹").split(">").join("›").split("\n").map((l) => l.trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Drop the quoted copy of our own follow-up under the customer's answer ("On Mon, ... wrote:").
export function stripQuoted(text) {
  const lines = String(text || "").split(/\r?\n/);
  const cut = lines.findIndex((l) => /^On .{4,200}wrote:\s*$/.test(l.trim()) || /^-{2,}\s*Original Message\s*-{2,}/i.test(l.trim()) || /^From: .+/.test(l.trim()));
  return (cut > 0 ? lines.slice(0, cut) : lines).join("\n").trim();
}

// ---------- recipient opt-out ----------
async function unsubscribe(request, env, acctId, itemId) {
  const acct = await getAccount(env, acctId);
  const item = acct?.items.find((i) => i.id === itemId);
  if (!item) return html(unsubPage("", true));
  if (request.method === "POST") {
    if (item.status === "open" || item.status === "done") {
      await setStatus(env, acct, itemId, "stopped", "Asked to stop");
      await putAccount(env, acct);
    }
    return html(unsubPage(acct.settings.business, true));
  }
  return html(unsubPage(acct.settings.business, false, `/u/${acctId}/${itemId}`));
}

// ---------- the customer's one-tap buttons ----------
export async function customerAction(request, env, acctId, itemId, action, now = Date.now()) {
  const acct = await getAccount(env, acctId);
  const preview = itemId === "test";
  const item = !acct ? null : preview
    ? { id: "test", kind: "estimate", name: "Jane", email: acct.settings.replyTo, job: "the kitchen remodel" }
    : acct.items.find((i) => i.id === itemId);
  if (!item || (action === "yes" && item.kind === "invoice")) return html(notFoundPage(), 404);
  const path = `/a/${acctId}/${itemId}/${action}`;
  const view = (o = {}) => html(actionPage({ business: acct.settings.business, item, action, path, ...o }));
  if (request.method !== "POST") return view();
  const form = await request.formData();
  const note = clean(form.get("note"), 1000).replace(/\r\n/g, "\n");
  const phone = oneLine(form.get("phone"), 30).replace(/[^0-9+().\- ]/g, "");
  if (action === "ask" && !note) return view({ error: "Please type your question." });
  // One message per job every 10 minutes, so a double tap (or a bored bot) can't flood the owner.
  if (!preview && item.lastActionAt && now - item.lastActionAt < 10 * 60000) return view({ done: true });
  const mail = actionEmail({ item, action, note, phone, preview });
  const ok = await sendOwner(env, acct, mail, undefined, { replyTo: isEmail(item.email) ? item.email : undefined, bcc: false });
  if (!ok) return view({ error: "That didn't go through. Please try again, or just reply to the email." });
  if (!preview) {
    item.lastActionAt = now;
    if (item.status === "open" || item.status === "done") await setStatus(env, acct, item.id, "replied", action === "yes" ? "Tapped: ready to go ahead" : "Tapped: has a question");
    await putAccount(env, acct);
  }
  return view({ done: true });
}

// ---------- sign-in links ----------
async function login(request, env, ctx) {
  if (request.method !== "POST") return html(loginPage(false));
  const form = await request.formData();
  const email = clean(form.get("email"), 254).toLowerCase();
  if (isEmail(email)) {
    const id = await env.DESK.get(`email:${email}`);
    const acct = id && (await getAccount(env, id));
    // At most one link email per account every 10 minutes. The page never says whether the account exists.
    if (acct && (!acct.lastLinkAt || Date.now() - acct.lastLinkAt > 10 * 60000)) {
      acct.lastLinkAt = Date.now();
      const token = await issueToken(env, acct);
      await putAccount(env, acct);
      ctx.waitUntil(sendOwner(env, acct, linkEmail({ link: `${env.APP_URL}/d/${token}` }), undefined, { to: acct.email }));
    }
  }
  return html(loginPage(true));
}

// ---------- dashboard ----------
async function dashboard(request, env, token, action) {
  const acct = await accountByToken(env, token);
  if (!acct) return html(notFoundPage(), 404);
  const base = `/d/${token}`;
  const portalUrl = env.PORTAL_URL || "";
  if (request.method === "GET") {
    const msg = new URL(request.url).searchParams.get("m") || "";
    if (action === "settings") {
      if (!acct.messagesSeen) { acct.messagesSeen = Date.now(); await putAccount(env, acct); }
      return html(settingsPage({ acct, base, msg }));
    }
    if (action) return redirect(base);
    return html(dashboardPage({ acct, base, msg, portalUrl }));
  }
  if (request.method !== "POST") return json(405, { ok: false });
  const form = await request.formData();
  const code = await act(env, acct, action, form);
  return redirect(`${base}${code.startsWith("settings:") ? "/settings" : ""}?m=${code.replace("settings:", "")}`);
}

const TZ_OK = new Set(TIMEZONES.map((t) => t[0]));

export async function act(env, acct, action, form, now = Date.now()) {
  const s = acct.settings;
  const get = (k, max) => clean(form.get(k), max);
  const canAdd = acct.billing !== "canceled";

  if (action === "setup" || action === "settings") {
    const business = oneLine(get("business", 60), 60);
    const replyTo = get("replyTo", 254).toLowerCase();
    const signoff = clean(get("signoff", 80), 80);
    const tz = get("timezone", 40);
    if (!business || !signoff) return action === "settings" ? "settings:bad" : "bad";
    if (!isEmail(replyTo)) return action === "settings" ? "settings:bademail" : "bademail";
    s.business = business;
    s.replyTo = replyTo;
    s.signoff = signoff;
    if (TZ_OK.has(tz)) s.timezone = tz;
    if (action === "settings") {
      const days = validDays([form.get("d0"), form.get("d1"), form.get("d2")]);
      if (!days) return "settings:baddays";
      s.days = days;
      s.bccMe = form.get("bccMe") === "1";
      s.buttons = form.get("buttons") === "1";
      const pay = validPayUrl(get("payUrl", 600));
      if (pay === null) return "settings:badpay";
      s.payUrl = pay;
      for (const kind of Object.keys(KINDS)) {
        s.templates[kind] = [0, 1, 2].map((k) => {
          const subject = oneLine(get(`${kind}_s${k}`, 150), 150);
          const body = clean(get(`${kind}_b${k}`, 2000), 2000).replace(/\r\n/g, "\n");
          return subject && body ? { subject, body } : s.templates[kind]?.[k] || DEFAULT_TEMPLATES[kind][k];
        });
      }
    }
    const first = !acct.setupDone;
    acct.setupDone = true;
    await putAccount(env, acct);
    return action === "settings" ? "settings:saved" : first ? "setup" : "saved";
  }

  if (action === "reset") {
    s.templates = structuredClone(DEFAULT_TEMPLATES);
    await putAccount(env, acct);
    return "settings:reset";
  }

  if (action === "add" || action === "import") {
    if (!canAdd || !acct.setupDone) return "bad";
    const kind = KINDS[form.get("kind")] ? form.get("kind") : "estimate";
    const openEmails = new Set(acct.items.filter((i) => i.status === "open").map((i) => i.email));
    let rows;
    if (action === "add") {
      const email = get("email", 254).toLowerCase();
      if (!isEmail(email)) return "bademail";
      if (openEmails.has(email)) return "dup";
      const d = parseDate(get("date", 20));
      rows = [{ name: oneLine(get("name", 80), 80), email, job: oneLine(get("job", 100), 100), amount: normAmount(get("amount", 20)), sentOn: d && d <= now + DAY ? d : null }];
    } else {
      rows = parseList(String(form.get("list") || "").slice(0, 300000), now).rows;
      if (!rows.length) return "bad";
    }
    let added = 0;
    for (const r of rows) {
      if (openEmails.has(r.email)) continue;
      if (openEmails.size >= MAX_OPEN) return added ? "imported" : "limit";
      acct.items.push({ id: randomId(9), kind, name: r.name, email: r.email, job: r.job, amount: kind === "invoice" ? r.amount : "", sentOn: r.sentOn || now, added: now, step: 0, status: "open", sends: [] });
      openEmails.add(r.email);
      added++;
    }
    await putAccount(env, acct);
    return action === "add" ? "added" : added ? "imported" : "dup";
  }

  if (action === "item") {
    const id = get("id", 20);
    const to = get("to", 10);
    const item = acct.items.find((i) => i.id === id);
    if (!item) return "bad";
    if (to === "open") {
      if (acct.items.some((i) => i.status === "open" && i.email === item.email && i.id !== id)) return "dup";
      item.status = "open";
      delete item.closedAt;
      await env.DESK.delete(`stop:${acct.id}:${id}`);
      if ((item.step || 0) >= 3) item.step = 2; // one more follow-up, then done
      await putAccount(env, acct);
      return "reopened";
    }
    if (!["won", "lost", "stopped"].includes(to)) return "bad";
    await setStatus(env, acct, id, to);
    await putAccount(env, acct);
    return "updated";
  }

  if (action === "pause") {
    acct.paused = form.get("paused") === "1";
    await putAccount(env, acct);
    return acct.paused ? "paused" : "resumed";
  }

  if (action === "test") {
    const sample = { id: "test", kind: "estimate", name: "Jane", email: s.replyTo, job: "the kitchen remodel", step: 0 };
    const ok = await sendFollowUp(env, acct, sample, { test: true });
    if (ok && !acct.previewSent) { acct.previewSent = now; await putAccount(env, acct); }
    return ok ? "test" : "testfail";
  }
  return "bad";
}

// ---------- the hourly run ----------
// Sends, reports and cleanup for every account, then (ops.js) the nightly backup, the heartbeat behind /health,
// and one alert email to NOTIFY_TO if anything failed.
export const hourly = (env, now = Date.now()) => runHourly(env, now, runAll);

// Returns totals so the heartbeat and alert can say what happened.
export async function runAll(env, now = Date.now()) {
  const totals = { accounts: 0, sent: 0, sendFailures: 0, runFailures: 0, errors: [] };
  let cursor;
  do {
    const page = await env.DESK.list({ prefix: "acct:", cursor });
    for (const k of page.keys) {
      try {
        const acct = await getAccount(env, k.name.slice(5));
        if (!acct) continue;
        totals.accounts++;
        const out = await runAccount(env, acct, now);
        totals.sent += out.sent;
        totals.sendFailures += out.failed;
        if (out.failed) totals.errors.push(`${acct.id}: ${out.failed} email(s) Resend did not accept`);
      } catch (e) {
        totals.runFailures++;
        totals.errors.push(`${k.name.slice(5)}: ${String(e)}`);
        console.log("desk: run failed", k.name, String(e));
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return totals;
}

export async function runAccount(env, acct, now = Date.now()) {
  const s = acct.settings;
  const local = localParts(now, s.timezone);
  let changed = false;
  const out = { sent: 0, failed: 0, report: false, deleted: false };

  if (acct.billing === "canceled" && acct.canceledAt && now - acct.canceledAt > 30 * DAY) {
    await deleteAccount(env, acct);
    out.deleted = true;
    return out;
  }
  if (prune(acct, now)) changed = true;

  if (deskState(acct).sending && inSendWindow(now, s.timezone)) {
    if (acct.sendDay !== local.date) { acct.sendDay = local.date; acct.sentToday = 0; }
    for (const item of acct.items) {
      if (acct.sentToday >= DAILY_CAP) break;
      if (!isDue(item, s.days, now)) continue;
      // Last look right before sending: a reply or button press may have landed since this run loaded the account.
      const stop = await env.DESK.get(`stop:${acct.id}:${item.id}`);
      if (stop) continue;
      const ok = await sendFollowUp(env, acct, item);
      if (!ok) { out.failed++; continue; } // retried next hour; the hourly run alerts NOTIFY_TO
      item.step = (item.step || 0) + 1;
      item.lastSentAt = now;
      item.sends = [...(item.sends || []), now];
      if (item.step >= s.days.length) { item.status = "done"; item.closedAt = now; }
      acct.sentToday++;
      out.sent++;
      changed = true;
      await putAccount(env, acct); // save after every send so a crash can't double-send
    }
  }

  // Trial nudges: one email on day 1, 3 and 10 after signup, only while nothing has been added, 9 AM to 5 PM local.
  if (acct.billing !== "canceled" && !acct.items.length && acct.created && local.hour >= 9 && local.hour < 17) {
    const age = now - acct.created;
    const due = NUDGE_DAYS.map((d, n) => (age >= d * DAY && !(acct.nudges || []).includes(n) ? n : -1)).filter((n) => n >= 0);
    if (due.length) {
      const n = due[due.length - 1]; // only the latest one; older missed ones are skipped, never stacked up
      const token = await issueToken(env, acct);
      changed = true;
      const ok = await sendOwner(env, acct, nudgeEmail({ n, name: acct.name, link: `${env.APP_URL}/d/${token}`, setupDone: acct.setupDone, trialing: acct.billing === "trialing" }), `desk-nudge-${acct.id}-${n}`, { to: acct.email, bcc: false });
      if (ok) { acct.nudges = [...new Set([...(acct.nudges || []), ...due])]; changed = true; } else out.failed++;
    }
  }

  if (acct.setupDone && acct.billing !== "canceled" && local.weekday === "Mon" && local.hour === REPORT_HOUR && acct.reportDay !== local.date && acct.items.length) {
    // The report links to the sign-in page, not a fresh token: minting one every week would retire the owner's bookmark.
    const ok = await sendOwner(env, acct, reportEmail({ acct, link: `${env.APP_URL}/login`, now }), `desk-report-${acct.id}-${local.date}`);
    if (ok) { acct.reportDay = local.date; out.report = true; changed = true; } else out.failed++;
  }

  if (changed) await putAccount(env, acct);
  return out;
}
