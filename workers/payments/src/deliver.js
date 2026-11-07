// Founder Stack auto-delivery: when a Founder Stack checkout is paid, email the buyer the PDF as an attachment.
// The PDF lives only in the private Workers KV namespace bound as PRODUCTS (key FOUNDER_STACK_KEY). It is never
// in this repo, on the site, or at any public URL, and this Worker has no route that serves it.
// Upload a new edition by hand (Cloudflare dashboard > Workers KV > neonkey-products, or `wrangler kv key put`).

export const FOUNDER_STACK_OFFER = "nk_founder_stack_guide";
export const FOUNDER_STACK_KEY = "founder-stack/the-founder-stack-neonkey.pdf";
const FILENAME = "The-Founder-Stack-NeonKey.pdf";

// True for a paid checkout from the Founder Stack Payment Link (matched by its metadata or its link id).
export function isFounderStackPaid(event, env) {
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return false;
  const o = event.data?.object || {};
  if (o.mode !== "payment" || o.payment_status !== "paid") return false; // delayed methods wait for async_payment_succeeded
  return o.metadata?.offer === FOUNDER_STACK_OFFER || (!!env.FOUNDER_STACK_LINK && o.payment_link === env.FOUNDER_STACK_LINK);
}

// Returns true when the email was accepted (or there was nothing we could send), false to make Stripe retry.
export async function deliverFounderStack(env, event) {
  const o = event.data.object;
  const email = (o.customer_details?.email || o.customer_email || "").trim();
  const name = (o.customer_details?.name || "").trim();
  const domain = cleanDomain(o.custom_fields?.find((f) => f.key === "domain")?.text?.value);
  const test = event.livemode ? "" : "[TEST] ";

  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) {
    // No usable buyer address: tell NeonKey so the guide goes out by hand. Retrying wouldn't help.
    return send(env, `founder-stack-noemail-${o.id}`, {
      to: [env.NOTIFY_TO],
      subject: `${test}ACTION NEEDED: Founder Stack paid, no buyer email`,
      text: `A Founder Stack checkout (${o.id}) was paid but had no usable email. Find the buyer in Stripe and send the guide by hand.`,
    });
  }

  const pdf = env.PRODUCTS ? await env.PRODUCTS.get(FOUNDER_STACK_KEY, "arrayBuffer") : null;
  if (!pdf) {
    console.log("payments: founder stack PDF missing from KV");
    return false; // Stripe retries for up to 3 days; fix the KV upload and it delivers on the next try
  }

  const first = name.split(/\s+/)[0] || "";
  const lockdown = domain
    ? `We have your domain, ${domain}, for your included Email Lockdown. Your report with the exact records to add arrives by email within one business day.`
    : "Your guide includes an Email Lockdown for your domain. Reply to this email with the domain you use for business email, and your report with the exact records to add arrives within one business day.";

  return send(env, `founder-stack-${o.id}`, {
    to: [email],
    reply_to: env.NOTIFY_TO,
    subject: `${test}Your copy of The Founder Stack`,
    html: html(first, lockdown),
    text: [
      first ? `Hi ${first},` : "Hi,",
      "",
      "Thanks for buying The Founder Stack. Your copy is attached to this email as a PDF.",
      "",
      lockdown,
      "",
      "Your copy is for your own business. Please don't share, resell or republish it (neonkey.tech/terms/#digital-guides).",
      "",
      "If the file won't open or something in it isn't clear, just reply. A person reads every reply.",
      "",
      "NeonKey",
      "neonkey.tech",
    ].join("\n"),
    attachments: [{ filename: FILENAME, content: toBase64(pdf) }],
    tags: [{ name: "kind", value: "founder_stack_delivery" }],
  });
}

async function send(env, idempotencyKey, msg) {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ from: env.FROM_ADDRESS, ...(env.BCC_ADDRESS ? { bcc: [env.BCC_ADDRESS] } : {}), ...msg }),
    });
    if (!r.ok) console.log("payments: founder stack email failed", r.status);
    return r.ok;
  } catch {
    console.log("payments: founder stack email error");
    return false;
  }
}

function cleanDomain(v) {
  const d = String(v || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#\s]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) && d.length <= 253 ? d : "";
}

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function html(first, lockdown) {
  const p = (t, extra = "") => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#e8eaf6;${extra}">${t}</p>`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0b0d17">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d17"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#151935;border:1px solid #262b52;border-radius:12px;font-family:system-ui,Segoe UI,Arial,sans-serif">
<tr><td style="height:4px;background:linear-gradient(90deg,#22d3ee,#a78bfa,#f472b6);border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px"><img src="https://neonkey.tech/email/neonkey-logo.png" alt="NeonKey" width="140" style="display:block;border:0"></td></tr>
<tr><td style="padding:8px 28px 4px"><p style="margin:0 0 6px;font-size:12px;letter-spacing:.14em;color:#22d3ee;font-weight:700">THE FOUNDER STACK</p>
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;color:#e8eaf6">Your guide is attached.</h1></td></tr>
<tr><td style="padding:0 28px 8px">
${p(first ? `Hi ${esc(first)},` : "Hi,")}
${p("Thanks for buying The Founder Stack. Your copy is attached to this email as a PDF.")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px"><tr><td style="background:#0b0d17;border:1px solid #262b52;border-left:3px solid #a78bfa;border-radius:8px;padding:14px 16px;font-size:15px;line-height:1.6;color:#e8eaf6"><strong style="color:#a78bfa">Your included Email Lockdown.</strong> ${esc(lockdown)}</td></tr></table>
${p("If the file won't open or something in it isn't clear, just reply. A person reads every reply.")}
${p(`Your copy is for your own business. Please don't share, resell or republish it (<a href="https://neonkey.tech/terms/#digital-guides" style="color:#22d3ee">terms</a>).`, "font-size:14px;color:#b3b8d6")}
${p("NeonKey", "margin-top:8px")}
</td></tr>
<tr><td style="padding:14px 28px 24px;border-top:1px solid #262b52;font-size:12px;letter-spacing:.12em;color:#b3b8d6">UNLOCK TECH, WHATEVER YOUR LEVEL · <a href="https://neonkey.tech" style="color:#b3b8d6">neonkey.tech</a></td></tr>
</table></td></tr></table></body></html>`;
}
