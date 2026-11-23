// neonkey-family-shield: the paid Family Shield plan (one family, up to 5 adults, rules + AI scam check).
//   POST /stripe            checkout.session.completed from an FS_PAYMENT_LINK -> family plan + private link emailed to
//                           the buyer. customer.subscription.updated/deleted -> plan status; delete 30 days after cancel.
//   GET  /f/<token>         a member's page: consent (first visit), check form, shared results, family list.
//   POST /f/<token>/consent|check|share|invite|remove   plain forms, no JavaScript.
//   GET/POST /join/<token>  an invite: the 18+ consent page, then the new member's own private link.
//   GET/POST /login         "email me a new link" (never says whether an email is on a plan).
//   cron (daily)            delete plans 30 days after cancel.
//   GET  /health            { ok, ai, checkout }
// Secrets (wrangler secret put, never committed, never pasted in chat): STRIPE_WEBHOOK_SECRET, RESEND_API_KEY,
// ANTHROPIC_API_KEY. The checked message text is never stored, logged or emailed.
import { verifyStripeEvent } from "./verify.js";
import { familyCheck } from "./ai.js";
import {
  CONSENT_VERSION, DELETE_AFTER, MAX_MEMBERS, isEmail, oneLine, getFamily, putFamily, byToken, issueToken, createFamily,
  createInvite, byInvite, acceptInvite, removeMember, deleteFamily, countCheck, addShare,
} from "./store.js";
import { welcomeEmail, inviteEmail, linkEmail, send, notice } from "./mail.js";
import { CSS, SHARE_TEXT, consentPage, joinPage, dashboardPage, resultPage, loginPage, messagePage } from "./pages.js";

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
const msg = (title, text, status) => { const m = messagePage(title, text, status); return html(m.body, m.status); };

export const paymentLinks = (env) => String(env.FS_PAYMENT_LINK || "").split(",").map((x) => x.trim()).filter(Boolean);
const appUrl = (env) => String(env.APP_URL || "").replace(/\/$/, "");

async function form(request) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 64 * 1024) return null;
  const ct = request.headers.get("Content-Type") || "";
  if (!ct.includes("application/x-www-form-urlencoded") && !ct.includes("multipart/form-data")) return null;
  return request.formData();
}
// Plain forms from our own pages only: a cross-site POST carries another Origin.
function sameOrigin(request) {
  const o = request.headers.get("Origin");
  return !o || o === "null" || o === new URL(request.url).origin;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    try {
      if (path === "/health") return json(200, { ok: true, ai: env.AI_ENABLED === "true", checkout: paymentLinks(env).length > 0 });
      if (path === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } });
      if (path === "/app.css") return new Response(CSS, { headers: { "Content-Type": "text/css", "Cache-Control": "public, max-age=3600" } });
      if (path === "/") return redirect("/login");
      if (path === "/stripe" && method === "POST") return await stripeWebhook(request, env);
      if (method === "POST" && !sameOrigin(request)) return msg("That didn't work", "Please use the buttons on this page.", 403);
      if (path === "/login") return await login(request, env);
      let m = path.match(/^\/join\/([A-Za-z0-9_-]{43})$/);
      if (m) return await join(request, env, m[1]);
      m = path.match(/^\/f\/([A-Za-z0-9_-]{43})(?:\/(consent|check|share|invite|remove))?$/);
      if (m) return await member(request, env, m[1], m[2] || "");
      return msg("Page not found", "This link doesn't go anywhere.", 404);
    } catch (e) {
      const where = path.replace(/^\/(f|join)\/[^/]+/, "/$1/<link>"); // never log a private link
      console.log("family-shield: error", method, where, e?.name || "error");
      ctx?.waitUntil?.(notice(env, "error", [`${method} ${where} failed: ${e?.name || "error"}`]));
      return msg("Something went wrong", "Please try again in a minute.", 500);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(cleanup(env, controller.scheduledTime || Date.now()));
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
    if (!paymentLinks(env).includes(o.payment_link)) return json(200, { ok: true, ignored: "other_offer" });
    if (o.status !== "complete") return json(200, { ok: true, ignored: "incomplete" });
    return (await handleSignup(env, o, event.livemode)) ? json(200, { ok: true }) : json(500, { ok: false });
  }
  if ((event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") && o.object === "subscription") {
    return json(200, { ok: true, status: await handleSubscription(env, o, event.type === "customer.subscription.deleted") });
  }
  return json(200, { ok: true, ignored: event.type });
}

export async function handleSignup(env, s, livemode) {
  if (await env.FS.get(`sess:${s.id}`)) return true; // re-delivered event
  const email = String(s.customer_details?.email || "").trim().toLowerCase();
  const name = oneLine(s.customer_details?.name || "", 60);
  if (!isEmail(email)) {
    await notice(env, "checkout without an email", [`Checkout ${s.id} has no usable email. Find the buyer in Stripe and send them a link by hand.`]);
    await env.FS.put(`sess:${s.id}`, "noemail", { expirationTtl: 90 * 86400 });
    return true;
  }
  if (await env.FS.get(`email:${email}`)) {
    // Already on a plan (theirs or someone else's). Don't create a second one silently: tell Michael.
    await notice(env, "duplicate signup", [`Checkout ${s.id}: ${email} is already on a Family Shield plan. Check Stripe and refund or merge by hand.`]);
    await env.FS.put(`sess:${s.id}`, "duplicate", { expirationTtl: 90 * 86400 });
    return true;
  }
  const sub = typeof s.subscription === "string" ? s.subscription : s.subscription?.id || "";
  const customer = typeof s.customer === "string" ? s.customer : s.customer?.id || "";
  const { fam, token } = await createFamily(env, { email, name, customer, subscription: sub, session: s.id, livemode });
  if (env.PORTAL_URL) { fam.portal = env.PORTAL_URL; await putFamily(env, fam); }
  try {
    await send(env, email, welcomeEmail({ name, link: `${appUrl(env)}/f/${token}` }), { bcc: true });
  } catch (e) {
    console.log("family-shield: welcome email failed", String(e));
    await notice(env, "welcome email failed", [`New plan ${fam.id} (${email}). The welcome email failed; they can use "email me a link" at ${appUrl(env)}/login.`]);
  }
  await notice(env, livemode ? "new family plan" : "new TEST family plan", [`Plan ${fam.id}`, `Owner: ${email}`, `Subscription: ${sub || "none"}`]);
  return true;
}

export async function handleSubscription(env, sub, deleted) {
  const id = await env.FS.get(`sub:${sub.id}`);
  const fam = id && (await getFamily(env, id));
  if (!fam) return "unknown";
  if (deleted || sub.status === "canceled") {
    if (fam.status !== "canceled") {
      fam.status = "canceled";
      fam.canceledAt = Date.now();
      fam.deleteAt = Date.now() + DELETE_AFTER;
      await notice(env, "plan canceled", [`Plan ${fam.id} canceled. Deleted after ${new Date(fam.deleteAt).toISOString().slice(0, 10)}.`]);
    }
  } else if (["active", "trialing"].includes(sub.status)) {
    fam.status = "active";
    delete fam.canceledAt;
    delete fam.deleteAt;
  } else {
    fam.status = "past_due"; // past_due, unpaid, incomplete, paused: rules-only until fixed
  }
  await putFamily(env, fam);
  return fam.status;
}

export async function cleanup(env, now = Date.now()) {
  let cursor;
  let deleted = 0;
  do {
    const page = await env.FS.list({ prefix: "fam:", cursor });
    for (const k of page.keys) {
      const fam = await env.FS.get(k.name, "json");
      if (fam && fam.status === "canceled" && fam.deleteAt && fam.deleteAt <= now) { await deleteFamily(env, fam); deleted++; }
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return deleted;
}

// ---------- sign-in link ----------
async function login(request, env) {
  if (request.method !== "POST") return html(loginPage({ sent: false }));
  const f = await form(request);
  const email = String(f?.get("email") || "").trim().toLowerCase();
  if (isEmail(email) && !(await env.FS.get(`ll:${email}`))) {
    await env.FS.put(`ll:${email}`, "1", { expirationTtl: 600 }); // one email per 10 minutes per address
    const v = await env.FS.get(`email:${email}`);
    if (v) {
      const [fid, mid] = v.split(":");
      const fam = await getFamily(env, fid);
      const mem = fam && fam.members.find((x) => x.id === mid);
      if (mem && fam.status !== "canceled") {
        const token = await issueToken(env, fam, mem);
        await putFamily(env, fam);
        await send(env, email, linkEmail({ name: mem.name, link: `${appUrl(env)}/f/${token}` }));
      }
    }
  }
  return html(loginPage({ sent: true })); // same page either way
}

// ---------- invites ----------
async function join(request, env, token) {
  const found = await byInvite(env, token);
  if (!found || found.fam.status !== "active") return msg("This invite has expired", "Ask the person who invited you to send a new one.", 410);
  const { fam, invite, hash } = found;
  const owner = fam.members.find((m) => m.role === "owner");
  const from = owner?.name || "your family";
  if (request.method !== "POST") return html(joinPage({ invite, from, token }));
  const f = await form(request);
  const name = oneLine(f?.get("name"), 40);
  if (f?.get("adult") !== "yes" || f?.get("agree") !== "yes" || !name) return html(joinPage({ invite, from, token, error: "Please add your first name and check both boxes." }), 400);
  if (fam.members.length >= MAX_MEMBERS) return msg("This plan is full", `A plan covers up to ${MAX_MEMBERS} adults. Ask the plan owner to make room.`, 409);
  if (await env.FS.get(`email:${invite.email}`)) return msg("You're already on a plan", "This email is already on a Family Shield plan. Use \"email me a link\" to get in.", 409);
  const { token: mt } = await acceptInvite(env, fam, invite, hash, { name });
  try { await send(env, invite.email, linkEmail({ name, link: `${appUrl(env)}/f/${mt}` })); } catch (e) { console.log("family-shield: join email failed", String(e)); }
  return redirect(`/f/${mt}`);
}

// ---------- a member's page ----------
async function member(request, env, token, action) {
  const found = await byToken(env, token);
  if (!found) return msg("This link doesn't work", "It may be old or mistyped. Get a fresh one by email.", 404);
  const { fam, member: me } = found;
  const base = `/f/${token}`;
  if (request.method !== "POST") {
    if (!me.consent && fam.status !== "canceled") return html(consentPage({ token, name: me.name }));
    return html(dashboardPage({ fam, member: me, token }));
  }
  if (fam.status === "canceled") return redirect(base);
  const f = await form(request);
  if (!f) return redirect(base);

  if (action === "consent") {
    const name = oneLine(f.get("name"), 40);
    if (f.get("adult") !== "yes" || f.get("agree") !== "yes" || !name) return html(consentPage({ token, name, error: "Please add your first name and check both boxes." }), 400);
    me.name = name;
    me.consent = { at: Date.now(), version: CONSENT_VERSION, adult: true };
    await putFamily(env, fam);
    return redirect(base);
  }
  if (!me.consent) return redirect(base);

  if (action === "check") {
    const text = String(f.get("text") || "").slice(0, 8000);
    if (text.trim().length < 8) return html(dashboardPage({ fam, member: me, token, error: "Paste a little more of the message so there's something to check." }), 400);
    const c = await countCheck(env, fam, me);
    if (!c.ok) return html(dashboardPage({ fam, member: me, token, error: c.reason === "member" ? "You've used today's checks. They reset once a day. The free checker at neonkey.tech/scam-checker still works." : "Your family has used today's checks. They reset once a day. The free checker at neonkey.tech/scam-checker still works." }), 429);
    const r = await familyCheck(env, text, { useAi: c.useAi && fam.status === "active" });
    console.log("family-shield: check", r.verdict, r.ai || "rules-only"); // verdicts only, never text
    return html(resultPage({ token, text, r, left: c.left }));
  }
  if (action === "share") {
    const verdict = String(f.get("verdict") || "");
    if (!["scam", "unsure", "normal"].includes(verdict)) return redirect(base);
    const tells = String(f.get("tells") || "").split(",").filter((t) => t in SHARE_TEXT);
    addShare(fam, me, { verdict, tells, note: f.get("note") });
    await putFamily(env, fam);
    return html(dashboardPage({ fam, member: me, token, msg: "Shared with your family." }));
  }
  if (me.role !== "owner") return redirect(base);
  if (action === "invite") {
    const email = String(f.get("email") || "").trim().toLowerCase();
    const name = oneLine(f.get("name"), 40);
    if (!isEmail(email) || !name) return html(dashboardPage({ fam, member: me, token, error: "Add their first name and a valid email." }), 400);
    if (fam.status !== "active") return redirect(base);
    if (fam.members.length + (fam.invites || []).filter((i) => i.email !== email).length >= MAX_MEMBERS) return html(dashboardPage({ fam, member: me, token, error: `A plan covers up to ${MAX_MEMBERS} adults.` }), 409);
    if (fam.members.some((m) => m.email === email)) return html(dashboardPage({ fam, member: me, token, error: "They're already in your family." }), 409);
    const day = new Date().toISOString().slice(0, 10);
    const n = Number((await env.FS.get(`ni:${fam.id}:${day}`)) || 0);
    if (n >= 10) return html(dashboardPage({ fam, member: me, token, error: "That's a lot of invites for one day. Try again tomorrow." }), 429);
    await env.FS.put(`ni:${fam.id}:${day}`, String(n + 1), { expirationTtl: 2 * 86400 });
    const it = await createInvite(env, fam, { email, name });
    await send(env, email, inviteEmail({ name, from: me.name, link: `${appUrl(env)}/join/${it}` }));
    return html(dashboardPage({ fam, member: me, token, msg: `Invite sent to ${name}.` }));
  }
  if (action === "remove") {
    const ok = await removeMember(env, fam, String(f.get("member") || ""));
    return html(dashboardPage({ fam, member: me, token, msg: ok ? "Removed. Their link no longer works." : "" }));
  }
  return redirect(base);
}
