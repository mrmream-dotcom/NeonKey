// NeonKey service quiz: plan email Worker.
//   POST /plan  { email, first_name?, answers, newsletter, website }  (website = honeypot)
// Recomputes the plan server-side from the shared logic in src/data/quiz.ts, emails it
// to the visitor through Resend, sends a lead copy to hello@neonkey.tech, and (only if
// the visitor ticked the box) starts Kit's double opt-in for Unlock the Week.
import { validateAnswers, computePlan, buildPlan, answerSummary } from "../../../src/data/quiz.ts";
import { renderPlanEmail, renderLeadEmail, cleanFirstName } from "./email.js";

const KIT_FORM_ID = "10118914";
const DAY = 86400;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const reply = (status, body) => {
      const h = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", Vary: "Origin" };
      if (okOrigin) {
        h["Access-Control-Allow-Origin"] = origin;
        h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
        h["Access-Control-Allow-Headers"] = "Content-Type";
        h["Access-Control-Max-Age"] = "86400";
      }
      return new Response(body === null ? null : JSON.stringify(body), { status, headers: h });
    };

    if (url.pathname !== "/plan") return reply(404, { ok: false, message: "Not found." });
    if (request.method === "OPTIONS") return reply(okOrigin ? 204 : 403, null);
    if (request.method !== "POST") return reply(405, { ok: false, message: "Method not allowed." });
    if (!okOrigin) return reply(403, { ok: false, message: "Forbidden." });
    if (!(request.headers.get("Content-Type") || "").includes("application/json")) return reply(415, { ok: false, message: "Expected JSON." });

    const raw = await request.text();
    if (raw.length > 4000) return reply(413, { ok: false, message: "Request too large." });
    let body;
    try { body = JSON.parse(raw); } catch { return reply(400, { ok: false, message: "Bad request." }); }
    if (!body || typeof body !== "object") return reply(400, { ok: false, message: "Bad request." });

    // Honeypot: pretend success, send nothing.
    if (typeof body.website === "string" && body.website.trim() !== "") return reply(200, { ok: true });

    const email = normalizeEmail(body.email);
    if (!email) return reply(400, { ok: false, message: "Please enter a valid email address." });
    const answers = validateAnswers(body.answers);
    if (!answers) return reply(400, { ok: false, message: "Your answers didn't come through. Please retake the quiz and try again." });
    const firstName = cleanFirstName(typeof body.first_name === "string" ? body.first_name.slice(0, 60) : "");
    const newsletter = body.newsletter === true;

    // Rate limits (hashed keys, short TTLs). Checked first, counted only after a successful send.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const today = new Date().toISOString().slice(0, 10);
    const ipKey = `ip:${today}:${(await sha256Hex(`${env.RL_SALT || "nk"}|${ip}`)).slice(0, 32)}`;
    const emKey = `em:${(await sha256Hex(`${env.RL_SALT || "nk"}|${email}`)).slice(0, 32)}`;
    const gKey = `global:${today}`;
    const [ipN, emSeen, gN] = await Promise.all([env.QUIZ_RL.get(ipKey), env.QUIZ_RL.get(emKey), env.QUIZ_RL.get(gKey)]);
    if (emSeen) return reply(429, { ok: false, message: "I already sent a plan to that address in the last day. Check your inbox (and spam), or email hello@neonkey.tech." });
    if (Number(ipN || 0) >= Number(env.IP_DAILY_LIMIT || 5)) return reply(429, { ok: false, message: "Too many requests today. Please try again tomorrow, or email hello@neonkey.tech." });
    if (Number(gN || 0) >= Number(env.GLOBAL_DAILY_LIMIT || 100)) return reply(429, { ok: false, message: "The plan email is busy right now. Your result above is complete, or email hello@neonkey.tech." });

    const plan = computePlan(answers);
    const view = buildPlan(plan);

    const mail = renderPlanEmail(view, { firstName, newsletter, mailingAddress: env.MAILING_ADDRESS });
    const sent = await resendSend(env, {
      from: env.FROM_ADDRESS,
      to: [email],
      reply_to: env.REPLY_TO,
      subject: view.subject,
      html: mail.html,
      text: mail.text,
      tags: [{ name: "kind", value: "quiz_plan" }, { name: "result", value: view.type.replace(/[^A-Za-z0-9_-]/g, "_") }],
    });
    if (!sent.ok) {
      console.log("quiz: resend plan failed", sent.status);
      return reply(502, { ok: false, message: "I couldn't send the email just now. Please try again in a minute, or email hello@neonkey.tech." });
    }

    // Count only successful sends.
    await Promise.all([
      env.QUIZ_RL.put(ipKey, String(Number(ipN || 0) + 1), { expirationTtl: DAY + 3600 }),
      env.QUIZ_RL.put(emKey, "1", { expirationTtl: DAY }),
      env.QUIZ_RL.put(gKey, String(Number(gN || 0) + 1), { expirationTtl: DAY + 3600 }),
    ]);

    // Lead copy to NeonKey (reply goes straight to the visitor). Failure doesn't fail the request.
    const lead = renderLeadEmail(view, { email, firstName, newsletter, summary: answerSummary(answers), plan });
    const leadRes = await resendSend(env, {
      from: env.FROM_ADDRESS,
      to: [env.LEAD_TO],
      reply_to: email,
      subject: `Quiz plan request: ${view.resultName}`,
      html: lead.html,
      text: lead.text,
      tags: [{ name: "kind", value: "quiz_lead" }],
    });
    if (!leadRes.ok) console.log("quiz: resend lead copy failed", leadRes.status);

    let nl = "skipped";
    if (newsletter) nl = (await kitSubscribe(env, email, firstName)) ? "ok" : "failed";

    return reply(200, { ok: true, newsletter: nl });
  },
};

async function resendSend(env, payload) {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && !!j.id, status: r.status, id: j.id };
  } catch {
    return { ok: false, status: 0 };
  }
}

// Kit v4: create (or find) the subscriber as inactive, then add to the newsletter form.
// That sends Kit's double opt-in confirmation; the welcome Worker handles activation.
async function kitSubscribe(env, email, firstName) {
  const h = { "X-Kit-Api-Key": env.KIT_API_KEY, "Content-Type": "application/json", Accept: "application/json" };
  try {
    const s = { email_address: email, state: "inactive" };
    if (firstName) s.first_name = firstName;
    const a = await fetch("https://api.kit.com/v4/subscribers", { method: "POST", headers: h, body: JSON.stringify(s) });
    if (!a.ok) { console.log("quiz: kit create failed", a.status); return false; }
    const b = await fetch(`https://api.kit.com/v4/forms/${KIT_FORM_ID}/subscribers`, {
      method: "POST", headers: h,
      body: JSON.stringify({ email_address: email, referrer: "https://neonkey.tech/services/quiz/" }),
    });
    if (!b.ok) { console.log("quiz: kit form add failed", b.status); return false; }
    return true;
  } catch {
    return false;
  }
}

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
