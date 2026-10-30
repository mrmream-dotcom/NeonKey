// Welcome email template (HTML + plain text). Table-based, inline CSS, email-safe.

const C = {
  outer: "#0b0d17",
  panel: "#151935",
  text: "#e8eaf6",
  muted: "#b3b8d6",
  accent: "#22d3ee",
  rule: "#262b52",
  pink: "#f472b6",
};

export const SUBJECT = "Welcome to Unlock the Week";

// Reply call-to-action: replies help engagement and inbox placement on a new domain.
const REPLY_ASK = "Hit reply and tell me the one tech thing you're stuck on right now.";
const REPLY_MAILTO = "mailto:hello@neonkey.tech?subject=Hi%20NeonKey";
const REPLY_NOTE = "AI tools, home Wi-Fi, a messy inbox, an automation you can't get working: a sentence or two is plenty. I read every reply, and it shapes what goes into Unlock the Week.";

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Keep a first name only if it looks like a plausible name.
export function cleanFirstName(name) {
  if (!name || typeof name !== "string") return null;
  const n = name.trim().split(/\s+/)[0];
  if (!n || n.length > 40) return null;
  if (/[<>@\/\\:;{}\[\]"=]|https?/i.test(n)) return null;
  return n;
}

export function renderWelcome({ firstName, unsubscribeUrl, mailingAddress }) {
  const name = cleanFirstName(firstName);
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const p = `margin:0 0 16px 0;font-family:${font};font-size:16px;line-height:1.6;color:${C.text};`;
  const li = `margin:0 0 8px 0;font-family:${font};font-size:16px;line-height:1.6;color:${C.text};`;
  const u = escapeHtml(unsubscribeUrl);

  const bullets = [
    "One email a week, about a three-minute read.",
    "One AI story worth knowing, with a plain-English takeaway.",
    "One skill tip you can try in a few minutes.",
    "Gear picks from NeonKey's reviews.",
    "A Learn spotlight, plus a tool or demo to try.",
  ];

  const bulletRows = bullets
    .map(
      (b) => `<tr>
<td width="20" valign="top" style="padding:0 0 8px 0;font-family:${font};font-size:16px;line-height:1.6;color:${C.accent};">&#8226;</td>
<td valign="top" style="padding:0 0 8px 0;${li}">${escapeHtml(b)}</td>
</tr>`
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${SUBJECT}</title>
<style>
  :root { color-scheme: dark light; supported-color-schemes: dark light; }
  body { margin:0; padding:0; }
  a { color:${C.accent}; }
  @media only screen and (max-width:620px) {
    .container { width:100% !important; }
    .px { padding-left:24px !important; padding-right:24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.outer};" bgcolor="${C.outer}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.outer};">You're on the list. Here's what to expect from Unlock the Week.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.outer}" style="background-color:${C.outer};">
<tr>
<td align="center" style="padding:32px 12px;">
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
    <tr>
      <td align="center" style="padding:0 0 24px 0;">
        <img src="https://neonkey.tech/email/neonkey-logo.png" width="320" height="80" alt="NeonKey" style="display:block;width:320px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;color:${C.text};font-family:${font};font-size:24px;font-weight:bold;">
      </td>
    </tr>
    <tr>
      <td class="px" bgcolor="${C.panel}" style="background-color:${C.panel};border-radius:12px;border:1px solid ${C.rule};padding:40px 40px 32px 40px;">
        <p style="margin:0 0 8px 0;font-family:${font};font-size:13px;line-height:1.4;letter-spacing:1.5px;text-transform:uppercase;color:${C.accent};font-weight:600;">Unlock the Week</p>
        <h1 style="margin:0 0 24px 0;font-family:${font};font-size:26px;line-height:1.3;color:${C.text};font-weight:700;">Welcome aboard</h1>
        <p style="${p}">${escapeHtml(greeting)}</p>
        <p style="${p}">Thanks for confirming. You're officially on the list for <strong style="color:${C.text};">Unlock the Week</strong>, the weekly NeonKey email that helps you get more out of tech, whatever your level.</p>
        <p style="margin:24px 0 12px 0;font-family:${font};font-size:18px;line-height:1.4;color:${C.text};font-weight:700;">What to expect</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
${bulletRows}
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px 0;">
          <tr>
            <td bgcolor="#0e1129" style="background-color:#0e1129;border:1px solid ${C.rule};border-left:4px solid ${C.accent};border-radius:10px;padding:18px 20px;">
              <p style="margin:0 0 6px 0;font-family:${font};font-size:17px;line-height:1.5;color:${C.text};font-weight:700;">${escapeHtml(REPLY_ASK)}</p>
              <p style="margin:0;font-family:${font};font-size:15px;line-height:1.6;color:${C.muted};">${escapeHtml(REPLY_NOTE)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0 0;"><tr>
                <td align="center" bgcolor="${C.accent}" style="border-radius:8px;background-color:${C.accent};background-image:linear-gradient(90deg,${C.accent},${C.pink});">
                  <a href="${REPLY_MAILTO}" style="display:inline-block;padding:12px 24px;font-family:${font};font-size:15px;line-height:1.2;font-weight:700;color:#0b0d17;text-decoration:none;border-radius:8px;">Reply to NeonKey</a>
                </td>
              </tr></table>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="border-top:1px solid ${C.rule};padding:20px 0 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
        <p style="margin:0 0 4px 0;font-family:${font};font-size:16px;line-height:1.5;color:${C.text};font-weight:700;">NeonKey</p>
        <p style="margin:0;font-family:${font};font-size:14px;line-height:1.5;color:${C.muted};"><a href="https://neonkey.tech/" style="color:${C.accent};text-decoration:none;">neonkey.tech</a> &middot; <a href="mailto:hello@neonkey.tech" style="color:${C.accent};text-decoration:none;">hello@neonkey.tech</a></p>
      </td>
    </tr>
    <tr>
      <td class="px" align="center" style="padding:24px 40px 0 40px;">
        <p style="margin:0 0 6px 0;font-family:${font};font-size:12px;line-height:1.6;color:${C.muted};">You're receiving this because you subscribed to Unlock the Week at neonkey.tech.</p>
        <p style="margin:0;font-family:${font};font-size:12px;line-height:1.6;color:${C.muted};"><a href="${u}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a></p>${mailingAddress ? `
        <p style="margin:10px 0 0 0;font-family:${font};font-size:11px;line-height:1.5;color:#6b7096;">NeonKey &middot; ${escapeHtml(mailingAddress)}</p>` : ""}
      </td>
    </tr>
  </table>
</td>
</tr>
</table>
</body>
</html>`;

  const text = `${greeting}

Thanks for confirming. You're officially on the list for Unlock the Week, the weekly NeonKey email that helps you get more out of tech, whatever your level.

WHAT TO EXPECT
${bullets.map((b) => `- ${b}`).join("\n")}

${REPLY_ASK}
${REPLY_NOTE}
Reply to NeonKey: hello@neonkey.tech

NeonKey
neonkey.tech · hello@neonkey.tech

--
You're receiving this because you subscribed to Unlock the Week at neonkey.tech.
Unsubscribe: ${unsubscribeUrl}
${mailingAddress ? `NeonKey · ${mailingAddress}\n` : ""}`;

  return { html, text };
}

export function renderPage(title, message) {
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · NeonKey</title>
</head>
<body style="margin:0;padding:0;background:${C.outer};color:${C.text};font-family:${font};">
<main style="max-width:560px;margin:0 auto;padding:48px 20px;">
  <a href="https://neonkey.tech/"><img src="https://neonkey.tech/email/neonkey-logo.png" width="280" alt="NeonKey" style="display:block;margin:0 auto 28px auto;width:280px;max-width:100%;height:auto;border:0;"></a>
  <div style="background:${C.panel};border:1px solid ${C.rule};border-radius:12px;padding:32px;">
    <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:${C.muted};">${escapeHtml(message)}</p>
    <a href="https://neonkey.tech/" style="color:${C.accent};text-decoration:none;font-weight:600;">Back to neonkey.tech &rarr;</a>
  </div>
</main>
</body>
</html>`;
}
