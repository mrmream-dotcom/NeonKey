// Lead Tracker sync: every paid Lockdown order lands in the "Lead Tracker" tab of the NeonKey Accounts sheet,
// so the funnel record (Outcome, Paid date, Paid $, Payment ref, Delivery hours, Support hours) fills itself.
//   paid    -> match the buyer's row (same Stripe ref, else same email with no payment yet), or add an
//              "Inbound / Hot" row; set W=won, X=paid date (AKST), Y=$, Z=Stripe payment id.
//              Automatic delivery also sets AA=0 and AB=0 (no manual hours). Orders a person has to finish leave
//              AA/AB blank for Michael.
//   refund  -> the row with that Stripe ref gets W=refunded (full refunds only).
// Auth: a Google service account (secret GOOGLE_SA_KEY = the JSON key file). The sheet is shared with that
// account's email as Editor and nothing else, so the key can't reach any other file.
// Without GOOGLE_SA_KEY or LEAD_SHEET_ID this is a no-op that reports "off".

const COLS = { id: 0, campaign: 1, lead: 2, email: 3, ref: 25 }; // A, B, C, D, Z (0-based)
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://sheets.googleapis.com/v4/spreadsheets";

export const sheetEnabled = (env) => Boolean(env.GOOGLE_SA_KEY && env.LEAD_SHEET_ID);

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlStr = (s) => b64url(new TextEncoder().encode(s));

function pemToDer(pem) {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

export async function accessToken(env, fetchImpl = fetch, now = Date.now()) {
  const sa = JSON.parse(env.GOOGLE_SA_KEY);
  const iat = Math.floor(now / 1000);
  const head = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64urlStr(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claim}`));
  const r = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${b64url(sig)}` }).toString(),
  });
  if (!r.ok) throw new Error(`google token ${r.status}`);
  return (await r.json()).access_token;
}

// YYYY-MM-DD in Alaska time (Michael's reporting time zone).
export function akDate(ms) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Anchorage", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

const tab = (env) => env.LEAD_SHEET_TAB || "Lead Tracker";
const rng = (env, a1) => encodeURIComponent(`'${tab(env)}'!${a1}`);

async function api(env, token, path, init = {}, fetchImpl = fetch) {
  const r = await fetchImpl(`${API}/${env.LEAD_SHEET_ID}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`sheets ${r.status}`);
  return r.json();
}

async function readRows(env, token, fetchImpl) {
  const d = await api(env, token, `/values/${rng(env, "A2:Z")}`, {}, fetchImpl);
  return d.values || [];
}

// Which row (1-based sheet row number) belongs to this payment. Same Stripe ref wins (retries never duplicate);
// otherwise the buyer's existing row if it has no payment on it yet (a lead who later bought).
export function findRow(rows, ref, email) {
  const e = (email || "").trim().toLowerCase();
  let byEmail = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (ref && (r[COLS.ref] || "") === ref) return { row: i + 2, match: "ref" };
    if (byEmail < 0 && e && (r[COLS.email] || "").trim().toLowerCase() === e && !(r[COLS.ref] || "")) byEmail = i;
  }
  return byEmail >= 0 ? { row: byEmail + 2, match: "email" } : null;
}

export function nextInboundId(rows) {
  let max = 0;
  for (const r of rows) {
    const m = /^IN(\d+)$/.exec(r[COLS.id] || "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `IN${max + 1}`;
}

// Stripe test-mode orders and the owner's own test buys (paid with the BCC address) stay out of the funnel.
export const isTestBuy = (env, order) => !order.livemode || Boolean(env.BCC_ADDRESS && order.email === env.BCC_ADDRESS.trim().toLowerCase());

export const paymentRef = (order) => order.paymentIntent || order.id;

// Returns "written" | "already" | "off" | "skipped". Throws on Google errors so the caller can retry later.
export async function recordPaid(env, order, fetchImpl = fetch) {
  if (!sheetEnabled(env)) return "off";
  if (isTestBuy(env, order)) return "skipped";
  const token = await accessToken(env, fetchImpl);
  const rows = await readRows(env, token, fetchImpl);
  const ref = paymentRef(order);
  const auto = order.status !== "human";
  const paid = [[order.refunded ? "refunded" : "won", akDate(order.paidAt || order.created), order.amount ?? "", ref]];
  const hours = auto ? [[0, 0]] : null;
  const hit = findRow(rows, ref, order.email);

  if (hit?.match === "ref") return "already";
  if (hit) {
    const data = [{ range: `'${tab(env)}'!W${hit.row}:Z${hit.row}`, values: paid }];
    if (hours) data.push({ range: `'${tab(env)}'!AA${hit.row}:AB${hit.row}`, values: hours });
    await api(env, token, `/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }) }, fetchImpl);
    return "written";
  }
  const lead = [order.name, order.business].filter(Boolean).join(" / ") || order.email;
  const row = [
    nextInboundId(rows), "Inbound / Hot", lead, order.email, "Stripe checkout (Email Lockdown)", "remote", "hot", "", "lockdown49 (Stripe)",
    "paid", "", "", "", auto ? "delivered automatically" : "finish by hand (see the ACTION NEEDED email)", "yes (paid)",
    "", "", "", "", "", "", "", ...paid[0], ...(hours ? hours[0] : ["", ""]),
  ];
  await api(env, token, `/values/${rng(env, "A:AB")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values: [row] }) }, fetchImpl);
  return "written";
}

export async function recordRefund(env, order, fetchImpl = fetch) {
  if (!sheetEnabled(env)) return "off";
  if (isTestBuy(env, order)) return "skipped";
  const token = await accessToken(env, fetchImpl);
  const rows = await readRows(env, token, fetchImpl);
  const hit = findRow(rows, paymentRef(order), null);
  if (!hit) return "missing";
  await api(env, token, `/values/${rng(env, `W${hit.row}`)}?valueInputOption=USER_ENTERED`, { method: "PUT", body: JSON.stringify({ values: [["refunded"]] }) }, fetchImpl);
  return "written";
}
