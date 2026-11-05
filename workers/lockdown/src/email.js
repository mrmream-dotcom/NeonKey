// Branded Email Lockdown emails (table layout, inline CSS, matches the Unlock the Week newsletter).
// Every builder returns { subject, html, text }.

const C = { bg: "#0b0d17", panel: "#151935", line: "#262b52", text: "#e8eaf6", muted: "#b3b8d6", cyan: "#22d3ee", violet: "#a78bfa", magenta: "#f472b6", amber: "#fbbf24", green: "#34d399" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function firstName(name) {
  const n = String(name || "").trim().split(/\s+/)[0];
  if (!n || n.length > 40 || /[<>@\/\\:;{}\[\]"=]|https?/i.test(n)) return null;
  return n;
}

const p = (html, extra = "") => `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.text};${extra}">${html}</p>`;
const h2 = (t, color = C.cyan) => `<p style="margin:24px 0 10px 0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${color};">${esc(t)}</p>`;
const link = (href, label) => `<a href="${esc(href)}" style="color:${C.cyan};font-weight:700;text-decoration:none;">${esc(label)}</a>`;

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
<td align="right" style="font-family:${FONT};font-size:10px;letter-spacing:2px;color:${C.muted};">UNLOCK TECH, WHATEVER YOUR LEVEL</td>
</tr></table></td></tr>
<tr><td style="padding:12px 28px 8px 28px;">${body}</td></tr>
<tr><td style="padding:8px 28px 26px 28px;border-top:1px solid ${C.line};">
<p style="margin:16px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted};">NeonKey · <a href="mailto:hello@neonkey.tech" style="color:${C.cyan};text-decoration:none;">hello@neonkey.tech</a> · <a href="https://neonkey.tech/" style="color:${C.cyan};text-decoration:none;">neonkey.tech</a><br>We never ask for passwords. Your records are public, so we checked them without logging in to anything.</p>
</td></tr></table></td></tr></table></body></html>`;
}

function recordCard(f, i) {
  const row = (k, v, mono = false) => `<tr><td valign="top" style="padding:4px 12px 4px 0;font-family:${FONT};font-size:13px;color:${C.muted};white-space:nowrap;">${k}</td><td style="padding:4px 0;font-family:${mono ? MONO : FONT};font-size:${mono ? 14 : 14}px;color:${C.text};word-break:break-all;">${esc(v)}</td></tr>`;
  const verb = f.action === "replace" ? "Edit your existing record" : "Add a new record";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;background:${C.panel};border:1px solid ${C.line};border-radius:12px;"><tr><td style="padding:14px 16px;">
<p style="margin:0 0 6px 0;font-family:${FONT};font-size:15px;font-weight:700;color:${C.text};"><span style="color:${C.cyan};">${i + 1}.</span> ${esc(f.id.toUpperCase())}: ${verb}</p>
<p style="margin:0 0 10px 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">${esc(f.why)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
${row("Type", f.type)}${row("Name / Host", f.host, true)}${f.current ? row("Replace this", f.current, true) : ""}${row(f.current ? "With this" : "Value", f.value, true)}${row("TTL", "Leave the default (or 1 hour)")}
</table></td></tr></table>`;
}

function stepCard(s) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;background:${C.panel};border:1px solid ${C.line};border-left:3px solid ${C.violet};border-radius:12px;"><tr><td style="padding:14px 16px;">
<p style="margin:0 0 6px 0;font-family:${FONT};font-size:15px;font-weight:700;color:${C.text};">${esc(s.title)}</p>
<p style="margin:0 0 8px 0;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.muted};">${esc(s.text)}</p>
<p style="margin:0;font-family:${FONT};font-size:14px;">${link(s.help, "Official step-by-step guide")}</p></td></tr></table>`;
}

function hostLine(a) {
  if (a.dnsHost.label && a.dnsHost.help) return `Your domain's records are managed at <strong>${esc(a.dnsHost.label)}</strong>. Their guide: ${link(a.dnsHost.help, `adding a record at ${a.dnsHost.label}`)}. Sign in there, open the DNS settings for ${esc(a.domain)}, and add each record below.`;
  return `Sign in where you manage your domain (usually where you bought it), open the DNS settings for ${esc(a.domain)}, and add each record below. Not sure where that is? Just reply and we'll find it with you.`;
}

const hostText = (a) => (a.dnsHost.label ? `Your records are managed at ${a.dnsHost.label}. Guide: ${a.dnsHost.help}` : "Sign in where you manage your domain (usually where you bought it) and open its DNS settings.");

function recordsText(a) {
  return a.fixes.map((f, i) => `${i + 1}. ${f.id.toUpperCase()} (${f.action === "replace" ? "edit your existing record" : "add a new record"})\n   ${f.why}\n   Type: ${f.type}\n   Name/Host: ${f.host}\n${f.current ? `   Replace this: ${f.current}\n   With this: ${f.value}` : `   Value: ${f.value}`}`).join("\n\n");
}
const stepsText = (a) => a.buyerSteps.map((s) => `- ${s.title}: ${s.text}\n  Guide: ${s.help}`).join("\n\n");

// Upsell (Michael, Nov 4 2026: the $49 is credited toward any package). Specific to what the audit detected,
// and always after the result: deliver first, offer relevant help second, broader services third.
const SERVICES = "https://neonkey.tech/services/";
function upsell(a) {
  const ws = a.provider && /Google|Microsoft/.test(a.provider.label) ? a.provider.label : null;
  return {
    title: "Your $49 counts toward any NeonKey package",
    html: ws
      ? `Since you're on <strong>${esc(ws)}</strong>, these records are only part of the picture. The <a href="https://neonkey.tech/services/remote-it/?utm_source=lockdown&utm_medium=email" style="color:${C.cyan};font-weight:700;text-decoration:none;">Remote Small-Office IT Setup</a> also covers 2-step sign-in, a password manager and backups: from $299, or from $250 with your $49 credit. Want every new lead answered and followed up too? The <a href="https://neonkey.tech/services/?utm_source=lockdown&utm_medium=email#front-office-package" style="color:${C.cyan};font-weight:700;text-decoration:none;">Front Office Package</a> is $950 after your credit.`
      : `Going further, like a full remote IT setup (from $250 after your credit) or the Front Office Package ($950 after your credit)? We take the $49 you paid for this Lockdown off the price. <a href="${SERVICES}?utm_source=lockdown&utm_medium=email" style="color:${C.cyan};font-weight:700;text-decoration:none;">See the packages</a>.`,
    text: ws
      ? `Your $49 counts toward any NeonKey package. Since you're on ${ws}, these records are only part of the picture: the Remote Small-Office IT Setup also covers 2-step sign-in, a password manager and backups (from $299, or from $250 with your $49 credit): https://neonkey.tech/services/remote-it/ . The Front Office Package is $950 after your credit.`
      : `Your $49 counts toward any NeonKey package: a full remote IT setup is from $250 after your credit, the Front Office Package $950. ${SERVICES}`,
  };
}
function creditBlock(a) {
  const u = upsell(a);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 16px 0;background:${C.panel};border:1px solid ${C.line};border-left:3px solid ${C.magenta};border-radius:12px;"><tr><td style="padding:14px 16px;">
<p style="margin:0 0 6px 0;font-family:${FONT};font-size:15px;font-weight:700;color:${C.text};">${u.title}</p>
<p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.muted};">${u.html}</p></td></tr></table>`;
}

// Two ways to finish, shown ABOVE the steps. Done-for-you is included in the $49 (services page, Nov 4 2026).
function twoWays(a) {
  const host = a.dnsHost?.label ? esc(a.dnsHost.label) : "your domain host";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 14px 0;"><tr>
<td width="50%" valign="top" style="padding:0 6px 0 0;"><div style="background:${C.panel};border:1px solid ${C.line};border-radius:12px;padding:12px 14px;font-family:${FONT};"><p style="margin:0 0 4px 0;font-size:12px;letter-spacing:1.5px;font-weight:700;color:${C.cyan};">OPTION A</p><p style="margin:0;font-size:14px;line-height:1.5;color:${C.text};"><strong>Do it yourself</strong> with the steps below.</p></div></td>
<td width="50%" valign="top" style="padding:0 0 0 6px;"><div style="background:${C.panel};border:1px solid ${C.violet};border-radius:12px;padding:12px 14px;font-family:${FONT};"><p style="margin:0 0 4px 0;font-size:12px;letter-spacing:1.5px;font-weight:700;color:${C.violet};">OPTION B · INCLUDED</p><p style="margin:0;font-size:14px;line-height:1.5;color:${C.text};"><strong>We put them in for you.</strong> Reply "do it" and we'll walk you through inviting us as a helper at ${host}. No passwords shared.</p></div></td>
</tr></table>`;
}
const twoWaysText = (a) => `TWO WAYS TO FINISH\nA) Do it yourself with the steps below.\nB) Included in your $49: reply "do it" and we'll walk you through inviting us as a helper at ${a.dnsHost?.label || "your domain host"}, then put the records in for you. No passwords shared.`;

const ATTACH_NOTE = "Your full report is attached. Open it in any browser, and save or print it as a PDF for your records.";

// 1. First email, right after payment.
export function reportEmail({ name, a }) {
  const hi = firstName(name) ? `Hi ${esc(firstName(name))},` : "Hi there,";
  const hiT = firstName(name) ? `Hi ${firstName(name)},` : "Hi there,";
  const personal = a.human.length > 0;

  if (a.locked && !personal) {
    const subject = `🔑 Your Email Lockdown report for ${a.domain}: records already in place`;
    const body = `${p(hi)}${p(`Thanks for your order. We checked <strong>${esc(a.domain)}</strong>, and the three records that protect your email (SPF, DKIM and DMARC) are already published.`)}${p(`There's nothing for you to add. ${ATTACH_NOTE}`)}${p("Reply if you'd like a hand moving DMARC from monitor mode to blocking fake mail.", "font-size:15px;")}${creditBlock(a)}${p("NeonKey", `color:${C.muted};`)}`;
    return { subject, html: shell(`${a.domain}: records already in place.`, body), text: `${hiT}\n\nThanks for your order. We checked ${a.domain}, and SPF, DKIM and DMARC are already published. There's nothing for you to add. ${ATTACH_NOTE}\n\n${upsell(a).text}\n\nNeonKey\nhello@neonkey.tech` };
  }

  if (!a.fixes.length && !a.buyerSteps.length) {
    const subject = `🔑 Your Email Lockdown order for ${a.domain}: one quick check`;
    const body = `${p(hi)}${p(`Thanks for your order. We started checking <strong>${esc(a.domain)}</strong> and found something we want a person to look at before we send records, so nothing goes in wrong.`)}${p("We'll email you within 1 business day. If the domain you typed at checkout has a typo, just reply with the right one.")}${p("NeonKey", `color:${C.muted};`)}`;
    return { subject, html: shell("A person is taking a quick look at your setup.", body), text: `${hiT}\n\nThanks for your order. We started checking ${a.domain} and want a person to look at something before we send records. We'll email you within 1 business day. If the domain you typed at checkout has a typo, just reply with the right one.\n\nNeonKey\nhello@neonkey.tech` };
  }

  const total = a.fixes.length + a.buyerSteps.length;
  const subject = `🔑 Your Email Lockdown report: ${total} ${total === 1 ? "step" : "steps"} for ${a.domain}`;
  let body = p(hi) + p(`Thanks for your order. We checked the public email records for <strong>${esc(a.domain)}</strong>${a.provider ? ` (email by ${esc(a.provider.label)})` : ""}. ${ATTACH_NOTE}`);
  body += twoWays(a);
  if (a.fixes.length) body += h2("Records to add") + p(hostLine(a), `font-size:15px;color:${C.muted};`) + a.fixes.map(recordCard).join("");
  if (a.buyerSteps.length) body += h2("One setting to check", C.violet) + a.buyerSteps.map(stepCard).join("");
  if (personal) body += h2("We'll handle the rest", C.amber) + p("Part of your setup needs a closer look by a person, so we'll follow up by email within 1 business day about it. You can still add the records above now.", `font-size:15px;color:${C.muted};`);
  body += h2("What happens next") + p("We'll recheck your public records on day 2 and day 5 and email you an updated report showing what's published and what's still open.", `font-size:15px;`);
  if (a.notes.length) body += p(a.notes.map(esc).join(" "), `font-size:14px;color:${C.muted};`);
  body += creditBlock(a) + p("Questions or stuck on a step? Just reply to this email.", `font-size:15px;`) + p("NeonKey", `color:${C.muted};`);

  const text = `${hiT}\n\nThanks for your order. We checked the public email records for ${a.domain}${a.provider ? ` (email by ${a.provider.label})` : ""}. ${ATTACH_NOTE}\n\n${twoWaysText(a)}\n\n${a.fixes.length ? `RECORDS TO ADD\n${hostText(a)}\n\n${recordsText(a)}\n\n` : ""}${a.buyerSteps.length ? `ONE SETTING TO CHECK\n${stepsText(a)}\n\n` : ""}${personal ? "Part of your setup needs a closer look by a person, so we'll follow up within 1 business day.\n\n" : ""}WHAT HAPPENS NEXT\nWe'll recheck your public records on day 2 and day 5 and email you an updated report.\n${a.notes.length ? `\n${a.notes.join(" ")}\n` : ""}\n${upsell(a).text}\n\nQuestions? Just reply.\n\nNeonKey\nhello@neonkey.tech`;
  return { subject, html: shell(`Exactly what to add for ${a.domain}.`, body), text };
}

// 2. Recheck passed: the "after" report is attached.
export function doneEmail({ name, a, before }) {
  const hi = firstName(name) ? `Hi ${esc(firstName(name))},` : "Hi there,";
  const hiT = firstName(name) ? `Hi ${firstName(name)},` : "Hi there,";
  const from = before != null ? ` (up from ${before} of 4 on your first check)` : "";
  const subject = `🔑 ${a.domain}: all four records published`;
  const body = `${p(hi)}${p(`Good news: we rechecked <strong>${esc(a.domain)}</strong>, and SPF, DKIM and DMARC are all published and pass our public-records check${from}. Your updated report is attached as your "after" copy.`)}${h2("What changed")}${p("Inboxes can now check that mail claiming to be from you really is, and mail that fakes your address gets reported. DMARC is in monitor mode: it reports fakes but doesn't block them yet.", "font-size:15px;")}${h2("What to watch for")}${p("When you start using a new tool that sends email as you (a newsletter, invoicing or booking app), look for its \"authenticate your domain\" setting. Once a few weeks of real mail pass, DMARC can move from monitor mode to blocking fakes. Reply any time and we'll help.", "font-size:15px;")}${creditBlock(a)}${p("Thanks for trusting NeonKey with this.")}${p("NeonKey", `color:${C.muted};`)}`;
  return { subject, html: shell(`${a.domain}: SPF, DKIM and DMARC published.`, body), text: `${hiT}\n\nGood news: we rechecked ${a.domain}, and SPF, DKIM and DMARC are all published and pass our public-records check${from}. Your updated report is attached.\n\nWhat changed: inboxes can now check that mail claiming to be from you really is, and fakes get reported. DMARC is in monitor mode: it reports fakes but doesn't block them yet.\n\nWhat to watch for: when you add a new tool that sends email as you, turn on its "authenticate your domain" setting. Later, DMARC can move to blocking fakes. Reply any time.\n\n${upsell(a).text}\n\nNeonKey\nhello@neonkey.tech` };
}

// 3. Day 5, still open: lead with doing it for them (included), then the stack-specific upgrade.
export function reminderEmail({ name, a, passing }) {
  const hi = firstName(name) ? `Hi ${esc(firstName(name))},` : "Hi there,";
  const hiT = firstName(name) ? `Hi ${firstName(name)},` : "Hi there,";
  const n = a.fixes.length + a.buyerSteps.length;
  const subject = `🔑 ${a.domain} is at ${passing} of 4. Want us to finish it?`;
  const host = a.dnsHost?.label || "your domain host";
  let body = p(hi) + p(`We rechecked <strong>${esc(a.domain)}</strong> today. It's at <strong>${passing} of 4</strong> checks, with ${n} ${n === 1 ? "step" : "steps"} still open. Your updated report is attached.`);
  body += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 16px 0;background:${C.panel};border:1px solid ${C.violet};border-radius:12px;"><tr><td style="padding:14px 16px;font-family:${FONT};"><p style="margin:0 0 6px 0;font-size:16px;font-weight:700;color:${C.text};">Rather not deal with ${esc(host)}${a.provider ? ` and ${esc(a.provider.label)}` : ""}?</p><p style="margin:0;font-size:15px;line-height:1.55;color:${C.muted};">Reply <strong style="color:${C.text};">DO IT</strong>. We'll walk you through a quick helper invite (no passwords shared) and finish your Email Lockdown for you, at no extra cost.</p></td></tr></table>`;
  if (a.fixes.length) body += h2("Still to add") + p(hostLine(a), `font-size:15px;color:${C.muted};`) + a.fixes.map(recordCard).join("");
  if (a.buyerSteps.length) body += h2("Still to check", C.violet) + a.buyerSteps.map(stepCard).join("");
  body += p("Just added something? New records can take an hour or two to show up.", `font-size:14px;color:${C.muted};`) + creditBlock(a) + p("NeonKey", `color:${C.muted};`);
  const text = `${hiT}\n\nWe rechecked ${a.domain} today. It's at ${passing} of 4 checks, with ${n} ${n === 1 ? "step" : "steps"} still open. Your updated report is attached.\n\nRather not deal with ${host}? Reply DO IT. We'll walk you through a quick helper invite (no passwords shared) and finish it for you at no extra cost.\n\n${a.fixes.length ? `${hostText(a)}\n\n${recordsText(a)}\n\n` : ""}${a.buyerSteps.length ? `${stepsText(a)}\n\n` : ""}${upsell(a).text}\n\nNeonKey\nhello@neonkey.tech`;
  return { subject, html: shell(`${a.domain} is at ${passing} of 4. Reply DO IT and we'll finish it.`, body), text };
}

// Internal notice to hello@ (BCC Michael). Subject starts with ACTION NEEDED only when a person must step in.
export function noticeEmail({ kind, order, a, extra }) {
  const action = kind === "stuck" || (kind === "new" && a.human.length > 0) || kind === "error";
  const label = { new: "new order", done: "locked down", reminder: "reminder sent", stuck: "not finished after 10 days", error: "audit failed" }[kind] || kind;
  const subject = `${action ? "ACTION NEEDED" : "FYI"}: Email Lockdown ${label} · ${order.domain || order.rawDomain}`;
  const rows = [
    ["Buyer", `${order.name || ""} <${order.email}>`.trim()],
    ["Domain", order.domain || `(couldn't read "${order.rawDomain}")`],
    ["Email provider", a?.provider?.label || "-"],
    ["DNS host", a?.dnsHost?.label || "unknown"],
    ["Stripe session", order.id],
    ["Records sent", a ? a.fixes.map((f) => `${f.id} (${f.action})`).join(", ") || "none" : "-"],
    ["Buyer clicks", a ? a.buyerSteps.map((s) => s.id).join(", ") || "none" : "-"],
    ["Customer email", order.customerMode === "send" ? "sent to buyer" : "SHADOW: sent to hello@ only, not the buyer"],
  ];
  const needs = a?.human?.length ? a.human : [];
  const text = [`${subject}`, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", ...(needs.length ? ["Needs a person:", ...needs.map((h) => `- ${h}`), ""] : []), ...(extra ? [extra, ""] : []), action ? "Reply to the buyer from hello@ (reply-to is set to them)." : "Nothing to do. This is automatic."].join("\n");
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p style="font-size:17px;margin:0 0 12px"><strong>${esc(subject)}</strong></p>
<table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#555">${esc(k)}</td><td style="padding:2px 0">${esc(v)}</td></tr>`).join("")}</table>
${needs.length ? `<p style="margin:14px 0 4px"><strong>Needs a person:</strong></p><ul style="margin:0">${needs.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
${extra ? `<p style="margin:14px 0 0">${esc(extra)}</p>` : ""}
<p style="margin:14px 0 0;color:#555">${action ? "Reply to the buyer from hello@ (reply-to is set to them)." : "Nothing to do. This is automatic."}</p></div>`;
  return { subject, html, text };
}
