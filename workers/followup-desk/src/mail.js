// Every email the Desk sends, and how it is sent (Resend).
// Two kinds:
//   NeonKey -> owner (welcome link, new link, Monday report, reply forward) and notices to hello@: From FROM_ADDRESS.
//   Owner -> their customer (the follow-ups themselves): From "<Business> <followups@DESK_DOMAIN>", Reply-To a
//   per-job address on DESK_DOMAIN so a reply stops that job's follow-ups, then lands in the owner's inbox.
// Michael is BCC'd (BCC_ADDRESS) on NeonKey's own emails. He is NOT BCC'd on follow-ups or reply forwards: those are
// the customer's own correspondence with their clients (see README "Privacy").
import { message, KINDS, ACTIONS, fmtDate, summarize, firstName } from "./engine.js";

const C = { bg: "#0b0d17", panel: "#151935", line: "#262b52", text: "#e8eaf6", muted: "#b3b8d6", cyan: "#22d3ee", violet: "#a78bfa", magenta: "#f472b6", green: "#34d399", amber: "#fbbf24" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
const p = (html, extra = "") => `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.text};${extra}">${html}</p>`;
const h2 = (t, color = C.cyan) => `<p style="margin:22px 0 8px 0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${color};">${esc(t)}</p>`;
const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px 0;"><tr><td style="border-radius:10px;background:${C.cyan};"><a href="${esc(href)}" style="display:inline-block;padding:12px 20px;font-family:${FONT};font-size:16px;font-weight:700;color:#0b0d17;text-decoration:none;">${esc(label)}</a></td></tr></table>`;

function shell(preheader, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>NeonKey</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${C.bg};border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
<tr><td style="height:4px;line-height:4px;font-size:0;background:${C.cyan};background-image:linear-gradient(90deg,${C.cyan},${C.violet},${C.magenta});">&nbsp;</td></tr>
<tr><td style="padding:24px 28px 8px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td><img src="https://neonkey.tech/email/neonkey-logo.png" alt="NeonKey" height="34" style="display:block;height:34px;border:0;"></td>
<td align="right" style="font-family:${FONT};font-size:10px;letter-spacing:2px;color:${C.muted};">FOLLOW-UP DESK</td>
</tr></table></td></tr>
<tr><td style="padding:12px 28px 8px 28px;">${body}</td></tr>
<tr><td style="padding:8px 28px 26px 28px;border-top:1px solid ${C.line};">
<p style="margin:16px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted};">NeonKey · <a href="mailto:hello@neonkey.tech" style="color:${C.cyan};text-decoration:none;">hello@neonkey.tech</a> · <a href="https://neonkey.tech/follow-up-desk/" style="color:${C.cyan};text-decoration:none;">neonkey.tech</a><br>Your dashboard link works like a key. Don't forward this email.</p>
</td></tr></table></td></tr></table></body></html>`;
}

// ---------- NeonKey -> owner ----------
export function welcomeEmail({ name, link }) {
  const hiText = firstName(name) === "there" ? "Hi," : `Hi ${firstName(name)},`;
  const hi = esc(hiText);
  const steps = [
    "Add your business name, the email replies should go to, and how you sign off.",
    "Add the estimates you've sent: one at a time, or paste a list from QuickBooks or a spreadsheet.",
    "Send yourself a preview. Reply to it and watch the reply come back to you.",
  ];
  const tools = [
    ["Add one / Paste a list", "Put in the estimates you're waiting on. We skip anyone already on your list."],
    ["Your messages", "Three short follow-ups are written for you. Change any word, or the days they go out."],
    ["Won, Lost, Stop", "One click when you hear back some other way, so nobody gets an extra email."],
    ["Send me a preview", "See exactly what your customers get, any time."],
    ["Pause", "Going on vacation or slammed? Pause everything with one button."],
    ["Monday report", "A short email each week: what went out, who replied, what needs a look."],
  ];
  const toolRows = tools.map(([t, d]) => `<tr><td valign="top" style="padding:8px 12px 8px 0;font-family:${FONT};font-size:15px;font-weight:700;color:${C.text};white-space:nowrap;">${esc(t)}</td><td style="padding:8px 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">${esc(d)}</td></tr>`).join("");
  const html = shell("Your Follow-Up Desk is ready. Here's your private link.", [
    p(hi),
    p("Thanks for signing up. Your Follow-Up Desk is ready, and setup takes about five minutes."),
    button(link, "Open my Follow-Up Desk"),
    h2("Get started in three steps"),
    steps.map((s, i) => p(`<strong style="color:${C.cyan};">${i + 1}.</strong> ${esc(s)}`, "margin-bottom:10px;")).join(""),
    h2("Your tools", C.violet),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;background:${C.panel};border:1px solid ${C.line};border-radius:12px;"><tr><td style="padding:8px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${toolRows}</table></td></tr></table>`,
    p("The best part runs on its own: <strong>when a customer replies, their follow-ups stop</strong> and the reply lands in your inbox.", "font-size:15px;"),
    h2("Good to know", C.violet),
    p("This link is your login. There's no password. Bookmark it, and if you lose it, ask for a new one at the sign-in page using the email you paid with.", `font-size:14px;color:${C.muted};`),
    p("Questions? Just reply to this email.", `font-size:14px;color:${C.muted};`),
  ].join(""));
  const text = `${hiText}\n\nThanks for signing up. Your Follow-Up Desk is ready, and setup takes about five minutes.\n\nOpen it here (this link is your login, don't forward it):\n${link}\n\nGet started:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nYour tools:\n${tools.map(([t, d]) => `- ${t}: ${d}`).join("\n")}\n\nWhen a customer replies, their follow-ups stop and the reply lands in your inbox.\n\nQuestions? Just reply.\n\nNeonKey`;
  return { subject: "Your Follow-Up Desk is ready", html, text };
}

export function linkEmail({ link }) {
  const html = shell("Here's a new link to your Follow-Up Desk.", [
    p("Here's a new link to your Follow-Up Desk. It works like your login, so don't forward it."),
    button(link, "Open my Follow-Up Desk"),
    p("Didn't ask for this? You can ignore it. Your older links keep working, and nobody can get in without one.", `font-size:14px;color:${C.muted};`),
  ].join(""));
  return { subject: "Your Follow-Up Desk link", html, text: `Here's a new link to your Follow-Up Desk (don't forward it):\n${link}\n\nDidn't ask for this? You can ignore it.\n\nNeonKey` };
}

export function reportEmail({ acct, link, now }) {
  const s = summarize(acct, now);
  const tz = acct.settings.timezone;
  const row = (label, n, color = C.text) => `<tr><td style="padding:6px 0;font-family:${FONT};font-size:15px;color:${C.muted};">${esc(label)}</td><td align="right" style="padding:6px 0;font-family:${FONT};font-size:18px;font-weight:700;color:${color};">${n}</td></tr>`;
  const list = (items, verb) => items.slice(0, 15).map((i) => `<li style="margin:0 0 6px 0;">${esc(i.name || i.email)}${i.job ? ` · ${esc(i.job)}` : ""} <span style="color:${C.muted};">(${verb} ${esc(fmtDate(i.closedAt || i.repliedAt, tz))})</span></li>`).join("");
  const section = (title, items, verb, color) => (items.length ? h2(title, color) + `<ul style="margin:0 0 8px 0;padding-left:20px;font-family:${FONT};font-size:15px;line-height:1.5;color:${C.text};">${list(items, verb)}</ul>` : "");
  const html = shell(`This week: ${s.sent} follow-ups sent, ${s.replied.length} replies.`, [
    p(`Here's your Follow-Up Desk week for <strong>${esc(acct.settings.business)}</strong>.`),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;background:${C.panel};border:1px solid ${C.line};border-radius:12px;"><tr><td style="padding:12px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${row("Follow-ups sent", s.sent)}${row("Replies", s.replied.length, C.green)}${row("Marked won or paid", s.won.length, C.green)}${row("Still open", s.open, C.cyan)}${s.bounced.length ? row("Couldn't be delivered", s.bounced.length, C.amber) : ""}
</table></td></tr></table>`,
    section("Replied (follow-ups stopped)", s.replied, "replied", C.green),
    section("Couldn't be delivered: check the email address", s.bounced, "bounced", C.amber),
    section("Finished all three with no reply", s.finished, "last sent", C.violet),
    button(link, "Open my Follow-Up Desk"),
    p("Use your bookmarked link, or the button above to get a fresh one by email. Tip: mark jobs Won or Lost when you know, so nobody gets a follow-up they don't need.", `font-size:14px;color:${C.muted};`),
  ].join(""));
  const text = `Your Follow-Up Desk week for ${acct.settings.business}\n\nFollow-ups sent: ${s.sent}\nReplies: ${s.replied.length}\nMarked won or paid: ${s.won.length}\nStill open: ${s.open}\n${s.bounced.length ? `Couldn't be delivered: ${s.bounced.length}\n` : ""}\n${s.replied.length ? "Replied:\n" + s.replied.map((i) => `- ${i.name || i.email}${i.job ? `, ${i.job}` : ""}`).join("\n") + "\n\n" : ""}${s.bounced.length ? "Couldn't be delivered (check the address):\n" + s.bounced.map((i) => `- ${i.name || ""} ${i.email}`).join("\n") + "\n\n" : ""}Open your Desk: ${link}\n\nNeonKey`;
  return { subject: `Your follow-ups this week: ${s.replied.length} ${s.replied.length === 1 ? "reply" : "replies"}`, html, text };
}

// A customer replied. The owner gets it right away, and hitting Reply answers the customer directly.
export function forwardEmail({ item, from, subject, text, auto, unsubscribe }) {
  const who = item ? `${esc(item.name || item.email)}${item.job ? ` about <strong>${esc(item.job)}</strong>` : ""}` : esc(from);
  const lead = unsubscribe
    ? `${who} asked not to get more follow-ups. They're stopped.`
    : auto
      ? `${who} sent an automatic reply (like an out-of-office). Follow-ups are <strong>still running</strong>, since a person hasn't answered yet.`
      : `${who} replied. Follow-ups for this job are stopped.`;
  const whoText = item ? `${item.name || item.email}${item.job ? ` about ${item.job}` : ""}` : String(from || "");
  const leadText = unsubscribe
    ? `${whoText} asked not to get more follow-ups. They're stopped.`
    : auto
      ? `${whoText} sent an automatic reply (like an out-of-office). Follow-ups are still running, since a person hasn't answered yet.`
      : `${whoText} replied. Follow-ups for this job are stopped.`;
  const quoted = String(text || "(no text in the message)").slice(0, 20000);
  const html = shell(`${item?.name || from} replied`, [
    p(lead),
    unsubscribe ? "" : p("Hit Reply to answer them directly.", `color:${C.muted};font-size:14px;`),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;background:${C.panel};border:1px solid ${C.line};border-left:3px solid ${C.cyan};border-radius:12px;"><tr><td style="padding:14px 16px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.text};white-space:pre-wrap;">${esc(from)}<br>${esc(subject)}<br><br>${esc(quoted)}</td></tr></table>`,
  ].join(""));
  const plain = `${leadText}\n${unsubscribe ? "" : "Hit Reply to answer them directly.\n"}\nFrom: ${from}\nSubject: ${subject}\n\n${quoted}`;
  const subj = unsubscribe ? `Stopped: ${item?.name || from} asked for no more follow-ups` : `${auto ? "Auto-reply" : "Reply"} from ${item?.name || from}: ${subject || "(no subject)"}`;
  return { subject: subj.slice(0, 180), html, text: plain };
}

// ---------- owner -> their customer ----------
// Plain on purpose: it should read like a note from the owner, not a newsletter.
// actions (optional): { yes, ask, pay } URLs. Each one shows as a button only when its URL and its label (by job kind) exist.
export function followUpEmail(item, settings, unsubUrl, actions = {}) {
  const m = message(item, settings);
  const labels = ACTIONS[item.kind] || ACTIONS.estimate;
  const btns = ["yes", "ask", "pay"].filter((k) => actions[k] && labels[k]).map((k) => ({ k, label: labels[k], href: actions[k] }));
  const paras = m.body.split(/\n{2,}/).map((para) => `<p style="margin:0 0 14px 0;">${esc(para).replace(/\n/g, "<br>")}</p>`).join("");
  const btnHtml = btns.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 4px 0;"><tr>${btns.map((b, i) => `<td style="padding:0 8px 8px 0;"><a href="${esc(b.href)}" style="display:inline-block;padding:10px 16px;border-radius:8px;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;${i === 0 ? "background:#1f2937;color:#ffffff;border:1px solid #1f2937;" : "background:#ffffff;color:#1f2937;border:1px solid #c7cbd1;"}">${esc(b.label)}</a></td>`).join("")}</tr></table>`
    : "";
  const foot = `<p style="margin:22px 0 0 0;font-size:12px;color:#777;">Sent for ${esc(settings.business)} by NeonKey Follow-Up Desk. Reply to reach ${esc(settings.business)} directly. <a href="${esc(unsubUrl)}" style="color:#777;">Stop these emails</a>.</p>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body style="margin:0;padding:16px;font-family:${FONT};font-size:15px;line-height:1.55;color:#222;background:#fff;">${paras}${btnHtml}${foot}</body></html>`;
  const btnText = btns.length ? `\n\n${btns.map((b) => `${b.label}: ${b.href}`).join("\n")}` : "";
  const text = `${m.body}${btnText}\n\n--\nSent for ${settings.business} by NeonKey Follow-Up Desk. Reply to reach ${settings.business} directly. Stop these emails: ${unsubUrl}`;
  return { subject: m.subject, html, text };
}

// The customer tapped a button. The owner hears right away; hitting Reply answers the customer.
export function actionEmail({ item, action, note, phone, preview = false }) {
  const who = item.name || item.email;
  const job = item.job ? ` ${item.job}` : "";
  const headline = action === "yes"
    ? (item.kind === "inquiry" ? `${who} wants to set up a time${job ? ` about${job}` : ""}` : `${who} wants to go ahead${job ? ` with${job}` : ""}`)
    : `${who} has a question${job ? ` about${job}` : ""}`;
  const lines = [
    note ? `Their message: ${note}` : "",
    phone ? `Phone: ${phone}` : "",
    `Email: ${item.email}`,
  ].filter(Boolean);
  const subject = `${preview ? "[Preview] " : ""}${action === "yes" ? "Good news: " : "Question: "}${headline}`.slice(0, 180);
  const html = shell(headline, [
    p(`<strong>${esc(headline)}.</strong> ${action === "yes" ? "They tapped the button in your follow-up. Follow-ups for this job are stopped." : "They tapped \"I have a question\" in your follow-up. Follow-ups for this job are stopped."}`),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;background:${C.panel};border:1px solid ${C.line};border-left:3px solid ${action === "yes" ? C.green : C.cyan};border-radius:12px;"><tr><td style="padding:14px 16px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.text};white-space:pre-wrap;">${lines.map(esc).join("<br>")}</td></tr></table>`,
    p("Hit Reply to answer them directly.", `color:${C.muted};font-size:14px;`),
  ].join(""));
  const text = `${headline}.\n${action === "yes" ? "They tapped the button in your follow-up." : "They tapped \"I have a question\" in your follow-up."} Follow-ups for this job are stopped.\n\n${lines.join("\n")}\n\nHit Reply to answer them directly.`;
  return { subject, html, text };
}

// Trial nudge n (0, 1, 2): sent only while the account has no follow-ups yet.
export function nudgeEmail({ n, name, link, setupDone, trialing }) {
  const hiText = firstName(name) === "there" ? "Hi," : `Hi ${firstName(name)},`;
  const first = setupDone ? "Your Follow-Up Desk is set up, but there's nothing in it to follow up on yet." : "Your Follow-Up Desk is waiting on two minutes of setup.";
  const ask = setupDone
    ? "Add one estimate you're still waiting to hear back on. That's all it takes: the follow-ups go out on their own, and a reply stops them."
    : "Add your business name and how you sign off, then one estimate you're still waiting on. The follow-ups go out on their own, and a reply stops them.";
  const last = n === 2 && trialing ? "Your free trial ends in a few days. If the Desk isn't a fit, you can cancel from the Billing button on your dashboard and you won't be charged." : "";
  const subject = ["Add your first estimate (2 minutes)", "Any estimates you're still waiting on?", "Still want help with follow-ups?"][n] || "Your Follow-Up Desk";
  const html = shell(subject, [
    p(esc(hiText)),
    p(esc(first)),
    p(esc(ask)),
    button(link, setupDone ? "Add an estimate" : "Finish setup"),
    last ? p(esc(last), `font-size:14px;color:${C.muted};`) : "",
    p("Questions, or want a hand getting started? Just reply.", `font-size:14px;color:${C.muted};`),
  ].join(""));
  const text = `${hiText}\n\n${first}\n\n${ask}\n\n${link}\n\n${last ? last + "\n\n" : ""}Questions, or want a hand getting started? Just reply.\n\nNeonKey`;
  return { subject, html, text };
}

// ---------- notices to hello@ ----------
export function noticeEmail(kind, acct, extra = "") {
  const titles = { new: "New Follow-Up Desk signup", canceled: "Follow-Up Desk canceled", billing: "Follow-Up Desk billing changed", error: "Follow-Up Desk problem" };
  // No account (an alert from the hourly run or a failed request): just the details.
  const lines = !acct ? String(extra).split("\n") : [
    `Account: ${acct?.id || "?"}`,
    `Buyer: ${acct?.name || ""} <${acct?.email || "?"}>`,
    `Business: ${acct?.settings?.business || "(not set yet)"}`,
    `Billing: ${acct?.billing || "?"}`,
    `Open follow-ups: ${(acct?.items || []).filter((i) => i.status === "open").length}`,
    extra,
  ].filter(Boolean);
  const urgent = kind === "error";
  const subject = `${urgent ? "🚨 URGENT · ACTION NEEDED" : "FYI"}: ${titles[kind] || kind}${acct?.settings?.business ? ` (${acct.settings.business})` : ""}`;
  return { subject, html: shell(subject, lines.map((l) => p(esc(l), "margin-bottom:6px;")).join("")), text: lines.join("\n"), urgent };
}

// ---------- sending ----------
export async function resend(env, payload, idem) {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", ...(idem ? { "Idempotency-Key": idem } : {}) },
      body: JSON.stringify(payload),
    });
    if (!r.ok) console.log("desk: resend failed", r.status);
    return r.ok;
  } catch {
    console.log("desk: resend error");
    return false;
  }
}

const testTag = (acct) => (acct && !acct.livemode ? "[TEST] " : "");

export function sendOwner(env, acct, mail, idem, { to, replyTo, bcc = true, attachments } = {}) {
  return resend(env, {
    from: env.FROM_ADDRESS,
    to: [to || acct.settings.replyTo || acct.email],
    reply_to: replyTo || env.REPLY_TO,
    ...(bcc && env.BCC_ADDRESS ? { bcc: [env.BCC_ADDRESS] } : {}),
    subject: `${testTag(acct)}${mail.subject}`,
    html: mail.html,
    text: mail.text,
    ...(attachments?.length ? { attachments } : {}),
    tags: [{ name: "kind", value: "desk_owner" }],
  }, idem);
}

export function sendNotice(env, kind, acct, extra) {
  const n = noticeEmail(kind, acct, extra);
  return resend(env, {
    from: env.FROM_ADDRESS,
    to: [env.NOTIFY_TO],
    ...(env.BCC_ADDRESS ? { bcc: [env.BCC_ADDRESS] } : {}),
    ...(acct?.email ? { reply_to: acct.email } : {}),
    subject: `${testTag(acct)}${n.subject}`,
    html: n.html,
    text: n.text,
    ...(n.urgent ? { headers: { "X-Priority": "1 (Highest)", Importance: "high", Priority: "urgent" } } : {}),
    tags: [{ name: "kind", value: "desk_notice" }],
  }, `desk-notice-${kind}-${acct?.id || "x"}-${Math.floor(Date.now() / 3600000)}`);
}

export const replyAddress = (env, acctId, itemId) => `r-${acctId}-${itemId}@${env.DESK_DOMAIN}`;

// Display name: the business, with characters that would break the header removed.
export function fromAddress(env, business) {
  const name = String(business || "Follow-Up Desk").replace(/["<>\\\r\n,;:@]/g, "").trim().slice(0, 60) || "Follow-Up Desk";
  return `"${name}" <followups@${env.DESK_DOMAIN}>`;
}

export function actionUrls(env, acct, item) {
  const s = acct.settings;
  const base = `${env.APP_URL}/a/${acct.id}/${item.id}`;
  return {
    ...(s.buttons !== false ? { yes: `${base}/yes`, ask: `${base}/ask` } : {}),
    ...(s.payUrl ? { pay: s.payUrl } : {}),
  };
}

export function sendFollowUp(env, acct, item, { test = false } = {}) {
  const s = acct.settings;
  const unsub = `${env.APP_URL}/u/${acct.id}/${item.id}`;
  const mail = followUpEmail(item, s, unsub, actionUrls(env, acct, item));
  const reply = replyAddress(env, acct.id, item.id);
  const to = test ? s.replyTo : item.email;
  return resend(env, {
    from: fromAddress(env, s.business),
    to: [to],
    reply_to: reply,
    ...(!test && s.bccMe && s.replyTo ? { bcc: [s.replyTo] } : {}),
    subject: `${testTag(acct)}${test ? "[Preview] " : ""}${mail.subject}`,
    html: mail.html,
    text: mail.text,
    headers: { "List-Unsubscribe": `<${unsub}>, <mailto:${reply}?subject=stop>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    tags: [{ name: "kind", value: "desk_followup" }, { name: "acct", value: acct.id }, { name: "item", value: item.id }],
  }, test ? undefined : `desk-${acct.id}-${item.id}-${item.step || 0}`);
}

export { KINDS };
