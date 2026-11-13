// Founder Watchdog emails. Same branded shell as the Email Lockdown emails (table layout, inline CSS).
// Every builder returns { subject, html, text }. Every dynamic string is escaped.
const C = { bg: "#0b0d17", panel: "#151935", line: "#262b52", text: "#e8eaf6", muted: "#b3b8d6", cyan: "#22d3ee", violet: "#a78bfa", magenta: "#f472b6", amber: "#fbbf24", green: "#34d399", red: "#f87171" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const SEV = { critical: { color: C.red, label: "Broken" }, warning: { color: C.amber, label: "Check this" }, info: { color: C.cyan, label: "FYI" } };

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
const p = (html, extra = "") => `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.text};${extra}">${html}</p>`;
const small = (html) => `<p style="margin:0 0 12px 0;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.muted};">${html}</p>`;
const h2 = (t, color = C.cyan) => `<p style="margin:24px 0 10px 0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${color};">${esc(t)}</p>`;
const link = (href, label) => `<a href="${esc(href)}" style="color:${C.cyan};font-weight:700;text-decoration:none;">${esc(label)}</a>`;
const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px 0;"><tr><td style="border-radius:10px;background:${C.cyan};"><a href="${esc(href)}" style="display:inline-block;padding:11px 18px;font-family:${FONT};font-size:15px;font-weight:700;color:#0b0d17;text-decoration:none;">${esc(label)}</a></td></tr></table>`;

function shell(preheader, body, ctx) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>NeonKey</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${C.bg};border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
<tr><td style="height:4px;line-height:4px;font-size:0;background:${C.cyan};background-image:linear-gradient(90deg,${C.cyan},${C.violet},${C.magenta});">&nbsp;</td></tr>
<tr><td style="padding:24px 28px 8px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td><img src="https://neonkey.tech/email/neonkey-logo.png" alt="NeonKey" height="34" style="display:block;height:34px;border:0;"></td>
<td align="right" style="font-family:${FONT};font-size:10px;letter-spacing:2px;color:${C.muted};">FOUNDER WATCHDOG</td>
</tr></table></td></tr>
<tr><td style="padding:12px 28px 8px 28px;">${body}</td></tr>
<tr><td style="padding:8px 28px 26px 28px;border-top:1px solid ${C.line};">
<p style="margin:16px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted};">NeonKey · <a href="mailto:hello@neonkey.tech" style="color:${C.cyan};text-decoration:none;">hello@neonkey.tech</a> · <a href="https://neonkey.tech/founders/watchdog/" style="color:${C.cyan};text-decoration:none;">Founder Watchdog</a><br>We only read public records (DNS, your homepage, the domain registry). We never ask for passwords and never change anything.${ctx?.portal ? `<br>Billing, plan or cancel: <a href="${esc(ctx.portal)}" style="color:${C.cyan};text-decoration:none;">manage your subscription</a>.` : ""}${ctx?.address ? `<br>${esc(ctx.address)}` : ""}</p>
</td></tr></table></td></tr></table></body></html>`;
}
const footText = (ctx) => ["", "NeonKey · hello@neonkey.tech", "We only read public records. We never ask for passwords and never change anything.", ...(ctx?.portal ? [`Billing, plan or cancel: ${ctx.portal}`] : []), ...(ctx?.address ? [ctx.address] : [])].join("\n");

function recordBox(rec) {
  const row = (k, v) => `<tr><td valign="top" style="padding:4px 12px 4px 0;font-family:${FONT};font-size:13px;color:${C.muted};white-space:nowrap;">${k}</td><td style="padding:4px 0;font-family:${MONO};font-size:14px;color:${C.text};word-break:break-all;">${esc(v)}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;background:${C.panel};border:1px solid ${C.line};border-radius:12px;"><tr><td style="padding:14px 16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0">${row("Type", rec.type)}${row("Name / Host", rec.name)}${row("Value", rec.value)}${row("TTL", "Leave the default")}</table></td></tr></table>`;
}
function alertCard(a) {
  const s = SEV[a.severity] || SEV.info;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;background:${C.panel};border:1px solid ${C.line};border-left:3px solid ${s.color};border-radius:12px;"><tr><td style="padding:14px 16px;">
<p style="margin:0 0 4px 0;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${s.color};">${s.label}</p>
<p style="margin:0 0 6px 0;font-family:${FONT};font-size:16px;font-weight:700;color:${C.text};">${esc(a.title)}</p>
<p style="margin:0 0 8px 0;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.muted};">${esc(a.detail)}</p>
${a.fix ? `<p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.text};"><strong>What to do:</strong> ${esc(a.fix)}</p>` : ""}</td></tr></table>`;
}
const alertText = (a) => [`[${(SEV[a.severity] || SEV.info).label.toUpperCase()}] ${a.title}`, a.detail, ...(a.fix ? [`What to do: ${a.fix}`] : []), ""];

/** Sent right after checkout: the one TXT record that proves they control the domain. */
export function welcomeEmail({ domain, record, dnsHost, dnsHelp }, ctx) {
  const where = dnsHost ? `Your domain's DNS is managed at <strong>${esc(dnsHost)}</strong>${dnsHelp ? ` (${link(dnsHelp, "their guide to adding a record")})` : ""}.` : "Sign in wherever you manage your domain's DNS (often the company you bought the domain from).";
  const body = [
    p(`Thanks for subscribing to Founder Watchdog. Before we start watching <strong>${esc(domain)}</strong>, we need to know it's yours.`),
    p(`Add this one TXT record. It changes nothing about your email or website; it just proves you control the domain.`),
    small(where),
    recordBox(record),
    p("We check for it every hour. As soon as it shows up, we take a first look at your records and email you what we found. Most DNS hosts publish a new record within minutes; some take a few hours."),
    small(`Wrong domain, or someone else manages your DNS? Reply to this email and we'll sort it out.`),
  ].join("\n");
  const text = [`Thanks for subscribing to Founder Watchdog. Before we start watching ${domain}, we need to know it's yours.`, "", "Add this one TXT record. It changes nothing about your email or website.", "", `Type: ${record.type}`, `Name / Host: ${record.name}`, `Value: ${record.value}`, "", dnsHost ? `Your DNS is managed at ${dnsHost}.${dnsHelp ? ` Guide: ${dnsHelp}` : ""}` : "Add it wherever you manage your domain's DNS.", "", "We check for it every hour and email you as soon as it shows up.", "Wrong domain? Reply to this email.", footText(ctx)].join("\n");
  return { subject: `One step to start watching ${domain}`, html: shell(`Add one TXT record so we can start watching ${domain}.`, body, ctx), text };
}

export function reminderEmail({ domain, record }, ctx) {
  const body = [p(`We haven't seen the verification record on <strong>${esc(domain)}</strong> yet, so Founder Watchdog isn't watching it yet.`), recordBox(record), small("If you added it already, check the name is exactly as above (some DNS hosts add your domain to the end automatically, so the name field may only need <strong>_neonkey-watchdog</strong>). Reply if you're stuck and we'll help.")].join("\n");
  const text = [`We haven't seen the verification record on ${domain} yet, so Founder Watchdog isn't watching it yet.`, "", `Type: ${record.type}`, `Name / Host: ${record.name}`, `Value: ${record.value}`, "", "Some DNS hosts add your domain automatically, so the name may only need _neonkey-watchdog. Reply if you're stuck.", footText(ctx)].join("\n");
  return { subject: `Still waiting to start watching ${domain}`, html: shell(`The verification record isn't showing yet on ${domain}.`, body, ctx), text };
}

function healthBlock(problems) {
  if (!problems.length) return { html: p(`<span style="color:${C.green};font-weight:700;">Everything we watch looks healthy right now.</span>`), text: ["Everything we watch looks healthy right now."] };
  return {
    html: h2("Already worth fixing", C.amber) + problems.map((x) => small(`<span style="color:${(SEV[x.severity] || SEV.info).color};font-weight:700;">${esc((SEV[x.severity] || SEV.info).label)}:</span> ${esc(x.text)}`)).join(""),
    text: ["Already worth fixing:", ...problems.map((x) => `- ${(SEV[x.severity] || SEV.info).label}: ${x.text}`)],
  };
}
function statusLines(snap, web, expiresAt) {
  const dk = Object.keys(snap.dkim || {}).filter((k) => snap.dkim[k]);
  return [
    ["Email provider", snap.provider || (snap.mx?.length ? "not recognized" : "none (no MX records)")],
    ["DNS host", snap.dnsHost || (snap.ns || []).join(", ") || "unknown"],
    ["SPF", snap.spf?.count === 1 ? `${snap.spf.record}` : snap.spf?.count > 1 ? "two records (a problem)" : "none"],
    ["DMARC", snap.dmarc?.count === 1 ? `p=${snap.dmarc.policy}` : snap.dmarc?.count > 1 ? "two records (a problem)" : "none"],
    ["DKIM keys found", dk.length ? dk.join(", ") : "none at the usual names"],
    ["Homepage", web ? (web.up ? `loads over HTTPS (status ${web.status})` : "didn't load over HTTPS") : "not checked yet"],
    ["Registration expires", expiresAt ? expiresAt.slice(0, 10) : "the registry doesn't publish it, so we can't warn about this one"],
  ];
}
function table(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;background:${C.panel};border:1px solid ${C.line};border-radius:12px;"><tr><td style="padding:12px 16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows.map(([k, v]) => `<tr><td valign="top" style="padding:4px 14px 4px 0;font-family:${FONT};font-size:13px;color:${C.muted};white-space:nowrap;">${esc(k)}</td><td style="padding:4px 0;font-family:${FONT};font-size:14px;color:${C.text};word-break:break-word;">${esc(v)}</td></tr>`).join("")}</table></td></tr></table>`;
}

/** Ownership confirmed: the first look and what we'll watch from now on. */
export function startedEmail({ domain, snap, problems, web, expiresAt }, ctx) {
  const rows = statusLines(snap, web, expiresAt);
  const hb = healthBlock(problems);
  const body = [p(`Verified. Founder Watchdog is now watching <strong>${esc(domain)}</strong> every day.`), h2("What we see today"), table(rows), hb.html, h2("What happens next"), small("You'll only hear from us when something changes or breaks: a record removed or loosened, mail servers or DNS host changed, the homepage not loading, or the domain getting close to expiry. Once a month we'll send a short all-clear. Please leave the _neonkey-watchdog record in place.")].join("\n");
  const text = [`Verified. Founder Watchdog is now watching ${domain} every day.`, "", "What we see today:", ...rows.map(([k, v]) => `${k}: ${v}`), "", ...hb.text, "", "You'll only hear from us when something changes or breaks, plus a short monthly all-clear.", footText(ctx)].join("\n");
  return { subject: `Watching ${domain} from now on`, html: shell(`Verified. Here's what ${domain} looks like today.`, body, ctx), text };
}

export function alertEmail({ domain, alerts, ackUrl }, ctx) {
  const critical = alerts.some((a) => a.severity === "critical");
  const head = critical ? `Something broke on ${domain}` : `Something changed on ${domain}`;
  const body = [p(`<strong>${esc(head)}.</strong> We saw this in two checks a few minutes apart, so it isn't a one-off blip.`), ...alerts.map(alertCard), ...(ackUrl ? [small("Made this change on purpose? Tell us and we'll treat the new setup as normal from now on."), button(ackUrl, "I meant to do this")] : []), small("Questions? Reply to this email.")].join("\n");
  const text = [`${head}. We saw this in two checks a few minutes apart.`, "", ...alerts.flatMap(alertText), ...(ackUrl ? [`Made this change on purpose? ${ackUrl}`] : []), footText(ctx)].join("\n");
  return { subject: `${critical ? "Action needed" : "Heads up"}: ${alerts[0].title}`, html: shell(alerts[0].title, body, ctx), text };
}

export function recoveredEmail({ domain, what }, ctx) {
  const body = [p(`<span style="color:${C.green};font-weight:700;">Back to normal:</span> ${esc(what)} on <strong>${esc(domain)}</strong>.`), small("No action needed. We'll keep watching.")].join("\n");
  return { subject: `Back to normal on ${domain}`, html: shell(`${what} is back to normal.`, body, ctx), text: [`Back to normal: ${what} on ${domain}.`, "No action needed.", footText(ctx)].join("\n") };
}

export function monthlyEmail({ domain, snap, problems, web, expiresAt, alertsSent }, ctx) {
  const hb = healthBlock(problems);
  const body = [p(`Your monthly check-in for <strong>${esc(domain)}</strong>. We checked it every day this month${alertsSent ? ` and sent ${alertsSent} alert${alertsSent === 1 ? "" : "s"}` : " and nothing changed that needed you"}.`), table(statusLines(snap, web, expiresAt)), hb.html].join("\n");
  const text = [`Monthly check-in for ${domain}.`, "", ...statusLines(snap, web, expiresAt).map(([k, v]) => `${k}: ${v}`), "", ...hb.text, footText(ctx)].join("\n");
  return { subject: problems.length ? `Monthly check-in: ${domain} has ${problems.length} thing${problems.length === 1 ? "" : "s"} to fix` : `Monthly check-in: ${domain} looks healthy`, html: shell(`Monthly check-in for ${domain}.`, body, ctx), text };
}

export function needsDomainEmail({ given }, ctx) {
  const why = given ? `"${esc(given)}" isn't a domain we can watch (personal mailbox domains like gmail.com belong to someone else).` : "We didn't get a domain with your order.";
  const body = [p(`Thanks for subscribing to Founder Watchdog. ${why}`), p("Reply with your business's own domain (for example yourstartup.com) and we'll send the one-step setup.")].join("\n");
  return { subject: "Which domain should we watch?", html: shell("Reply with your domain to get started.", body, ctx), text: [`Thanks for subscribing to Founder Watchdog. ${given ? `"${given}" isn't a domain we can watch.` : "We didn't get a domain with your order."}`, "Reply with your business's own domain and we'll send the one-step setup.", footText(ctx)].join("\n") };
}

export function canceledEmail({ domain }, ctx) {
  const body = [p(`Your Founder Watchdog subscription has ended, so we've stopped checking <strong>${esc(domain || "your domain")}</strong>.`), small("We delete the records we kept about it after 30 days. You can remove the _neonkey-watchdog TXT record whenever you like. Thanks for trying it.")].join("\n");
  return { subject: "Founder Watchdog has stopped", html: shell("Your subscription ended and checks have stopped.", body, ctx), text: [`Your Founder Watchdog subscription has ended, so we've stopped checking ${domain || "your domain"}.`, "We delete what we kept after 30 days.", footText(ctx)].join("\n") };
}

/** Internal notice to hello@. Plain text is enough. */
export function adminEmail(subject, lines) {
  const text = lines.join("\n");
  return { subject: `Watchdog: ${subject}`, text, html: `<pre style="font-family:${MONO};font-size:13px;white-space:pre-wrap">${esc(text)}</pre>` };
}
