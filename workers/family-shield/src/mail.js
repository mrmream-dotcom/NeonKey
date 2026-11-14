// Every email Family Shield sends (Resend). From FROM_ADDRESS, Reply-To REPLY_TO.
// BCC_ADDRESS gets the owner's welcome email only (a sale record). Invites and sign-in links go to family members and
// are private, so they are never BCC'd. No email ever contains a checked message.
const C = { bg: "#0b0d17", line: "#262b52", text: "#e8eaf6", muted: "#b3b8d6", cyan: "#22d3ee", violet: "#a78bfa", magenta: "#f472b6" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
const p = (t) => `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.text};">${t}</p>`;
const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px 0;"><tr><td style="border-radius:10px;background:${C.cyan};"><a href="${esc(href)}" style="display:inline-block;padding:12px 20px;font-family:${FONT};font-size:16px;font-weight:700;color:#0b0d17;text-decoration:none;">${esc(label)}</a></td></tr></table>`;

function shell(preheader, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NeonKey</title></head>
<body style="margin:0;padding:0;background:${C.bg};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
<tr><td style="height:4px;line-height:4px;font-size:0;background:${C.cyan};background-image:linear-gradient(90deg,${C.cyan},${C.violet},${C.magenta});">&nbsp;</td></tr>
<tr><td style="padding:24px 28px 8px 28px;"><img src="https://neonkey.tech/email/neonkey-logo.png" alt="NeonKey" height="34" style="display:block;height:34px;border:0;"></td></tr>
<tr><td style="padding:12px 28px 8px 28px;">${body}</td></tr>
<tr><td style="padding:8px 28px 26px 28px;border-top:1px solid ${C.line};"><p style="margin:16px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted};">NeonKey Family Shield · <a href="mailto:hello@neonkey.tech" style="color:${C.cyan};text-decoration:none;">hello@neonkey.tech</a><br>Your link works like a key. Don't forward this email.</p></td></tr>
</table></td></tr></table></body></html>`;
}

const hi = (name) => (name ? `Hi ${esc(String(name).split(" ")[0])},` : "Hi,");

export function welcomeEmail({ name, link }) {
  return {
    subject: "Your Family Shield is ready",
    html: shell("Your private Family Shield link is inside.", [
      p(hi(name)),
      p("Thanks for joining. Your Family Shield is ready. Open it to agree to the short terms, then check your first message and invite up to 4 more adults in your family."),
      button(link, "Open my Family Shield"),
      p("Bookmark the page. If you lose this email, you can ask for a new link at any time from the sign-in page."),
      p("NeonKey"),
    ].join("")),
    text: `${hi(name)}\n\nThanks for joining. Your Family Shield is ready:\n${link}\n\nBookmark it. You can ask for a new link at any time.\n\nNeonKey`,
  };
}

export function inviteEmail({ name, from, link }) {
  const who = esc(from || "Someone in your family");
  return {
    subject: `${from || "Your family"} added you to Family Shield`,
    html: shell("Check a text or email before you act on it.", [
      p(hi(name)),
      p(`${who} added you to their NeonKey Family Shield. It lets you paste a text, email or message you aren't sure about and get a quick read on whether it looks like a scam, with what to do next.`),
      p("It's included in their plan, so there's nothing to pay. You need to be 18 or older to join."),
      button(link, "See the terms and join"),
      p("The link works for 7 days. If you weren't expecting this, you can ignore it."),
    ].join("")),
    text: `${hi(name)}\n\n${from || "Someone in your family"} added you to their NeonKey Family Shield. Paste a message you aren't sure about and get a quick read on whether it looks like a scam.\n\nIncluded in their plan. 18 or older only. See the terms and join (link works 7 days):\n${link}\n\nNot expecting this? Ignore it.`,
  };
}

export function linkEmail({ name, link }) {
  return {
    subject: "Your Family Shield link",
    html: shell("Here's the link you asked for.", [p(hi(name)), p("Here's a fresh link to your Family Shield."), button(link, "Open my Family Shield"), p("Didn't ask for this? You can ignore it. Your old links still work.")].join("")),
    text: `${hi(name)}\n\nHere's a fresh link to your Family Shield:\n${link}\n\nDidn't ask for this? Ignore it.`,
  };
}

export async function send(env, to, msg, { bcc = false } = {}) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
  const body = { from: env.FROM_ADDRESS, to: [to], reply_to: env.REPLY_TO || "hello@neonkey.tech", subject: msg.subject, html: msg.html, text: msg.text };
  if (bcc && env.BCC_ADDRESS) body.bcc = [env.BCC_ADDRESS];
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`resend ${r.status}`);
  return true;
}

/** Short plain notice to NOTIFY_TO (signups, cancels, errors). Never includes tokens or message text. */
export async function notice(env, subject, lines) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_TO) return false;
  try {
    const text = lines.join("\n");
    await send(env, env.NOTIFY_TO, { subject: `Family Shield: ${subject}`, text, html: `<pre style="font-family:${FONT};white-space:pre-wrap;">${esc(text)}</pre>` });
    return true;
  } catch (e) {
    console.log("family-shield: notice failed", String(e));
    return false;
  }
}
