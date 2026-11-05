// Email Lockdown audit engine: public DNS only (Cloudflare DNS-over-HTTPS), no logins, changes nothing.
// audit(domain, opts) -> { domain, provider, dnsHost, spf, dmarc, dkim, fixes, buyerSteps, human, locked }
//   fixes      exact records the buyer pastes in (type, host, value), written for their email provider
//   buyerSteps things only the buyer can click (DKIM keys come from the provider's admin console)
//   human      reasons Michael has to look (anything we can't write a safe record for). Empty = fully automatic.
// The DNS lookup is injectable (opts.resolve) so tests run with fixtures and no network.

const DOH = "https://cloudflare-dns.com/dns-query";
const TYPES = { A: 1, NS: 2, CNAME: 5, MX: 15, TXT: 16 };

export async function dohResolve(name, type) {
  const u = `${DOH}?name=${encodeURIComponent(name)}&type=${type}`;
  const r = await fetch(u, { headers: { accept: "application/dns-json" } });
  if (!r.ok) throw new Error(`DNS lookup failed (${r.status})`);
  const d = await r.json();
  return { status: d.Status, answers: (d.Answer || []).filter((a) => a.type === TYPES[type]).map((a) => a.data) };
}

// TXT answers come back quoted and sometimes split into 255-byte chunks: "v=spf1 ..." "more"
export function joinTxt(data) {
  const parts = [...String(data).matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\(.)/g, "$1"));
  return parts.length ? parts.join("") : String(data).replace(/^"|"$/g, "");
}

// Accepts what people type at checkout: "https://www.Shop.com/", "me@shop.com", "shop.com." -> "shop.com"
export function cleanDomain(input) {
  if (!input || typeof input !== "string") return null;
  let d = input.trim().toLowerCase();
  if (d.includes("@")) d = d.split("@").pop();
  d = d.replace(/^[a-z]+:\/\//, "").split(/[/?#\s]/)[0].replace(/\.$/, "").replace(/^www\./, "");
  if (d.length > 253 || !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) return null;
  return d;
}

// Personal mailbox domains: the buyer can't (and shouldn't) change these records.
export const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "ymail.com", "aol.com", "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com", "gmx.com", "zoho.com"]);

// Providers we write SPF and DKIM steps for. Anything else is flagged for Michael.
export const PROVIDERS = {
  google: {
    label: "Google Workspace",
    spf: "include:_spf.google.com",
    dkimSelectors: ["google"],
    dkimHelp: "https://support.google.com/a/answer/174124",
    dkimSteps: "Sign in to admin.google.com as an admin. Go to Apps > Google Workspace > Gmail > Authenticate email. Pick your domain, click Generate new record (keep the 2048-bit default), then add the TXT record it shows (name google._domainkey) at your domain host the same way as the records above. Wait an hour, come back to that page and click Start authentication.",
  },
  microsoft: {
    label: "Microsoft 365",
    spf: "include:spf.protection.outlook.com",
    dkimSelectors: ["selector1", "selector2"],
    dkimHelp: "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dkim-configure",
    dkimSteps: "Sign in to security.microsoft.com as an admin. Go to Email & collaboration > Policies & rules > Threat policies > Email authentication settings > DKIM. Click your domain. It shows two CNAME records (selector1._domainkey and selector2._domainkey). Add both at your domain host, wait an hour, then come back and switch Sign messages for this domain with DKIM signatures to Enabled.",
  },
};

const OTHER_PROVIDERS = [
  ["zoho", "Zoho Mail"], ["protonmail", "Proton Mail"], ["secureserver", "GoDaddy email"], ["mxroute", "MXroute"],
  ["messagingengine", "Fastmail"], ["mx.cloudflare.net", "Cloudflare Email Routing"], ["porkbun", "Porkbun email forwarding"],
  ["titan.email", "Titan Email"], ["yahoodns", "Yahoo"], ["icloud", "iCloud Mail"], ["improvmx", "ImprovMX forwarding"],
];

export function providerFromMx(mx) {
  const s = mx.join(" ").toLowerCase();
  if (/google(mail)?\.com|aspmx/.test(s)) return { key: "google", label: PROVIDERS.google.label };
  if (/outlook\.com|protection\.outlook/.test(s)) return { key: "microsoft", label: PROVIDERS.microsoft.label };
  for (const [k, label] of OTHER_PROVIDERS) if (s.includes(k)) return { key: null, label };
  return mx.length ? { key: null, label: "an email host we didn't recognize" } : null;
}

// Where the buyer edits DNS, read from the domain's NS records. Help links checked Nov 5 2026.
const DNS_HOSTS = [
  ["domaincontrol.com", "GoDaddy", "https://www.godaddy.com/help/add-a-txt-record-19232"],
  ["cloudflare.com", "Cloudflare", "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/"],
  ["registrar-servers.com", "Namecheap", "https://www.namecheap.com/support/knowledgebase/article.aspx/317/2237/how-do-i-add-txtspfdkimdmarc-records-for-my-domain/"],
  ["squarespacedns.com", "Squarespace", "https://support.squarespace.com/hc/en-us/articles/360002101888"],
  ["googledomains.com", "Squarespace (formerly Google Domains)", "https://support.squarespace.com/hc/en-us/articles/360002101888"],
  ["wixdns.net", "Wix", "https://support.wix.com/en/article/adding-or-updating-txt-records-in-your-wix-account"],
  ["porkbun.com", "Porkbun", "https://kb.porkbun.com/article/68-how-to-edit-dns-records"],
  ["awsdns", "Amazon Route 53", "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html"],
];

export function dnsHostFromNs(ns) {
  const s = ns.join(" ").toLowerCase();
  for (const [k, label, help] of DNS_HOSTS) if (s.includes(k)) return { label, help };
  return { label: null, help: null };
}

// Rough count of DNS lookups an SPF record needs (receivers stop at 10).
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

// Insert an include before the "all" term (or at the end), keeping everything else the buyer already has.
export function addInclude(record, include) {
  const terms = record.trim().split(/\s+/);
  const i = terms.findIndex((t) => /^[+~?-]?all$/i.test(t));
  if (i === -1) return [...terms, include, "~all"].join(" ");
  terms.splice(i, 0, include);
  return terms.join(" ");
}

export async function audit(domain, opts = {}) {
  const resolve = opts.resolve || dohResolve;
  const contactEmail = (opts.contactEmail || "").toLowerCase();
  const txt = async (name) => (await resolve(name, "TXT")).answers.map(joinTxt);
  const out = { domain, checkedAt: new Date(opts.now || Date.now()).toISOString(), provider: null, dnsHost: { label: null, help: null }, mx: [], spf: null, dmarc: null, dkim: [], fixes: [], buyerSteps: [], human: [], notes: [], locked: false };

  if (FREE_MAIL.has(domain)) {
    out.human.push(`${domain} is a personal mailbox domain, not the buyer's own. Email Lockdown can't change it. Reply to the buyer to ask for their business domain, or refund.`);
    return out;
  }

  const [mxRes, nsRes] = await Promise.all([resolve(domain, "MX"), resolve(domain, "NS")]);
  if (mxRes.status === 3) {
    out.human.push(`${domain} doesn't exist in DNS (possible typo at checkout). Ask the buyer for the right domain.`);
    return out;
  }
  out.mx = mxRes.answers.map((m) => m.replace(/^\d+\s+/, "").replace(/\.$/, "")).filter(Boolean).sort(); // "0 ." is a null MX: no mail
  out.dnsHost = dnsHostFromNs(nsRes.answers);
  out.provider = providerFromMx(out.mx);
  if (!out.mx.length) {
    out.human.push(`${domain} has no mail server (no MX records), so it doesn't receive email. It may be the wrong domain, or email lives somewhere else. Ask the buyer.`);
    return out;
  }
  const P = out.provider && out.provider.key ? PROVIDERS[out.provider.key] : null;
  if (!P) out.human.push(`Email is hosted by ${out.provider.label} (MX: ${out.mx.join(", ")}). We only write records automatically for Google Workspace and Microsoft 365, so the SPF include and DKIM steps need a person.`);

  // SPF
  const spf = (await txt(domain)).filter((r) => /^v=spf1\b/i.test(r));
  out.spf = { records: spf, lookups: null };
  if (spf.length > 1) {
    out.human.push(`${domain} has ${spf.length} SPF records, which counts as no SPF at all. Merging them needs a look at which services still send: ${spf.join("  |  ")}`);
  } else if (spf.length === 0) {
    if (P) out.fixes.push({ id: "spf", type: "TXT", host: "@", value: `v=spf1 ${P.spf} ~all`, action: "add", why: `Lists ${P.label} as allowed to send email as ${domain}. Without it, your mail is more likely to land in spam and your address is easier to fake.` });
  } else {
    const rec = spf[0];
    out.spf.lookups = await spfLookups(rec, txt);
    let next = rec.replace(/\s[+?]all\b/i, " ~all");
    if (!/\s[~-]all\b/i.test(next) && !/\sredirect=/i.test(next)) next = `${next.trim()} ~all`;
    let added = 0;
    if (P && !next.toLowerCase().includes(P.spf.toLowerCase()) && !/redirect=/i.test(next)) { next = addInclude(next, P.spf); added = 1; }
    if (out.spf.lookups + added > 10) out.human.push(`SPF needs about ${out.spf.lookups + added} DNS lookups${added ? ` once ${P.spf} is added` : ""} (the limit is 10), so some receivers would fail it. Trimming it means deciding which services to keep: ${rec}`);
    else if (next !== rec) out.fixes.push({ id: "spf", type: "TXT", host: "@", value: next, current: rec, action: "replace", why: "Your SPF record needs a small change so it lists your email provider and ends safely. Edit the existing record (there must only ever be one), don't add a second one." });
  }

  // DMARC: always started in monitor mode (p=none) so nothing that works today gets blocked.
  const dmarc = (await txt(`_dmarc.${domain}`)).filter((r) => /^v=dmarc1\b/i.test(r));
  out.dmarc = { records: dmarc, policy: dmarc[0] ? ((dmarc[0].match(/\bp=(\w+)/i) || [])[1] || "missing").toLowerCase() : null };
  if (dmarc.length > 1) out.human.push(`${domain} has ${dmarc.length} DMARC records, which receivers ignore. Needs merging: ${dmarc.join("  |  ")}`);
  else if (!dmarc.length) {
    const rua = contactEmail.endsWith(`@${domain}`) ? `; rua=mailto:${contactEmail}` : "";
    out.fixes.push({ id: "dmarc", type: "TXT", host: "_dmarc", value: `v=DMARC1; p=none${rua}`, action: "add", why: "DMARC tells inboxes what to do with mail that pretends to be from you. This starts it in monitor mode, so nothing that works today gets blocked." });
    if (!rua) out.notes.push("Want weekly DMARC reports? Reply with an address at your own domain and we'll send the one-line change. It's optional.");
  } else if (out.dmarc.policy === "missing") {
    out.fixes.push({ id: "dmarc", type: "TXT", host: "_dmarc", value: dmarc[0].replace(/^v=dmarc1\s*;?\s*/i, "v=DMARC1; p=none; "), current: dmarc[0], action: "replace", why: "Your DMARC record is missing its policy (p=), so it does nothing. This adds monitor mode." });
  }

  // DKIM: keys are generated inside the provider's admin console, so this is a buyer click, not a record we can write.
  const selectors = P ? P.dkimSelectors : ["google", "selector1", "selector2", "default", "k1", "s1", "zoho", "fm1", "protonmail"];
  for (const s of selectors) {
    const name = `${s}._domainkey.${domain}`;
    const [t, c] = await Promise.all([txt(name), resolve(name, "CNAME")]);
    if (t.some((r) => /\bp=[A-Za-z0-9+/]/.test(r)) || c.answers.length) out.dkim.push(s);
  }
  if (P && !out.dkim.length) out.buyerSteps.push({ id: "dkim", title: `Turn on DKIM in ${P.label}`, text: `${P.dkimSteps} Already turned it on with a custom name? Reply and tell us, and we'll mark it done.`, help: P.dkimHelp });

  const spfOk = spf.length === 1 && /\s[~-]all\b|redirect=/i.test(spf[0]) && (!P || spf[0].toLowerCase().includes(P.spf.toLowerCase()) || /redirect=/i.test(spf[0])) && !(out.spf.lookups > 10);
  const dmarcOk = dmarc.length === 1 && ["none", "quarantine", "reject"].includes(out.dmarc.policy);
  out.locked = Boolean(P) && spfOk && dmarcOk && out.dkim.length > 0;
  return out;
}

// What's still open, for reminders: ids of fixes and buyer steps.
export function openItems(a) {
  return [...a.fixes.map((f) => f.id), ...a.buyerSteps.map((s) => s.id)];
}
