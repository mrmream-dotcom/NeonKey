// Confirmation reminder email + small landing pages. Same dark NeonKey shell as the welcome email.

const C = {
  outer: "#0b0d17",
  panel: "#151935",
  text: "#e8eaf6",
  muted: "#b3b8d6",
  accent: "#22d3ee",
  rule: "#262b52",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const SUBJECT = "Your Unlock the Week signup isn't confirmed yet";

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function cleanFirstName(name) {
  if (!name || typeof name !== "string") return null;
  const n = name.trim().split(/\s+/)[0];
  if (!n || n.length > 40) return null;
  if (/[<>@\/\\:;{}\[\]"=]|https?/i.test(n)) return null;
  return n;
}

const PARAS = [
  "You recently signed up for Unlock the Week, my weekly NeonKey email, but the subscription hasn't been confirmed yet, so I can't send you anything.",
  "If you'd still like it, use the button below and Kit (the service I use for the newsletter) will send you a fresh confirmation link. The link in the original confirmation email works too.",
];
const AFTER =
  "Changed your mind? You don't need to do anything. This is the only reminder I'll send, and you won't hear from me again unless you confirm.";

export function renderReminder({ firstName, confirmUrl, stopUrl }) {
  const name = cleanFirstName(firstName);
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const p = `margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.text};`;
  const cu = escapeHtml(confirmUrl);
  const su = escapeHtml(stopUrl);

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${escapeHtml(SUBJECT)}</title>
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
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.outer};">One click if you still want it. This is the only reminder.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.outer}" style="background-color:${C.outer};">
<tr>
<td align="center" style="padding:32px 12px;">
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
    <tr>
      <td align="center" style="padding:0 0 24px 0;">
        <a href="https://neonkey.tech/" style="text-decoration:none;"><img src="https://neonkey.tech/email/neonkey-logo.png" width="320" height="80" alt="NeonKey" style="display:block;width:320px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;color:${C.text};font-family:${FONT};font-size:24px;font-weight:bold;"></a>
      </td>
    </tr>
    <tr>
      <td class="px" bgcolor="${C.panel}" style="background-color:${C.panel};border-radius:12px;border:1px solid ${C.rule};padding:40px 40px 32px 40px;">
        <p style="margin:0 0 8px 0;font-family:${FONT};font-size:13px;line-height:1.4;letter-spacing:1.5px;text-transform:uppercase;color:${C.accent};font-weight:600;">Unlock the Week</p>
        <h1 style="margin:0 0 24px 0;font-family:${FONT};font-size:26px;line-height:1.3;color:${C.text};font-weight:700;">Still want in?</h1>
        <p style="${p}">${escapeHtml(greeting)}</p>
        ${PARAS.map((t) => `<p style="${p}">${escapeHtml(t)}</p>`).join("\n        ")}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px 0;">
          <tr>
            <td align="center" bgcolor="${C.accent}" style="border-radius:8px;background-color:${C.accent};">
              <a href="${cu}" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:16px;line-height:1.2;font-weight:700;color:${C.outer};text-decoration:none;border-radius:8px;">Confirm my subscription</a>
            </td>
          </tr>
        </table>
        <p style="${p}">${escapeHtml(AFTER)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="border-top:1px solid ${C.rule};padding:20px 0 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
        <p style="margin:0 0 4px 0;font-family:${FONT};font-size:16px;line-height:1.5;color:${C.text};font-weight:700;">Michael Ream</p>
        <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">NeonKey &middot; <a href="https://neonkey.tech/" style="color:${C.accent};text-decoration:none;">neonkey.tech</a> &middot; <a href="mailto:hello@neonkey.tech" style="color:${C.accent};text-decoration:none;">hello@neonkey.tech</a></p>
      </td>
    </tr>
    <tr>
      <td class="px" align="center" style="padding:24px 40px 0 40px;">
        <p style="margin:0 0 6px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">You're getting this one-time reminder because this address was entered in the Unlock the Week signup at neonkey.tech.</p>
        <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};"><a href="${su}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a></p>
      </td>
    </tr>
  </table>
</td>
</tr>
</table>
</body>
</html>`;

  const text = `${greeting}

${PARAS.join("\n\n")}

Confirm my subscription: ${confirmUrl}

${AFTER}

Michael Ream
NeonKey · neonkey.tech · hello@neonkey.tech

--
You're getting this one-time reminder because this address was entered in the Unlock the Week signup at neonkey.tech.
Unsubscribe: ${stopUrl}
`;
  return { html, text };
}

function shell(title, inner) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(title)} · NeonKey</title>
</head>
<body style="margin:0;padding:0;background:${C.outer};color:${C.text};font-family:${FONT};">
<main style="max-width:560px;margin:0 auto;padding:48px 20px;">
  <a href="https://neonkey.tech/"><img src="https://neonkey.tech/email/neonkey-logo.png" width="280" alt="NeonKey" style="display:block;margin:0 auto 28px auto;width:280px;max-width:100%;height:auto;border:0;"></a>
  <div style="background:${C.panel};border:1px solid ${C.rule};border-radius:12px;padding:32px;">
    <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;">${escapeHtml(title)}</h1>
${inner}
  </div>
</main>
</body>
</html>`;
}

const pStyle = `margin:0 0 20px 0;font-size:16px;line-height:1.6;color:${C.muted};`;
const back = `<a href="https://neonkey.tech/" style="color:${C.accent};text-decoration:none;font-weight:600;">Back to neonkey.tech &rarr;</a>`;
const btn = `display:inline-block;padding:13px 28px;font-family:${FONT};font-size:16px;font-weight:700;color:${C.outer};background:${C.accent};border:0;border-radius:8px;cursor:pointer;`;

export function renderPage(title, message) {
  return shell(title, `    <p style="${pStyle}">${escapeHtml(message)}</p>\n    ${back}`);
}

// The person's own browser submits Kit's form (same action URL the site uses), so Kit
// itself sends a fresh confirmation email.
export function renderConfirmPage({ email, kitFormAction }) {
  return shell(
    "One last step",
    `    <p style="${pStyle}">Press the button and Kit (the service I use for the newsletter) will email a fresh confirmation link to <strong style="color:${C.text};">${escapeHtml(email)}</strong>. Click the link in that email and you're in.</p>
    <form action="${escapeHtml(kitFormAction)}" method="post" style="margin:0 0 20px 0;">
      <input type="hidden" name="email_address" value="${escapeHtml(email)}">
      <button type="submit" style="${btn}">Send my confirmation link</button>
    </form>
    <p style="${pStyle}font-size:14px;">It can take a couple of minutes, and it sometimes lands in spam or promotions.</p>
    ${back}`
  );
}

export function renderStopPage({ actionUrl }) {
  return shell(
    "Unsubscribe",
    `    <p style="${pStyle}">Press the button and I'll remove this address from the Unlock the Week list. You won't get any more emails from NeonKey.</p>
    <form action="${escapeHtml(actionUrl)}" method="post" style="margin:0 0 20px 0;">
      <button type="submit" style="${btn}">Unsubscribe</button>
    </form>
    ${back}`
  );
}
