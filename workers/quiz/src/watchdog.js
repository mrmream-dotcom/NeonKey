// POST /watchdog: Founder Watchdog waitlist (demand test, Nov 13 2026). Waitlist only: no payment, no monitoring,
// no promise to build. Shares the answer whitelist and the "qualified" rule with the page (src/data/watchdog.ts).
//
// Body: { email, domain, answers: { dns, domains, plan, watch[], from }, website (honeypot), src (first touch) }
// Stores one entry per email in KV (QUIZ_RL namespace, prefix "wd:", 365-day TTL) so the Dec 13 gate can be counted
// with `wrangler kv key list --prefix wd:entry:` (key metadata carries q = qualified, plus from/plan/dns).
// Sends the visitor one confirmation and hello@ a lead copy. A repeat signup updates the entry and sends no second
// confirmation. Rate limits use hashed keys, like /plan and /kit.
import { watchdog, validateWdAnswers, cleanWdDomain, qualifyWd, wdSummary } from "../../../src/data/watchdog.ts";
import { renderWatchdogEmail, renderWatchdogLeadEmail } from "./email.js";

const DAY = 86400;
export const WD_TTL = 365 * DAY;

/**
 * h = helpers from index.js: { resendSend, sha256Hex, normalizeEmail, cleanSource }. Passed in (not imported) so this
 * module has no import cycle with index.js and tests can stub the network.
 */
export async function handleWatchdog(request, env, body, reply, h) {
  const email = h.normalizeEmail(body.email);
  if (!email) return reply(400, { ok: false, message: "Please enter a valid email address." });
  const domain = cleanWdDomain(body.domain);
  if (!domain) return reply(400, { ok: false, message: "Please enter a domain like yourstartup.com." });
  const answers = validateWdAnswers(body.answers);
  if (!answers) return reply(400, { ok: false, message: "Please answer the DNS and price questions and try again." });

  const salt = env.RL_SALT || "nk";
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const today = new Date().toISOString().slice(0, 10);
  const ipKey = `wd:ip:${today}:${(await h.sha256Hex(`${salt}|${ip}`)).slice(0, 32)}`;
  const gKey = `wd:global:${today}`;
  const entryKey = `wd:entry:${(await h.sha256Hex(`${salt}|${email}`)).slice(0, 32)}`;
  const [ipN, gN, prevRaw] = await Promise.all([env.QUIZ_RL.get(ipKey), env.QUIZ_RL.get(gKey), env.QUIZ_RL.get(entryKey)]);
  if (Number(ipN || 0) >= Number(env.WD_IP_DAILY_LIMIT || 5)) return reply(429, { ok: false, message: "Too many signups from here today. Please try again tomorrow, or email hello@neonkey.tech." });
  if (Number(gN || 0) >= Number(env.WD_GLOBAL_DAILY_LIMIT || 200)) return reply(429, { ok: false, message: "The waitlist is busy right now. Please try again tomorrow, or email hello@neonkey.tech." });

  let prev = null;
  try { prev = prevRaw ? JSON.parse(prevRaw) : null; } catch { prev = null; }
  const repeat = Boolean(prev);
  const q = qualifyWd(domain, answers);
  const source = h.cleanSource(body.src);
  const now = new Date().toISOString();
  // The visitor's email being on the watched domain is a weak sign they control it (still needs the TXT proof later).
  const emailOnDomain = email.endsWith(`@${domain}`) || email.endsWith(`.${domain}`);

  if (!repeat) {
    const mail = renderWatchdogEmail({ domain, plannedMonthly: watchdog.plannedMonthly, plannedYearly: watchdog.plannedYearly, mailingAddress: env.MAILING_ADDRESS });
    const sent = await h.resendSend(env, {
      from: env.FROM_ADDRESS,
      to: [email],
      ...(env.BCC_ADDRESS ? { bcc: [env.BCC_ADDRESS] } : {}),
      reply_to: env.REPLY_TO,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      tags: [{ name: "kind", value: "watchdog_waitlist" }],
    });
    if (!sent.ok) {
      console.log("watchdog: resend confirm failed", sent.status);
      return reply(502, { ok: false, message: "We couldn't add you just now. Please try again in a minute, or email hello@neonkey.tech." });
    }
  }

  const entry = { email, domain, answers, qualified: q.qualified, reasons: q.reasons, emailOnDomain, source, created: prev?.created || now, updated: now };
  await Promise.all([
    env.QUIZ_RL.put(entryKey, JSON.stringify(entry), {
      expirationTtl: WD_TTL,
      metadata: { q: q.qualified ? 1 : 0, from: answers.from, plan: answers.plan, dns: answers.dns, created: entry.created },
    }),
    env.QUIZ_RL.put(ipKey, String(Number(ipN || 0) + 1), { expirationTtl: DAY + 3600 }),
    env.QUIZ_RL.put(gKey, String(Number(gN || 0) + 1), { expirationTtl: DAY + 3600 }),
  ]);

  const summary = [...wdSummary(domain, answers), `Email on that domain: ${emailOnDomain ? "yes" : "no"}`];
  const lead = renderWatchdogLeadEmail({ email, summary, qualified: q.qualified, reasons: q.reasons, source, repeat });
  const leadRes = await h.resendSend(env, {
    from: env.FROM_ADDRESS,
    to: [env.LEAD_TO],
    reply_to: email,
    subject: `${repeat ? "Updated" : q.qualified ? "Qualified" : "New"} Watchdog waitlist: ${domain}`,
    html: lead.html,
    text: lead.text,
    tags: [{ name: "kind", value: "watchdog_waitlist_lead" }],
  });
  if (!leadRes.ok) console.log("watchdog: resend lead copy failed", leadRes.status);

  return reply(200, { ok: true, repeat, qualified: q.qualified });
}
