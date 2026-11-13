// Product waitlists (demand tests before anything is built). POST /waitlist
//   { product, email, for_whom?, consent: true, website, src? }   (website = honeypot)
//
// What it does, and nothing more:
//   1. Saves one record per (product, email) in KV so the gate can be counted and the list can be emailed once when
//      the product opens. Key: wl:<product>:<sha256(email)>. Re-joining just refreshes the record (no duplicates).
//   2. Sends the visitor one confirmation email (transactional, they asked for it) through Resend.
//   3. Sends an internal copy to LEAD_TO.
// No payment, no Kit/newsletter subscription, no marketing sequence. Only products listed in PRODUCTS are accepted, so
// a waitlist can't be opened by editing the request. Planned prices are shown as "planned", never charged.
//
// Removal: the confirmation says "reply 'remove'"; Michael deletes the key (or every wl:* key when a test ends).

export const PRODUCTS = {
  "family-shield": {
    name: "Family Shield",
    planned: "$7/mo or $70/yr (planned price)",
    page: "https://neonkey.tech/learn/is-this-a-scam/",
    who: {
      parents: "My parents or grandparents",
      partner: "My partner or another adult at home",
      "adult-kids": "My adult kids",
      friends: "Friends or other family",
      myself: "Just me",
    },
  },
};

const DAY = 86400;

/** Pure input check. Returns { ok: true, value } or { ok: false, status, message }. Exported for tests. */
export function validateWaitlist(body, normalizeEmail) {
  if (!body || typeof body !== "object") return { ok: false, status: 400, message: "Bad request." };
  const product = typeof body.product === "string" ? body.product : "";
  // Own keys only, so "__proto__" or "toString" can never pass as a product.
  const p = Object.hasOwn(PRODUCTS, product) ? PRODUCTS[product] : null;
  if (!p) return { ok: false, status: 400, message: "That waitlist isn't open." };
  const email = normalizeEmail(body.email);
  if (!email) return { ok: false, status: 400, message: "Please enter a valid email address." };
  if (body.consent !== true) return { ok: false, status: 400, message: "Please tick the box so we know it's OK to email you when it opens." };
  const forWhom = typeof body.for_whom === "string" && Object.hasOwn(p.who, body.for_whom) ? body.for_whom : "";
  return { ok: true, value: { product, email, forWhom } };
}

export function renderWaitlistEmail({ product, mailingAddress }) {
  const p = PRODUCTS[product];
  const subject = `You're on the ${p.name} waitlist`;
  const lines = [
    `Thanks for joining the ${p.name} waitlist.`,
    "",
    `${p.name} isn't built yet. We're checking whether enough people want it before we build it. We'll email you once when it opens, or once if we decide not to build it. Those are the only emails this list sends.`,
    "",
    `Planned price: ${p.planned}. Nothing is charged by joining, and you can say no when it opens.`,
    "",
    "Until then, the free guide is here whenever someone sends you a message that feels off:",
    p.page,
    "",
    "The short version: don't tap. Go direct. Open the company's app, or call a number you find yourself, not one from the message.",
    "",
    "Changed your mind? Reply with \"remove\" and we'll delete your email from the list.",
    "",
    "NeonKey",
    "hello@neonkey.tech",
    ...(mailingAddress ? ["", mailingAddress] : []),
  ];
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const html = lines.map((l) => (l === "" ? "" : `<p style="margin:0 0 12px;font:15px/1.5 Arial,sans-serif;color:#1b2333">${l.startsWith("https://") ? `<a href="${esc(l)}">${esc(l)}</a>` : esc(l)}</p>`)).join("\n");
  return { subject, text: lines.join("\n"), html };
}

/**
 * Handles POST /waitlist after the shared origin/JSON/honeypot checks in index.js.
 * deps: { normalizeEmail, sha256Hex, resendSend, cleanSource } (injected so tests run without network).
 */
export async function handleWaitlist(request, env, body, reply, deps) {
  const v = validateWaitlist(body, deps.normalizeEmail);
  if (!v.ok) return reply(v.status, { ok: false, message: v.message });
  const { product, email, forWhom } = v.value;
  const p = PRODUCTS[product];

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const today = new Date().toISOString().slice(0, 10);
  const salt = env.RL_SALT || "nk";
  const emHash = (await deps.sha256Hex(`${salt}|${email}`)).slice(0, 32);
  const ipKey = `wlrl:ip:${today}:${(await deps.sha256Hex(`${salt}|${ip}`)).slice(0, 32)}`;
  const gKey = `wlrl:global:${today}`;
  const recKey = `wl:${product}:${emHash}`;

  const [ipN, gN, existing] = await Promise.all([env.QUIZ_RL.get(ipKey), env.QUIZ_RL.get(gKey), env.QUIZ_RL.get(recKey)]);
  if (Number(ipN || 0) >= Number(env.WAITLIST_IP_DAILY_LIMIT || 5)) return reply(429, { ok: false, message: "Too many signups from here today. Please try again tomorrow, or email hello@neonkey.tech." });
  if (Number(gN || 0) >= Number(env.WAITLIST_GLOBAL_DAILY_LIMIT || 300)) return reply(429, { ok: false, message: "The waitlist is busy right now. Please try again tomorrow, or email hello@neonkey.tech." });

  const now = new Date().toISOString();
  const prev = existing ? safeJson(existing) : null;
  const record = { product, email, forWhom, joinedAt: prev?.joinedAt || now, updatedAt: now, source: deps.cleanSource(body.src) };
  await Promise.all([
    env.QUIZ_RL.put(recKey, JSON.stringify(record)),
    env.QUIZ_RL.put(ipKey, String(Number(ipN || 0) + 1), { expirationTtl: DAY + 3600 }),
    env.QUIZ_RL.put(gKey, String(Number(gN || 0) + 1), { expirationTtl: DAY + 3600 }),
  ]);

  // Already on the list: no second confirmation or lead copy.
  if (prev) return reply(200, { ok: true, already: true });

  const mail = renderWaitlistEmail({ product, mailingAddress: env.MAILING_ADDRESS });
  const sent = await deps.resendSend(env, {
    from: env.FROM_ADDRESS,
    to: [email],
    ...(env.BCC_ADDRESS ? { bcc: [env.BCC_ADDRESS] } : {}),
    reply_to: env.REPLY_TO,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    tags: [{ name: "kind", value: `waitlist_${product.replace(/[^a-z0-9_]/g, "_")}` }],
  });
  if (!sent.ok) console.log("waitlist: resend confirmation failed", sent.status);

  const leadText = [`New ${p.name} waitlist signup (saved in KV as ${recKey}).`, "", `Email: ${email}`, `For: ${forWhom ? p.who[forWhom] : "not given"}`, `Source: ${record.source || "unknown"}`].join("\n");
  const leadRes = await deps.resendSend(env, {
    from: env.FROM_ADDRESS,
    to: [env.LEAD_TO],
    reply_to: email,
    subject: `${p.name} waitlist: ${email}`,
    text: leadText,
    tags: [{ name: "kind", value: "waitlist_lead" }],
  });
  if (!leadRes.ok) console.log("waitlist: resend lead copy failed", leadRes.status);

  // The signup is saved even if the email failed; tell the visitor honestly.
  return reply(200, { ok: true, emailed: sent.ok });
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}
