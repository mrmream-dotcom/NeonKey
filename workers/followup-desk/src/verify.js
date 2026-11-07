// Stripe webhook signature check with WebCrypto (no SDK needed in the Worker).
// Header: "t=<unix>,v1=<hex hmac>[,v1=...]". Signed payload: `${t}.${rawBody}`, HMAC-SHA256 with the whsec_ secret.
// Rejects anything older or newer than TOLERANCE seconds (replay protection). Compares in constant time.
const TOLERANCE = 300;
const enc = new TextEncoder();

export async function verifyStripeEvent(raw, header, secret, now = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) throw new Error("missing signature or secret");
  let t = null;
  const sigs = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") t = Number(v);
    else if (k === "v1" && /^[0-9a-f]{64}$/i.test(v)) sigs.push(v.toLowerCase());
  }
  if (!Number.isInteger(t) || sigs.length === 0) throw new Error("bad signature header");
  if (Math.abs(now - t) > TOLERANCE) throw new Error("timestamp outside tolerance");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${raw}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (!sigs.some((s) => safeEqual(s, expected))) throw new Error("signature mismatch");
  return JSON.parse(raw);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Resend webhook signature check (Svix scheme). Headers svix-id, svix-timestamp, svix-signature ("v1,<base64> ...").
// Signed content `${id}.${timestamp}.${body}`, HMAC-SHA256 keyed with the base64 part of the whsec_ secret.
export async function verifyResendEvent(raw, headers, secret, now = Math.floor(Date.now() / 1000)) {
  const id = headers.get("svix-id");
  const ts = Number(headers.get("svix-timestamp"));
  const sigHeader = headers.get("svix-signature") || "";
  if (!id || !Number.isInteger(ts) || !sigHeader || !secret) throw new Error("missing signature");
  if (Math.abs(now - ts) > TOLERANCE) throw new Error("timestamp outside tolerance");
  const keyBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${id}.${ts}.${raw}`)));
  const expected = btoa(String.fromCharCode(...mac));
  const sigs = sigHeader.split(" ").map((s) => s.split(",")).filter((p) => p[0] === "v1").map((p) => p[1] || "");
  if (!sigs.some((s) => safeEqual(s, expected))) throw new Error("signature mismatch");
  return JSON.parse(raw);
}
