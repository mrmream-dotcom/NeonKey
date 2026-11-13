// KV layout (namespace bound as FS):
//   fam:<id>              the whole family plan: billing, members, pending invites, shared results (one JSON doc)
//   tok:<sha256(token)>   -> "<fam>:<member>". A member's private link carries the token; only its hash is stored.
//   inv:<sha256(token)>   -> "<fam>:<invite id>" (7-day TTL). The invite link carries the token.
//   email:<email>         -> "<fam>:<member>" (for "email me a new link")
//   sub:<subscription>    -> fam id (Stripe subscription events)
//   sess:<checkout id>    -> fam id (a re-delivered checkout event does nothing)
//   n:<fam>:<member>:<day>, n:<fam>:<day>, n:all:<day>   daily check counters (2-day TTL)
//   ni:<fam>:<day>        invites sent today (max 10); ll:<email>   "email me a link" sent in the last 10 minutes
// Message text is never written to KV. A shared result holds the verdict, the tell ids and an optional short note.
export const MAX_MEMBERS = 5; // adults, including the account owner
export const MEMBER_DAILY = 20;
export const FAMILY_DAILY = 60;
export const SHARE_KEEP = 20;
export const INVITE_TTL = 7 * 86400;
export const DELETE_AFTER = 30 * 86400 * 1000;
export const CONSENT_VERSION = "2026-11-13";

const enc = new TextEncoder();
export async function sha256(s) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function randomId(n = 12) {
  const a = "abcdefghijkmnpqrstuvwxyz23456789"; // exactly 32 characters, so the low 5 bits pick one with no bias
  return [...crypto.getRandomValues(new Uint8Array(n))].map((x) => a[x & 31]).join("");
}
export const isEmail = (s) => /^[^\s@<>"',;]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/.test(String(s || ""));
export const oneLine = (s, n) => String(s || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
export const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

export async function getFamily(env, id) {
  if (!/^[a-z2-9]{12}$/.test(id || "")) return null;
  return env.FS.get(`fam:${id}`, "json");
}
export async function putFamily(env, fam) {
  fam.updated = Date.now();
  await env.FS.put(`fam:${fam.id}`, JSON.stringify(fam));
}

/** A member's private link -> { fam, member } or null. Canceled plans still open (to see the delete date). */
export async function byToken(env, token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token || "")) return null;
  const v = await env.FS.get(`tok:${await sha256(token)}`);
  if (!v) return null;
  const [fid, mid] = v.split(":");
  const fam = await getFamily(env, fid);
  const member = fam && fam.members.find((m) => m.id === mid);
  return member ? { fam, member } : null;
}

export async function issueToken(env, fam, member) {
  const token = randomToken();
  const h = await sha256(token);
  member.tokens = [...(member.tokens || []), h];
  while (member.tokens.length > 3) await env.FS.delete(`tok:${member.tokens.shift()}`);
  await env.FS.put(`tok:${h}`, `${fam.id}:${member.id}`);
  return token;
}

export async function createFamily(env, { email, name, customer, subscription, session, livemode }) {
  const owner = { id: randomId(8), role: "owner", email, name: oneLine(name, 60), joined: Date.now(), consent: null, tokens: [] };
  const fam = {
    id: randomId(12),
    created: Date.now(),
    livemode: Boolean(livemode),
    status: "active",
    customer: customer || "",
    subscription: subscription || "",
    members: [owner],
    invites: [],
    shares: [],
  };
  const token = await issueToken(env, fam, owner);
  await putFamily(env, fam);
  await env.FS.put(`email:${email}`, `${fam.id}:${owner.id}`);
  if (subscription) await env.FS.put(`sub:${subscription}`, fam.id);
  if (session) await env.FS.put(`sess:${session}`, fam.id, { expirationTtl: 90 * 86400 });
  return { fam, owner, token };
}

export async function createInvite(env, fam, { email, name }) {
  const token = randomToken();
  const inv = { id: randomId(8), email, name: oneLine(name, 60), at: Date.now() };
  fam.invites = [...(fam.invites || []).filter((i) => i.email !== email && Date.now() - i.at < INVITE_TTL * 1000), inv];
  inv.hash = await sha256(token);
  await env.FS.put(`inv:${inv.hash}`, `${fam.id}:${inv.id}`, { expirationTtl: INVITE_TTL });
  await putFamily(env, fam);
  return token;
}

export async function byInvite(env, token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token || "")) return null;
  const h = await sha256(token);
  const v = await env.FS.get(`inv:${h}`);
  if (!v) return null;
  const [fid, iid] = v.split(":");
  const fam = await getFamily(env, fid);
  const invite = fam && (fam.invites || []).find((i) => i.id === iid);
  return invite ? { fam, invite, hash: h } : null;
}

export async function acceptInvite(env, fam, invite, hash, { name }) {
  fam.invites = fam.invites.filter((i) => i.id !== invite.id);
  await env.FS.delete(`inv:${hash}`);
  const member = { id: randomId(8), role: "member", email: invite.email, name: oneLine(name || invite.name, 60), joined: Date.now(), consent: { at: Date.now(), version: CONSENT_VERSION, adult: true }, tokens: [] };
  fam.members.push(member);
  const token = await issueToken(env, fam, member);
  await putFamily(env, fam);
  await env.FS.put(`email:${member.email}`, `${fam.id}:${member.id}`);
  return { member, token };
}

export async function removeMember(env, fam, memberId) {
  const m = fam.members.find((x) => x.id === memberId && x.role !== "owner");
  if (!m) return false;
  for (const h of m.tokens || []) await env.FS.delete(`tok:${h}`);
  if ((await env.FS.get(`email:${m.email}`)) === `${fam.id}:${m.id}`) await env.FS.delete(`email:${m.email}`);
  fam.members = fam.members.filter((x) => x.id !== memberId);
  await putFamily(env, fam);
  return true;
}

/** Everything about a family, gone: links, invites, email index, the plan itself. */
export async function deleteFamily(env, fam) {
  for (const m of fam.members) {
    for (const h of m.tokens || []) await env.FS.delete(`tok:${h}`);
    if ((await env.FS.get(`email:${m.email}`)) === `${fam.id}:${m.id}`) await env.FS.delete(`email:${m.email}`);
  }
  for (const i of fam.invites || []) if (i.hash) await env.FS.delete(`inv:${i.hash}`);
  if (fam.subscription) await env.FS.delete(`sub:${fam.subscription}`);
  await env.FS.delete(`fam:${fam.id}`);
}

/**
 * Count one check against the member, family and global limits. Returns { ok, reason, useAi }.
 * KV counters are approximate under heavy concurrency; that's fine for a cost guard of this size.
 */
export async function countCheck(env, fam, member, now = Date.now()) {
  const d = dayKey(now);
  const mk = `n:${fam.id}:${member.id}:${d}`;
  const fk = `n:${fam.id}:${d}`;
  const gk = `n:all:${d}`;
  const [m, f, g] = await Promise.all([mk, fk, gk].map(async (k) => Number((await env.FS.get(k)) || 0)));
  if (m >= MEMBER_DAILY) return { ok: false, reason: "member" };
  if (f >= FAMILY_DAILY) return { ok: false, reason: "family" };
  const cap = Number(env.AI_DAILY_CAP || 0);
  const useAi = env.AI_ENABLED === "true" && Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_CLIENT) && g < cap;
  const opt = { expirationTtl: 2 * 86400 };
  await Promise.all([env.FS.put(mk, String(m + 1), opt), env.FS.put(fk, String(f + 1), opt), useAi ? env.FS.put(gk, String(g + 1), opt) : null]);
  return { ok: true, useAi, left: MEMBER_DAILY - m - 1 };
}

export function addShare(fam, member, { verdict, tells, note }) {
  fam.shares = [{ at: Date.now(), by: member.name || "A family member", verdict, tells: (tells || []).filter((t) => /^[a-z-]{2,24}$/.test(t)).slice(0, 8), note: oneLine(note, 120) }, ...(fam.shares || [])].slice(0, SHARE_KEEP);
}
