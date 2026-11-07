// KV layout (namespace bound as DESK):
//   acct:<id>            the whole account: billing state, settings, follow-ups (one JSON document)
//   tok:<sha256(token)>  -> account id. The dashboard link carries the token; only its hash is stored.
//   email:<buyer email>  -> account id (for "email me a new link")
//   sub:<subscription>   -> account id (Stripe subscription events)
//   sess:<checkout id>   -> account id (a re-delivered checkout event does nothing)
//   stop:<id>:<item>     a status change (reply, won, lost, stop, bounce) written on its own key, so a cron run that
//                        loaded the account a moment earlier can't overwrite it and send one more follow-up.
import { randomId, randomToken, sha256, defaultSettings, DAY } from "./engine.js";

const STOP_TTL = 30 * 86400;

export async function getAccount(env, id) {
  if (!/^[a-z0-9]{12}$/.test(id || "")) return null;
  const acct = await env.DESK.get(`acct:${id}`, "json");
  if (!acct) return null;
  await applyStops(env, acct);
  return acct;
}

export async function putAccount(env, acct) {
  acct.updated = Date.now();
  await env.DESK.put(`acct:${acct.id}`, JSON.stringify(acct));
}

export async function applyStops(env, acct) {
  const page = await env.DESK.list({ prefix: `stop:${acct.id}:` });
  for (const k of page.keys) {
    const s = await env.DESK.get(k.name, "json");
    const item = s && (acct.items || []).find((i) => i.id === s.item);
    if (item) applyStatus(item, s.status, s.at, s.note);
  }
}

// Closed is closed: a later reply or bounce never re-opens or overwrites won/lost/stopped.
export function applyStatus(item, status, at, note) {
  const final = ["won", "lost", "stopped"];
  if (status === "replied" && !item.repliedAt) item.repliedAt = at;
  if (final.includes(item.status) && item.closedAt && item.closedAt <= at) return;
  if (status === "replied") {
    if (item.status === "open" || item.status === "done") { item.status = "replied"; item.closedAt = at; }
    return;
  }
  item.status = status;
  item.closedAt = at;
  if (note) item.note = note;
}

export async function setStatus(env, acct, itemId, status, note = "") {
  const item = (acct.items || []).find((i) => i.id === itemId);
  if (!item) return null;
  const at = Date.now();
  await env.DESK.put(`stop:${acct.id}:${itemId}`, JSON.stringify({ item: itemId, status, at, note }), { expirationTtl: STOP_TTL });
  applyStatus(item, status, at, note);
  return item;
}

export async function accountByToken(env, token) {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token || "")) return null;
  const id = await env.DESK.get(`tok:${await sha256(token)}`);
  return id ? getAccount(env, id) : null;
}

// Up to 5 live dashboard links per account; a new one retires the oldest.
export async function issueToken(env, acct) {
  const token = randomToken();
  const h = await sha256(token);
  acct.tokens = [...(acct.tokens || []), h];
  while (acct.tokens.length > 5) await env.DESK.delete(`tok:${acct.tokens.shift()}`);
  await env.DESK.put(`tok:${h}`, acct.id);
  return token;
}

export async function createAccount(env, { email, name, business, customer, subscription, session, livemode }) {
  const acct = {
    id: randomId(9) + randomId(3),
    created: Date.now(),
    livemode: Boolean(livemode),
    email,
    name: name || "",
    customer: customer || "",
    subscription: subscription || "",
    billing: "active",
    paused: false,
    setupDone: false,
    settings: defaultSettings(business),
    items: [],
    tokens: [],
  };
  acct.settings.replyTo = email;
  const token = await issueToken(env, acct);
  await putAccount(env, acct);
  await env.DESK.put(`email:${email}`, acct.id);
  if (subscription) await env.DESK.put(`sub:${subscription}`, acct.id);
  if (session) await env.DESK.put(`sess:${session}`, acct.id, { expirationTtl: 90 * 86400 });
  return { acct, token };
}

// Removes everything we hold for an account (30 days after the subscription ends, or on request).
export async function deleteAccount(env, acct) {
  for (const h of acct.tokens || []) await env.DESK.delete(`tok:${h}`);
  const mapped = await env.DESK.get(`email:${acct.email}`);
  if (mapped === acct.id) await env.DESK.delete(`email:${acct.email}`);
  if (acct.subscription) await env.DESK.delete(`sub:${acct.subscription}`);
  const stops = await env.DESK.list({ prefix: `stop:${acct.id}:` });
  for (const k of stops.keys) await env.DESK.delete(k.name);
  await env.DESK.delete(`acct:${acct.id}`);
}

// Closed follow-ups are dropped 90 days after they close, so we only keep what the dashboard shows.
export function prune(acct, now = Date.now()) {
  const before = acct.items.length;
  acct.items = acct.items.filter((i) => i.status === "open" || !i.closedAt || now - i.closedAt < 90 * DAY);
  return before - acct.items.length;
}
