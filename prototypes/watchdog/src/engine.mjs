// Founder Watchdog prototype engine (Nov 13 2026). NOT deployed, NOT a Worker, sends nothing.
// Runs on synthetic fixtures, or live only against NeonKey's own domains (see run.mjs). Design: docs/founder-watchdog-mvp.md.
//
// What it proves:
//   1. The Lockdown audit engine (workers/lockdown/src/audit.js) is reusable as Watchdog's BASELINE: it finds the
//      provider, DNS host and DKIM selectors once, with an injectable resolver.
//   2. Daily checks can be much lighter than the audit (known selectors only), which keeps each domain well inside a
//      Worker's subrequest budget.
//   3. A snapshot -> diff -> confirm -> alert loop that turns DNS changes into plain-words alerts, without flapping.
//   4. Domain-control proof with a TXT record, so nobody can watch a domain that isn't theirs.
//
// Import note: this reads the Lockdown engine in place to prove reuse. A real Watchdog Worker would vendor its own copy
// (repo rule: Workers share nothing), pinned to the commit it was copied from.
import { audit, joinTxt, providerFromMx, dnsHostFromNs, sendersIn, FREE_MAIL, cleanDomain } from "../../../workers/lockdown/src/audit.js";

export { cleanDomain };
export const SNAPSHOT_VERSION = 1;

/** Wraps a resolver so every lookup is counted (the Worker subrequest budget). */
export function counted(resolve) {
  const r = async (name, type) => { r.calls += 1; return resolve(name, type); };
  r.calls = 0;
  return r;
}

/** Fixture resolver: zone = { "name": { MX: [...], TXT: ['"..."'], NS: [...], CNAME: [...] } }, nx = names that don't exist. */
export function fixtureResolver(zone, nx = new Set()) {
  return async (name, type) => {
    const n = String(name).replace(/\.$/, "").toLowerCase();
    if (nx.has(n)) return { status: 3, answers: [] };
    return { status: 0, answers: [...(zone[n]?.[type] || [])] };
  };
}

// SPF lookup count (receivers stop at 10). Same rule as the Lockdown engine, which keeps its own copy private.
async function spfLookups(record, txt, depth = 0, seen = new Set()) {
  let n = 0;
  for (const term of record.split(/\s+/).slice(1)) {
    const t = term.replace(/^[+~?-]/, "").toLowerCase();
    if (t.startsWith("include:") || t.startsWith("redirect=")) {
      n += 1;
      const dom = t.split(/[:=]/)[1];
      if (dom && !seen.has(dom) && depth < 5) {
        seen.add(dom);
        const sub = (await txt(dom)).find((r) => /^v=spf1\b/i.test(r));
        if (sub) n += await spfLookups(sub, txt, depth + 1, seen);
      }
    } else if (/^(a|mx|ptr)([:/]|$)|^exists:/.test(t)) n += 1;
  }
  return n;
}

const spfAll = (rec) => ((rec || "").match(/\s([+~?-]?)all\b/i) || [null, null])[1] ?? null; // "-", "~", "?", "+" or "" (bare all = +)
const DMARC_RANK = { reject: 3, quarantine: 2, none: 1 };

/**
 * Baseline: the full Lockdown audit, run once when a domain is added (and again if the provider changes).
 * Returns what the daily snapshot needs to know: which DKIM selectors to keep checking, plus the first snapshot.
 */
export async function baseline(domain, { resolve, now = Date.now() } = {}) {
  if (FREE_MAIL.has(domain)) throw new Error(`${domain} is a personal mailbox domain; Watchdog can't watch it`);
  const a = await audit(domain, { resolve, now });
  const selectors = [...a.dkim];
  const snap = await snapshot(domain, { resolve, selectors, now });
  return { domain, selectors, provider: a.provider, dnsHost: a.dnsHost, locked: a.locked, snapshot: snap };
}

/**
 * Daily snapshot: only the records Watchdog watches, and only the DKIM selectors found at baseline.
 * About 6 + selectors + SPF includes lookups, versus 40+ for the full audit.
 */
export async function snapshot(domain, { resolve, selectors = [], now = Date.now() } = {}) {
  const txt = async (name) => (await resolve(name, "TXT")).answers.map(joinTxt);
  const [mxRes, nsRes, rootTxt, dmarcTxt] = await Promise.all([resolve(domain, "MX"), resolve(domain, "NS"), txt(domain), txt(`_dmarc.${domain}`)]);
  if (mxRes.status === 3) return { v: SNAPSHOT_VERSION, domain, at: new Date(now).toISOString(), exists: false };
  const mx = mxRes.answers.map((m) => m.replace(/^\d+\s+/, "").replace(/\.$/, "").toLowerCase()).filter(Boolean).sort();
  const ns = nsRes.answers.map((n) => n.replace(/\.$/, "").toLowerCase()).sort();
  const spf = rootTxt.filter((r) => /^v=spf1\b/i.test(r));
  const dmarc = dmarcTxt.filter((r) => /^v=dmarc1\b/i.test(r));
  const policy = dmarc[0] ? ((dmarc[0].match(/\bp=(\w+)/i) || [])[1] || "missing").toLowerCase() : null;
  const dkim = {};
  await Promise.all(selectors.map(async (s) => {
    const name = `${s}._domainkey.${domain}`;
    const [t, c] = await Promise.all([txt(name), resolve(name, "CNAME")]);
    dkim[s] = t.some((r) => /\bp=[A-Za-z0-9+/]/.test(r)) || c.answers.length > 0;
  }));
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
    dmarc: { count: dmarc.length, policy, rua: /\brua=/i.test(dmarc[0] || "") },
    dkim,
  };
}

const alert = (severity, id, title, detail, fix) => ({ severity, id, title, detail, ...(fix ? { fix } : {}) });

/** Compare two snapshots. Returns alerts, most serious first. No alerts when nothing Watchdog cares about changed. */
export function diff(prev, next) {
  const out = [];
  const d = next.domain;
  if (prev.exists && !next.exists) return [alert("critical", "domain-gone", `${d} no longer resolves`, "DNS says this domain doesn't exist. It may have expired or been deleted at the registrar.", "Sign in to your domain registrar and check the domain is still registered and renewed.")];
  if (!prev.exists || !next.exists) return out;

  // DNS host change is the classic hijack signal, so it is worth an email even when everything else still passes.
  if (prev.ns.join() !== next.ns.join()) out.push(alert("warning", "ns-changed", "Your DNS host changed", `Name servers went from ${prev.ns.join(", ") || "none"} to ${next.ns.join(", ") || "none"}${next.dnsHost ? ` (${next.dnsHost})` : ""}.`, "If you didn't move your DNS, sign in to your registrar now, change its password and turn on two-step login."));

  if (prev.mx.length && !next.mx.length) out.push(alert("critical", "mx-gone", "Your domain stopped receiving email", "There are no mail server (MX) records anymore, so replies to your mail will bounce.", "Add back the MX records your email provider gives you."));
  else if (prev.mx.join() !== next.mx.join()) out.push(alert("warning", "mx-changed", next.provider !== prev.provider ? `Your email provider changed to ${next.provider || "an unknown host"}` : "Your mail servers changed", `Mail servers went from ${prev.mx.join(", ")} to ${next.mx.join(", ")}.`, "If you moved email on purpose, make sure SPF and DKIM were updated for the new provider."));

  const ps = prev.spf, ns = next.spf;
  if (ps.count === 1 && ns.count === 0) out.push(alert("critical", "spf-gone", "Your SPF record was removed", "Nothing says which services may send email as you, so your mail is more likely to be filtered and easier to fake.", "Restore the record. Your last working one was: " + ps.record));
  else if (ns.count > 1) { if (ps.count <= 1) out.push(alert("critical", "spf-duplicate", "You now have two SPF records", "Mail servers treat two SPF records as an error, which can fail every message.", "Merge them into one record that starts with v=spf1.")); }
  else if (ns.count === 1) {
    const loose = (a) => a === "+" || a === "?" || a === "" || a === null;
    if (!loose(ps.all) && loose(ns.all)) out.push(alert("critical", "spf-loosened", "Your SPF record stopped blocking other senders", `It now ends in "${ns.all === null ? "nothing" : `${ns.all}all`}", which lets anyone claim to be you.`, "End it with ~all or -all again."));
    if (ns.lookups > 10 && !(ps.lookups > 10)) out.push(alert("critical", "spf-lookups", `SPF now needs ${ns.lookups} lookups (limit 10)`, "Past 10, SPF fails even for mail you really sent.", "Remove include: entries for tools you no longer use, or move a sending tool to its own subdomain."));
    const added = ns.senders.filter((s) => !ps.senders.includes(s));
    const removed = ps.senders.filter((s) => !ns.senders.includes(s));
    if (added.length || removed.length) out.push(alert("info", "spf-senders", "The list of services allowed to send as you changed", [added.length && `Added: ${added.join(", ")}.`, removed.length && `Removed: ${removed.join(", ")}.`].filter(Boolean).join(" "), removed.length ? "If you still send from a removed service, its mail will now fail SPF." : undefined));
  }

  const pd = prev.dmarc, nd = next.dmarc;
  if (pd.count === 1 && nd.count === 0) out.push(alert("critical", "dmarc-gone", "Your DMARC record was removed", "Inboxes no longer get told what to do with mail faking your address.", `Add back a TXT record at _dmarc.${d}, starting with v=DMARC1.`));
  else if (nd.count > 1 && pd.count <= 1) out.push(alert("critical", "dmarc-duplicate", "You now have two DMARC records", "Receivers ignore DMARC entirely when there are two.", "Delete one so a single record remains."));
  else if (pd.count === 1 && nd.count === 1 && pd.policy !== nd.policy) {
    const weaker = (DMARC_RANK[nd.policy] || 0) < (DMARC_RANK[pd.policy] || 0);
    out.push(alert(weaker ? "warning" : "info", "dmarc-policy", weaker ? `DMARC was weakened to p=${nd.policy}` : `DMARC is now p=${nd.policy}`, weaker ? "Mail faking your address is now blocked less than before." : "Mail faking your address is now handled more strictly. Watch for your own tools failing.", weaker ? "If you didn't change it on purpose, set the policy back." : undefined));
  }
  if (pd.rua && !nd.rua && nd.count === 1) out.push(alert("info", "dmarc-reports", "DMARC reports were turned off", "You'll no longer see who is sending as your domain.", "Add a rua=mailto: address back to the DMARC record."));

  const lost = Object.keys(prev.dkim).filter((s) => prev.dkim[s] && next.dkim[s] === false);
  const still = Object.keys(next.dkim).filter((s) => next.dkim[s]);
  if (lost.length) out.push(alert(still.length ? "warning" : "critical", "dkim-gone", still.length ? `A DKIM key disappeared (${lost.join(", ")})` : "Your DKIM signing key disappeared", still.length ? "Mail from the tool that used it will fail DKIM." : "Your mail can no longer prove it came from you.", "Turn DKIM back on in your email provider's admin settings and re-add the record it gives you."));

  const rank = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/**
 * Anti-flap: DNS answers can blip (a resolver hiccup, a half-saved edit). Only alert on changes seen in two snapshots
 * taken a few minutes apart. Returns the alerts present in both diffs (matched by id).
 */
export function confirmed(prev, first, second) {
  const again = new Set(diff(prev, second).map((a) => a.id));
  return diff(prev, first).filter((a) => again.has(a.id));
}

// ---- domain-control proof ----
const enc = new TextEncoder();
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** The TXT record a customer adds to prove control: _neonkey-watchdog.<domain> = "neonkey-watchdog=<token>". */
export async function ownershipRecord(accountId, domain, secret) {
  const token = (await hmacHex(secret, `${accountId}|${domain}`)).slice(0, 32);
  return { host: `_neonkey-watchdog.${domain}`, type: "TXT", value: `neonkey-watchdog=${token}` };
}
export async function verifyOwnership(accountId, domain, secret, resolve) {
  const want = await ownershipRecord(accountId, domain, secret);
  const got = (await resolve(want.host, "TXT")).answers.map(joinTxt);
  return got.includes(want.value);
}

/** Plain-text alert email body. Nothing sends it in the prototype. */
export function renderAlert(domain, alerts) {
  if (!alerts.length) return null;
  const head = alerts.some((a) => a.severity === "critical") ? `Something broke on ${domain}` : `Something changed on ${domain}`;
  return [head, "", ...alerts.flatMap((a) => [`[${a.severity.toUpperCase()}] ${a.title}`, a.detail, ...(a.fix ? [`What to do: ${a.fix}`] : []), ""]), "Founder Watchdog prototype. This is a preview of an alert; nothing was sent."].join("\n");
}

/**
 * Stateful daily step. Diffing only against yesterday misses a record that is deleted and later put back weaker
 * (DMARC gone on day 2, back as p=none on day 3 looks like "nothing to report"). So the state also keeps `good`, the
 * last snapshot with no open warning or critical problem, and reports new regressions against it once.
 *   state = { last, good, open: [alert ids already reported against good] }
 * When nothing is wrong against `good` any more, `next` becomes the new `good`. In the product, "I meant to do this"
 * on an alert would also accept `next` as `good` (acknowledge()).
 */
export function step(state, next) {
  const vsLast = diff(state.last, next);
  const vsGood = diff(state.good, next).filter((a) => a.severity !== "info");
  const open = new Set(state.open || []);
  const seen = new Set(vsLast.map((a) => a.id));
  const alerts = [...vsLast, ...vsGood.filter((a) => !open.has(a.id) && !seen.has(a.id))];
  const stillOpen = vsGood.map((a) => a.id);
  const healthyAgain = stillOpen.length === 0;
  return {
    alerts,
    state: { last: next, good: healthyAgain ? next : state.good, open: healthyAgain ? [] : [...new Set([...stillOpen, ...alerts.filter((a) => a.severity !== "info").map((a) => a.id)])] },
  };
}
/** Owner says the change was on purpose: today's snapshot becomes the reference. */
export const acknowledge = (state) => ({ last: state.last, good: state.last, open: [] });
