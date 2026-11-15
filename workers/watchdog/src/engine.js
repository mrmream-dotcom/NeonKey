// Founder Watchdog check engine. Grown from prototypes/watchdog/src/engine.mjs (Nov 13 2026), now the real product.
// Pure functions plus an injectable resolver and fetcher, so tests run on fixtures with no network.
//
// What a subscriber gets checked, once a day, for one domain:
//   - SPF, DKIM and DMARC: alert when a record disappears, duplicates, loosens or (SPF) passes 10 lookups
//   - MX and NS: alert when mail servers or the DNS host change, or mail stops being received
//   - the domain still resolving at all
//   - the homepage loading over HTTPS (an expired or broken certificate counts as down)
//   - registration expiry from RDAP, weekly, with warnings at 30 and 7 days (where the registry publishes it)
// Every DNS answer is public. Nothing here logs in anywhere or changes anything.
import { dohResolve, joinTxt, providerFromMx, dnsHostFromNs, sendersIn, FREE_MAIL, PROVIDERS, COMMON_DKIM, cleanDomain } from "./audit.js";

export { dohResolve, cleanDomain, FREE_MAIL };
export const SNAPSHOT_VERSION = 1;

/** Personal mailbox domains and anything that isn't a real hostname can't be watched. */
export function watchableDomain(input) {
  const d = cleanDomain(input);
  if (!d || FREE_MAIL.has(d)) return null;
  return d;
}

/**
 * A subrequest budget. Cloudflare's free plan allows 50 outbound fetches per invocation, so every DNS lookup, web
 * check, RDAP call and email goes through one of these and a run stops cleanly before the limit.
 */
export class Budget {
  constructor(max) { this.max = max; this.used = 0; }
  left() { return this.max - this.used; }
  take(n = 1) {
    if (this.used + n > this.max) throw new BudgetError();
    this.used += n;
  }
}
export class BudgetError extends Error { constructor() { super("subrequest budget used up"); this.name = "BudgetError"; } }

/** Resolver that charges each lookup to the budget. */
export function budgeted(resolve, budget) {
  return async (name, type) => { budget.take(1); return resolve(name, type); };
}

/** Fixture resolver for tests: zone = { "name": { MX: [...], TXT: ['"..."'], NS: [...] } }, nx = names that don't exist. */
export function fixtureResolver(zone, nx = new Set()) {
  return async (name, type) => {
    const n = String(name).replace(/\.$/, "").toLowerCase();
    if (nx.has(n)) return { status: 3, answers: [] };
    return { status: 0, answers: [...(zone[n]?.[type] || [])] };
  };
}

// SPF lookup count (receivers stop at 10).
async function spfLookups(record, txt, depth = 0, seen = new Set()) {
  let n = 0;
  for (const term of record.split(/\s+/).slice(1)) {
    const t = term.replace(/^[+~?-]/, "").toLowerCase();
    if (t.startsWith("include:") || t.startsWith("redirect=")) {
      n += 1;
      const dom = t.split(/[:=]/)[1];
      if (dom && !seen.has(dom) && depth < 4) {
        seen.add(dom);
        const sub = (await txt(dom)).find((r) => /^v=spf1\b/i.test(r));
        if (sub) n += await spfLookups(sub, txt, depth + 1, seen);
      }
    } else if (/^(a|mx|ptr)([:/]|$)|^exists:/.test(t)) n += 1;
  }
  return n;
}

const spfAll = (rec) => ((rec || "").match(/\s([+~?-]?)all\b/i) || [null, null])[1] ?? null;
const DMARC_RANK = { reject: 3, quarantine: 2, none: 1 };
const hasKey = (records) => records.some((r) => /\bp=[A-Za-z0-9+/]/.test(r));

/** DKIM selectors worth trying for a domain: its provider's own, then the common ones. TXT lookups follow CNAMEs. */
export function candidateSelectors(mx) {
  const p = providerFromMx(mx);
  const own = p?.key ? PROVIDERS[p.key].dkimSelectors || [] : [];
  return [...new Set([...own, ...COMMON_DKIM])];
}

/**
 * Snapshot of everything Watchdog watches in DNS. With `discover`, it tries every candidate DKIM selector (baseline,
 * about 25 lookups); otherwise only the selectors found before (daily, about 6 to 12 lookups).
 */
export async function snapshot(domain, { resolve, selectors = [], discover = false, now = Date.now() } = {}) {
  const txt = async (name) => (await resolve(name, "TXT")).answers.map(joinTxt);
  const [mxRes, nsRes, rootTxt, dmarcTxt] = await Promise.all([resolve(domain, "MX"), resolve(domain, "NS"), txt(domain), txt(`_dmarc.${domain}`)]);
  if (mxRes.status === 3 && nsRes.status === 3) return { v: SNAPSHOT_VERSION, domain, at: new Date(now).toISOString(), exists: false };
  const mx = mxRes.answers.map((m) => m.replace(/^\d+\s+/, "").replace(/\.$/, "").toLowerCase()).filter(Boolean).sort();
  const ns = nsRes.answers.map((n) => n.replace(/\.$/, "").toLowerCase()).sort();
  const spf = rootTxt.filter((r) => /^v=spf1\b/i.test(r));
  const dmarc = dmarcTxt.filter((r) => /^v=dmarc1\b/i.test(r));
  const policy = dmarc[0] ? ((dmarc[0].match(/\bp=(\w+)/i) || [])[1] || "missing").toLowerCase() : null;
  const tryList = discover ? candidateSelectors(mx) : selectors;
  const dkim = {};
  for (const s of tryList) {
    const ok = hasKey(await txt(`${s}._domainkey.${domain}`));
    if (ok || !discover) dkim[s] = ok;
  }
  return {
    v: SNAPSHOT_VERSION,
    domain,
    at: new Date(now).toISOString(),
    exists: true,
    mx,
    provider: providerFromMx(mx)?.label || null,
    ns,
    dnsHost: dnsHostFromNs(ns).label,
    spf: { count: spf.length, record: spf[0] || null, all: spfAll(spf[0]), lookups: spf.length === 1 ? await spfLookups(spf[0], txt) : null, senders: sendersIn(spf[0]) },
    dmarc: { count: dmarc.length, policy, record: dmarc[0] || null, rua: /\brua=/i.test(dmarc[0] || "") },
    dkim,
  };
}

const alert = (severity, id, title, detail, fix) => ({ severity, id, title, detail, ...(fix ? { fix } : {}) });

/** Compare two DNS snapshots. Returns alerts, most serious first. Nothing when nothing Watchdog cares about changed. */
export function diff(prev, next) {
  const out = [];
  const d = next.domain;
  if (prev.exists && !next.exists) return [alert("critical", "domain-gone", `${d} no longer resolves`, "DNS says this domain doesn't exist. It may have expired or been deleted at the registrar.", "Sign in to your domain registrar and check the domain is still registered and renewed.")];
  if (!prev.exists || !next.exists) return out;

  if (prev.ns.join() !== next.ns.join()) out.push(alert("warning", "ns-changed", "Your DNS host changed", `Name servers went from ${prev.ns.join(", ") || "none"} to ${next.ns.join(", ") || "none"}${next.dnsHost ? ` (${next.dnsHost})` : ""}.`, "If you didn't move your DNS, sign in to your registrar now, change its password and turn on two-step login."));

  if (prev.mx.length && !next.mx.length) out.push(alert("critical", "mx-gone", "Your domain stopped receiving email", "There are no mail server (MX) records anymore, so email sent to you will bounce.", "Add back the MX records your email provider gives you."));
  else if (prev.mx.join() !== next.mx.join()) out.push(alert("warning", "mx-changed", next.provider !== prev.provider ? `Your email provider changed to ${next.provider || "an unknown host"}` : "Your mail servers changed", `Mail servers went from ${prev.mx.join(", ") || "none"} to ${next.mx.join(", ")}.`, "If you moved email on purpose, make sure SPF and DKIM were updated for the new provider."));

  const ps = prev.spf, ns = next.spf;
  if (ps.count === 1 && ns.count === 0) out.push(alert("critical", "spf-gone", "Your SPF record was removed", "Nothing says which services may send email as you, so your mail is more likely to be filtered and easier to fake.", `Restore the record. Your last working one was: ${ps.record}`));
  else if (ns.count > 1) { if (ps.count <= 1) out.push(alert("critical", "spf-duplicate", "You now have two SPF records", "Mail servers treat two SPF records as an error, which can fail every message.", "Merge them into one record that starts with v=spf1.")); }
  else if (ns.count === 1) {
    const loose = (a) => a === "+" || a === "?" || a === "" || a === null;
    if (ps.count === 1 && !loose(ps.all) && loose(ns.all)) out.push(alert("critical", "spf-loosened", "Your SPF record stopped blocking other senders", `It now ends in "${ns.all === null ? "nothing" : `${ns.all}all`}", which lets anyone claim to be you.`, "End it with ~all or -all again."));
    if (ns.lookups > 10 && !(ps.lookups > 10)) out.push(alert("critical", "spf-lookups", `SPF now needs ${ns.lookups} lookups (the limit is 10)`, "Past 10, SPF fails even for mail you really sent.", "Remove include: entries for tools you no longer use, or move a sending tool to its own subdomain."));
    const added = ns.senders.filter((s) => !ps.senders.includes(s));
    const removed = ps.senders.filter((s) => !ns.senders.includes(s));
    if (ps.count === 1 && (added.length || removed.length)) out.push(alert("info", "spf-senders", "The list of services allowed to send as you changed", [added.length && `Added: ${added.join(", ")}.`, removed.length && `Removed: ${removed.join(", ")}.`].filter(Boolean).join(" "), removed.length ? "If you still send from a removed service, its mail will now fail SPF." : undefined));
  }

  const pd = prev.dmarc, nd = next.dmarc;
  if (pd.count === 1 && nd.count === 0) out.push(alert("critical", "dmarc-gone", "Your DMARC record was removed", "Inboxes no longer get told what to do with mail faking your address.", `Add back a TXT record at _dmarc.${d}${pd.record ? `. Your last one was: ${pd.record}` : ", starting with v=DMARC1"}.`));
  else if (nd.count > 1 && pd.count <= 1) out.push(alert("critical", "dmarc-duplicate", "You now have two DMARC records", "Receivers ignore DMARC entirely when there are two.", "Delete one so a single record remains."));
  else if (pd.count === 1 && nd.count === 1 && pd.policy !== nd.policy) {
    const weaker = (DMARC_RANK[nd.policy] || 0) < (DMARC_RANK[pd.policy] || 0);
    out.push(alert(weaker ? "warning" : "info", "dmarc-policy", weaker ? `DMARC was weakened to p=${nd.policy}` : `DMARC is now p=${nd.policy}`, weaker ? "Mail faking your address is now blocked less than before." : "Mail faking your address is now handled more strictly. Watch for your own tools failing.", weaker ? "If you didn't change it on purpose, set the policy back." : undefined));
  }
  if (pd.rua && !nd.rua && nd.count === 1) out.push(alert("info", "dmarc-reports", "DMARC reports were turned off", "You'll no longer get reports on who sends as your domain.", "Add a rua=mailto: address back to the DMARC record."));

  const lost = Object.keys(prev.dkim).filter((s) => prev.dkim[s] && next.dkim[s] === false);
  const still = Object.keys(next.dkim).filter((s) => next.dkim[s]);
  if (lost.length) out.push(alert(still.length ? "warning" : "critical", "dkim-gone", still.length ? `A DKIM key disappeared (${lost.join(", ")})` : "Your DKIM signing key disappeared", still.length ? "Mail from the tool that used it will fail DKIM." : "Your mail can no longer prove it came from you.", "Turn DKIM back on in your email provider's admin settings and re-add the record it gives you."));

  return sortAlerts(out);
}

const RANK = { critical: 0, warning: 1, info: 2 };
export const sortAlerts = (a) => a.sort((x, y) => RANK[x.severity] - RANK[y.severity]);

/** Alerts present in both diffs (matched by id). DNS answers can blip, so a change must show up twice to count. */
export function confirmed(prev, first, second) {
  const again = new Set(diff(prev, second).map((a) => a.id));
  return diff(prev, first).filter((a) => again.has(a.id));
}

/**
 * Stateful daily step. Keeps `good`, the last snapshot with no open warning or critical problem, so a record that is
 * deleted and later put back weaker is still reported once. state = { last, good, open: [alert ids already sent] }.
 */
export function step(state, next) {
  const vsLast = diff(state.last, next);
  const vsGood = diff(state.good, next).filter((a) => a.severity !== "info");
  const open = new Set(state.open || []);
  const seen = new Set(vsLast.map((a) => a.id));
  const alerts = sortAlerts([...vsLast.filter((a) => !open.has(a.id)), ...vsGood.filter((a) => !open.has(a.id) && !seen.has(a.id))]);
  const stillOpen = vsGood.map((a) => a.id);
  const healthyAgain = stillOpen.length === 0;
  return {
    alerts,
    resolved: healthyAgain && open.size > 0,
    state: { last: next, good: healthyAgain ? next : state.good, open: healthyAgain ? [] : [...new Set([...stillOpen, ...alerts.filter((a) => a.severity !== "info").map((a) => a.id)])] },
  };
}
/** Owner says the change was on purpose: the latest snapshot becomes the reference. */
export const acknowledge = (state) => ({ ...state, good: state.last, open: [] });

/** Problems in a snapshot on its own (for the first report and the monthly summary). Not alerts, just a health list. */
export function health(s) {
  if (!s.exists) return [{ severity: "critical", text: "The domain doesn't resolve in DNS." }];
  const out = [];
  if (!s.mx.length) out.push({ severity: "info", text: "No mail servers (MX), so this domain doesn't receive email." });
  if (s.spf.count === 0) out.push({ severity: "warning", text: "No SPF record." });
  else if (s.spf.count > 1) out.push({ severity: "critical", text: "Two SPF records (counts as none)." });
  else {
    if (s.spf.all === null || s.spf.all === "+" || s.spf.all === "?" || s.spf.all === "") out.push({ severity: "warning", text: "SPF doesn't end in ~all or -all." });
    if (s.spf.lookups > 10) out.push({ severity: "critical", text: `SPF needs ${s.spf.lookups} lookups (limit 10).` });
  }
  if (s.dmarc.count === 0) out.push({ severity: "warning", text: "No DMARC record." });
  else if (s.dmarc.count > 1) out.push({ severity: "critical", text: "Two DMARC records (receivers ignore both)." });
  if (s.mx.length && !Object.values(s.dkim).some(Boolean)) out.push({ severity: "warning", text: "No DKIM key found at the usual names." });
  return out;
}

// ---- web and expiry checks ----

// rdap.org refuses requests without a User-Agent (checked Nov 13 2026), so every outside fetch names itself.
const UA = "NeonKey-Watchdog/1.0 (+https://neonkey.tech/founders/watchdog/)";

/**
 * Homepage check: fetch https://<domain>/ (following redirects, 10 s timeout). Up = any response below 500.
 * A TLS failure (including an expired certificate) throws inside fetch and counts as down.
 */
export async function webCheck(domain, { fetcher = fetch, budget } = {}) {
  budget?.take(1);
  try {
    const r = await fetcher(`https://${domain}/`, { redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "User-Agent": UA } });
    try { await r.body?.cancel(); } catch { /* ignore */ }
    return { up: r.status < 500, status: r.status };
  } catch (e) {
    return { up: false, status: 0, error: String(e?.name || "fetch failed") };
  }
}

/** Registration expiry from RDAP (rdap.org redirects to the right registry). null when the registry doesn't publish it. */
export async function expiryCheck(domain, { fetcher = fetch, budget } = {}) {
  budget?.take(2); // rdap.org answers with a redirect, which is a second subrequest
  try {
    const r = await fetcher(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { redirect: "follow", signal: AbortSignal.timeout(10000), headers: { accept: "application/rdap+json", "User-Agent": UA } });
    if (!r.ok) return null;
    const j = await r.json();
    const ev = (j.events || []).find((e) => e.eventAction === "expiration");
    const t = ev ? Date.parse(ev.eventDate) : NaN;
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  } catch {
    return null;
  }
}

export const DAY = 86400000;
/** Which expiry warning (if any) is due: 30 or 7 days out, each sent once. */
export function expiryAlert(domain, expiresAt, warned = [], now = Date.now()) {
  if (!expiresAt) return null;
  const days = Math.floor((Date.parse(expiresAt) - now) / DAY);
  const level = days <= 7 ? 7 : days <= 30 ? 30 : null;
  if (!level || warned.includes(level)) return null;
  return {
    level,
    alert: alert(level === 7 ? "critical" : "warning", `expiry-${level}`, days < 0 ? `${domain} registration has expired` : `${domain} expires in ${days} day${days === 1 ? "" : "s"}`, `The registry lists the expiry date as ${expiresAt.slice(0, 10)}. When a domain lapses, your website and email stop working, and someone else can register it.`, "Sign in to your registrar and renew it, and turn on auto-renew with a card that won't expire first. If you already renewed, you can ignore this; the registry can take a day to update."),
  };
}

// ---- domain-control proof ----
const enc = new TextEncoder();
export async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** The TXT record a subscriber adds to prove they control the domain: _neonkey-watchdog.<domain>. */
export async function ownershipRecord(accountId, domain, secret) {
  const token = (await hmacHex(secret, `own|${accountId}|${domain}`)).slice(0, 32);
  return { host: `_neonkey-watchdog.${domain}`, name: "_neonkey-watchdog", type: "TXT", value: `neonkey-watchdog=${token}` };
}
export async function verifyOwnership(accountId, domain, secret, resolve) {
  const want = await ownershipRecord(accountId, domain, secret);
  const got = (await resolve(want.host, "TXT")).answers.map(joinTxt);
  return got.includes(want.value);
}
/** Token for the "I meant to do this" link in alerts. */
export async function ackToken(accountId, secret) {
  return (await hmacHex(secret, `ack|${accountId}`)).slice(0, 32);
}
