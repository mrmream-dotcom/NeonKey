// NeonKey payments Worker: receives Stripe webhooks and emails NeonKey about money events.
//   POST /webhook   Stripe events (signature checked with STRIPE_WEBHOOK_SECRET before anything else)
//   GET  /health    { ok: true, live }
// Stripe itself emails customers their invoices and receipts (Dashboard > Settings > Customer emails),
// so this Worker only notifies NeonKey (hello@, BCC Michael). It stores nothing.
// Secrets (wrangler secret put, never committed): STRIPE_WEBHOOK_SECRET, RESEND_API_KEY. No Stripe API key is needed here.
import Stripe from "stripe";
import { describeEvent } from "./events.js";

const crypto = Stripe.createSubtleCryptoProvider();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const json = (status, body) =>
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

    if (url.pathname === "/health" && request.method === "GET") {
      return json(200, { ok: true, live: env.ALLOW_LIVE === "true" });
    }
    if (url.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain" } });
    if (url.pathname !== "/webhook") return json(404, { ok: false });
    if (request.method !== "POST") return json(405, { ok: false });

    const sig = request.headers.get("Stripe-Signature");
    if (!sig || !env.STRIPE_WEBHOOK_SECRET) return json(400, { ok: false });
    const raw = await request.text();
    if (raw.length > 512 * 1024) return json(413, { ok: false });

    let event;
    try {
      event = await Stripe.webhooks.constructEventAsync(raw, sig, env.STRIPE_WEBHOOK_SECRET, undefined, crypto);
    } catch {
      console.log("payments: bad webhook signature");
      return json(400, { ok: false });
    }

    // Live events are refused until Michael flips ALLOW_LIVE (after the LLC, license and his explicit OK).
    if (event.livemode && env.ALLOW_LIVE !== "true") {
      console.log("payments: live event ignored (ALLOW_LIVE is off)", event.type);
      return json(200, { ok: true, ignored: "live" });
    }

    const notice = describeEvent(event);
    if (!notice) return json(200, { ok: true, ignored: event.type });

    const sent = await notify(env, event, notice);
    // A non-2xx makes Stripe retry later, so a failed email isn't lost.
    if (!sent) return json(500, { ok: false });
    return json(200, { ok: true });
  },
};

async function notify(env, event, n) {
  const mode = event.livemode ? "" : "[TEST] ";
  const dash = `https://dashboard.stripe.com/${event.livemode ? "" : "test/"}${n.dashPath || "events/" + event.id}`;
  const rows = n.rows.filter(([, v]) => v !== undefined && v !== null && v !== "");
  const text = [`${n.headline}`, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", n.next ? `Next: ${n.next}` : "", `Stripe: ${dash}`, `Event: ${event.id} (${event.type})`]
    .filter((l) => l !== null).join("\n");
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p style="font-size:17px;margin:0 0 12px"><strong>${esc(n.headline)}</strong></p>
<table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#555">${esc(k)}</td><td style="padding:2px 0">${esc(v)}</td></tr>`).join("")}</table>
${n.next ? `<p style="margin:14px 0 0"><strong>Next:</strong> ${esc(n.next)}</p>` : ""}
<p style="margin:14px 0 0"><a href="${esc(dash)}">Open in Stripe</a></p>
<p style="margin:14px 0 0;color:#777;font-size:12px">${esc(event.id)} · ${esc(event.type)}</p></div>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        // Stripe can deliver the same event twice; Resend drops a repeat key within 24 h.
        "Idempotency-Key": `stripe-${event.id}`,
      },
      body: JSON.stringify({
        from: env.FROM_ADDRESS,
        to: [env.NOTIFY_TO],
        ...(env.BCC_ADDRESS ? { bcc: [env.BCC_ADDRESS] } : {}),
        ...(n.replyTo ? { reply_to: n.replyTo } : {}),
        subject: `${mode}${n.subject}`,
        html,
        text,
        tags: [{ name: "kind", value: "stripe_notice" }, { name: "event", value: event.type.replace(/[^A-Za-z0-9_-]/g, "_") }],
      }),
    });
    if (!r.ok) console.log("payments: resend failed", r.status);
    return r.ok;
  } catch {
    console.log("payments: resend error");
    return false;
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
