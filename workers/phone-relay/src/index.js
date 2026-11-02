// NeonKey phone-agent message relay.
//
// The ElevenLabs phone assistant calls this webhook when a caller leaves a message.
// It emails the message to hello@neonkey.tech (BCC Michael) through Resend.
//
// Route:
//   POST /message   header X-Relay-Token: <RELAY_TOKEN>   JSON body (see FIELDS)
//   anything else   404
//
// Secrets (Cloudflare dashboard or `wrangler secret put`, never committed):
//   RESEND_API_KEY, RELAY_TOKEN
// Privacy: caller details are never logged.

const RESEND_API = "https://api.resend.com/emails";
const FIELDS = {
  name: 120,
  callback_number: 40,
  email: 200,
  need: 1500,
  best_time: 200,
  urgent: 10,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/message" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }
    const token = request.headers.get("X-Relay-Token") || "";
    if (!env.RELAY_TOKEN || !(await safeEqual(token, env.RELAY_TOKEN))) {
      return new Response("Not found", { status: 404 });
    }
    if (!env.RESEND_API_KEY) {
      return json({ ok: false, error: "email_not_configured" }, 503);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    const m = {};
    for (const [k, max] of Object.entries(FIELDS)) {
      m[k] = clean(body && body[k], max);
    }
    if (!m.name && !m.callback_number && !m.email) {
      return json({ ok: false, error: "no_contact_details" }, 400);
    }
    const urgent = /^(true|yes|1)$/i.test(m.urgent);

    const subject = `${urgent ? "URGENT: " : ""}📞 Phone message from ${m.name || "a caller"}`;
    const rows = [
      ["Name", m.name],
      ["Callback number", m.callback_number],
      ["Email", m.email],
      ["What they need", m.need],
      ["Best time to reach them", m.best_time],
      ["Urgent", urgent ? "YES" : "no"],
    ];
    const text =
      rows.map(([k, v]) => `${k}: ${v || "(not given)"}`).join("\n") +
      "\n\nTaken by the NeonKey AI phone assistant. Full transcript: ElevenLabs > Agents > Conversations.";
    const html =
      `<p><strong>${urgent ? "URGENT " : ""}New phone message</strong> taken by the NeonKey AI phone assistant.</p>` +
      `<table cellpadding="6" style="border-collapse:collapse">` +
      rows
        .map(
          ([k, v]) =>
            `<tr><td style="color:#555;vertical-align:top">${esc(k)}</td><td>${esc(v || "(not given)").replace(/\n/g, "<br>")}</td></tr>`
        )
        .join("") +
      `</table><p style="color:#777;font-size:12px">Full transcript: ElevenLabs &gt; Agents &gt; Conversations.</p>`;

    const payload = {
      from: env.FROM_ADDRESS,
      to: [env.TO_ADDRESS],
      bcc: env.BCC_ADDRESS ? [env.BCC_ADDRESS] : undefined,
      subject,
      text,
      html,
      tags: [{ name: "type", value: "phone_message" }],
    };
    if (isEmail(m.email)) payload.reply_to = m.email;

    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.id) {
      console.log("resend send failed", res.status);
      return json({ ok: false, error: "send_failed" }, 502);
    }
    return json({ ok: true, message: "Message delivered to the NeonKey team." });
  },
};

function clean(v, max) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}
function isEmail(s) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
