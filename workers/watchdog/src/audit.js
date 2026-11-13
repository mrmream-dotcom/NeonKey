// VENDORED COPY of workers/lockdown/src/audit.js at commit 2cf178e (Nov 13 2026). Workers share nothing (repo rule),
// so Founder Watchdog keeps its own copy. Watchdog uses only the helpers (dohResolve, joinTxt, cleanDomain, FREE_MAIL,
// PROVIDERS, providerFromMx, dnsHostFromNs, sendersIn); it never runs the full audit, which needs 50+ lookups.
// To update: copy the file again and change the commit above.
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
  // Added Nov 5 2026 after a real test order on Porkbun forwarding fell to "a person needs to look".
  // SPF includes checked against each provider's live SPF record and help page that day.
  zoho: {
    label: "Zoho Mail",
    spf: "include:zohomail.com", // EU/IN data centers swap the TLD, see spfFor()
    dkimSelectors: ["zmail", "zoho", "default"],
    dkimHelp: "https://www.zoho.com/mail/help/adminconsole/dkim-configuration.html",
    dkimSteps: "Sign in to mailadmin.zoho.com. Go to Domains, pick your domain, open Email Configuration > DKIM, click Add, enter a selector name (for example zmail) and generate the key. Add the TXT record it shows at your domain host, then come back and click Verify.",
  },
  fastmail: {
    label: "Fastmail",
    spf: "include:spf.messagingengine.com",
    dkimSelectors: ["fm1", "fm2", "fm3"],
    dkimHelp: "https://www.fastmail.help/hc/en-us/articles/360060591153-Manual-DNS-configuration",
    dkimRecords: (d) => [1, 2, 3].map((i) => ({ type: "CNAME", host: `fm${i}._domainkey`, value: `fm${i}.${d}.dkim.fmhosted.com` })),
  },
  proton: {
    label: "Proton Mail",
    spf: "include:_spf.protonmail.ch",
    dkimSelectors: ["protonmail", "protonmail2", "protonmail3"],
    dkimHelp: "https://proton.me/support/anti-spoofing-custom-domain",
    dkimSteps: "Sign in to Proton, open Settings > Domain names, click Review next to your domain and open the DKIM tab. Add the three CNAME records it shows (protonmail._domainkey, protonmail2._domainkey, protonmail3._domainkey) at your domain host. Proton checks them on its own.",
  },
  titan: {
    label: "Titan Email",
    spf: "include:spf.titan.email",
    dkimSelectors: ["titan1", "titan", "default"],
    dkimHelp: null,
    dkimSteps: "Sign in to the Titan admin panel (or open your email settings where you bought Titan, such as Hostinger), find the DKIM setting for your domain, and add the TXT record it shows at your domain host.",
  },
  godaddy: {
    label: "GoDaddy email",
    spf: "include:secureserver.net",
    dkimSelectors: ["default", "selector1", "selector2"],
    dkimHelp: null,
    dkimSteps: "GoDaddy email is usually Microsoft 365 or Workspace Email behind the scenes. In your GoDaddy account, open Email & Office, pick your domain and look for the DKIM or email authentication setting, then turn it on.",
  },
  privateemail: {
    label: "Namecheap Private Email",
    spf: "include:spf.privateemail.com",
    dkimSelectors: ["default"],
    dkimHelp: "https://www.namecheap.com/support/knowledgebase/article.aspx/1316/2290/how-to-set-up-dkim-for-private-email/",
    dkimSteps: "Sign in to Namecheap, open Private Email for your domain, find the DKIM record, and add it as a TXT record named default._domainkey at your domain host.",
  },
  // Forwarding services only receive mail and pass it on. The mail you send comes from somewhere else
  // (Gmail "send as", a newsletter tool), so DKIM is that service's setting, not the forwarder's.
  porkbun: { label: "Porkbun email forwarding", forward: true, spf: "include:_spf.porkbun.com" },
  cfrouting: { label: "Cloudflare Email Routing", forward: true, spf: "include:_spf.mx.cloudflare.net" },
  improvmx: { label: "ImprovMX forwarding", forward: true, spf: "include:spf.improvmx.com" },
};

// Zoho's EU and India data centers use their own SPF domain.
function spfFor(P, mx) {
  if (P.spf !== "include:zohomail.com") return P.spf;
  const s = mx.join(" ");
  return /zoho\.eu\b/.test(s) ? "include:zohomail.eu" : /zoho\.in\b/.test(s) ? "include:zohomail.in" : P.spf;
}

// DKIM names many sending tools use, checked for every domain so a key set up elsewhere still counts.
export const COMMON_DKIM = ["google", "selector1", "selector2", "default", "k1", "k2", "s1", "s2", "resend", "mandrill", "mte1", "dkim", "mail", "zmail", "zoho", "fm1", "protonmail", "titan1"];

const KNOWN_MX = [
  ["zoho", "zoho"], ["protonmail", "proton"], ["secureserver", "godaddy"], ["messagingengine", "fastmail"],
  ["mx.cloudflare.net", "cfrouting"], ["porkbun", "porkbun"], ["titan.email", "titan"], ["improvmx", "improvmx"], ["privateemail", "privateemail"],
];
const OTHER_PROVIDERS = [["mxroute", "MXroute"], ["yahoodns", "Yahoo"], ["icloud", "iCloud Mail"]];

export function providerFromMx(mx) {
  const s = mx.join(" ").toLowerCase();
  if (/google(mail)?\.com|aspmx/.test(s)) return { key: "google", label: PROVIDERS.google.label };
  if (/outlook\.com|protection\.outlook/.test(s)) return { key: "microsoft", label: PROVIDERS.microsoft.label };
  for (const [k, key] of KNOWN_MX) if (s.includes(k)) return { key, label: PROVIDERS[key].label };
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

// Known senders by SPF include, so the report can say who is allowed in plain words.
const SENDERS = [
  ["_spf.google.com", "Google Workspace"], ["spf.protection.outlook.com", "Microsoft 365"], ["servers.mcsv.net", "Mailchimp"],
  ["mandrillapp.com", "Mailchimp Transactional"], ["sendgrid.net", "SendGrid"], ["mailgun.org", "Mailgun"], ["amazonses.com", "Amazon SES"],
  ["zoho.com", "Zoho"], ["zohomail.com", "Zoho"], ["secureserver.net", "GoDaddy email"], ["constantcontact.com", "Constant Contact"],
  ["hubspotemail.net", "HubSpot"], ["sendinblue.com", "Brevo"], ["brevo.com", "Brevo"], ["shopify.com", "Shopify"],
  ["salesforce.com", "Salesforce"], ["zendesk.com", "Zendesk"], ["mailjet.com", "Mailjet"], ["mailerlite.com", "MailerLite"],
  ["_spf.porkbun.com", "Porkbun forwarding"], ["_spf.mx.cloudflare.net", "Cloudflare Email Routing"], ["spf.improvmx.com", "ImprovMX"],
  ["spf.messagingengine.com", "Fastmail"], ["_spf.protonmail.ch", "Proton Mail"], ["spf.titan.email", "Titan Email"],
  ["spf.privateemail.com", "Namecheap Private Email"], ["zohomail.eu", "Zoho"], ["zohomail.in", "Zoho"], ["resend.com", "Resend"],
  ["convertkit.com", "Kit (ConvertKit)"], ["kit.com", "Kit"], ["freshdesk.com", "Freshdesk"], ["intuit.com", "Intuit/QuickBooks"],
];
export function sendersIn(record) {
  if (!record) return [];
  const out = [];
  for (const m of record.toLowerCase().matchAll(/(?:include:|redirect=)([^\s]+)/g)) {
    const hit = SENDERS.find(([k]) => m[1] === k || m[1].endsWith(`.${k}`));
    const name = hit ? hit[1] : m[1];
    if (!out.includes(name)) out.push(name);
  }
  return out;
}
const listWords = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

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
  if (!P) out.human.push(`Email is hosted by ${out.provider.label} (MX: ${out.mx.join(", ")}). It isn't one of the providers we write records for automatically, so the SPF include and DKIM steps need a person.`);
  const SPF_INC = P ? spfFor(P, out.mx) : null;

  // SPF
  const spf = (await txt(domain)).filter((r) => /^v=spf1\b/i.test(r));
  out.spf = { records: spf, lookups: null };
  if (spf.length > 1) {
    out.human.push(`${domain} has ${spf.length} SPF records, which counts as no SPF at all. Merging them needs a look at which services still send: ${spf.join("  |  ")}`);
  } else if (spf.length === 0) {
    if (P) out.fixes.push({ id: "spf", type: "TXT", host: "@", value: `v=spf1 ${SPF_INC} ~all`, action: "add", why: `Right now nothing is listed as allowed to send email as ${domain}, so inboxes can't tell your real mail from a fake. This lists ${P.label}, which handles your ${P.forward ? "incoming mail. If you also send from another service, tell us and we'll add it" : "everyday email"}.` });
  } else {
    const rec = spf[0];
    out.spf.lookups = await spfLookups(rec, txt);
    let next = rec.replace(/\s[+?]all\b/i, " ~all");
    if (!/\s[~-]all\b/i.test(next) && !/\sredirect=/i.test(next)) next = `${next.trim()} ~all`;
    let added = 0;
    if (P && !next.toLowerCase().includes(SPF_INC.toLowerCase()) && !/redirect=/i.test(next)) { next = addInclude(next, SPF_INC); added = 1; }
    if (out.spf.lookups + added > 10) out.human.push(`SPF needs about ${out.spf.lookups + added} DNS lookups${added ? ` once ${SPF_INC} is added` : ""} (the limit is 10), so some receivers would fail it. Trimming it means deciding which services to keep: ${rec}`);
    else if (next !== rec) {
      const now = sendersIn(rec);
      const why = added
        ? `Right now your record allows ${now.length ? listWords(now) : "no named services"} to send as you, but not ${P.label}, which handles your ${P.forward ? "incoming mail" : "everyday email"}. That makes your normal replies look unverified to your customers' inboxes. This adds ${P.label} and keeps everything already listed.`
        : `Your record ends in a way that lets anyone claim to be you. This changes only the ending to ~all ("treat others as suspicious") and keeps every service already listed.`;
      out.fixes.push({ id: "spf", type: "TXT", host: "@", value: next, current: rec, action: "replace", why: `${why} Edit the existing record; there must only ever be one.`, senders: now });
    }
    out.notes.push("Does anything else send email as you, like a website form, invoicing or booking app? Reply and tell us. We'll check it's covered before you tighten anything later.");
  }

  // DMARC: started in monitor mode (p=none), which reports but blocks nothing. No rua: raw XML reports confuse owners.
  const dmarc = (await txt(`_dmarc.${domain}`)).filter((r) => /^v=dmarc1\b/i.test(r));
  out.dmarc = { records: dmarc, policy: dmarc[0] ? ((dmarc[0].match(/\bp=(\w+)/i) || [])[1] || "missing").toLowerCase() : null };
  if (dmarc.length > 1) out.human.push(`${domain} has ${dmarc.length} DMARC records, which receivers ignore. Needs merging: ${dmarc.join("  |  ")}`);
  else if (!dmarc.length) {
    out.fixes.push({ id: "dmarc", type: "TXT", host: "_dmarc", value: "v=DMARC1; p=none", action: "add", why: "DMARC tells inboxes what to do with mail that pretends to be from you. This publishes it in monitor mode: it doesn't block anything yet. Moving to blocking (quarantine or reject) is a later step, once we've confirmed every service that sends as you." });
  } else if (out.dmarc.policy === "missing") {
    out.fixes.push({ id: "dmarc", type: "TXT", host: "_dmarc", value: dmarc[0].replace(/^v=dmarc1\s*;?\s*/i, "v=DMARC1; p=none; "), current: dmarc[0], action: "replace", why: "Your DMARC record is missing its policy (p=), so it does nothing. This adds monitor mode, which reports but doesn't block anything yet." });
  }

  // DKIM: keys are generated inside the provider's admin console, so this is a buyer click, not a record we can write.
  const selectors = [...new Set([...(P?.dkimSelectors || []), ...COMMON_DKIM])];
  for (const s of selectors) {
    const name = `${s}._domainkey.${domain}`;
    const [t, c] = await Promise.all([txt(name), resolve(name, "CNAME")]);
    if (t.some((r) => /\bp=[A-Za-z0-9+/]/.test(r)) || c.answers.length) out.dkim.push(s);
  }
  if (P && !out.dkim.length && P.dkimRecords) {
    for (const r of P.dkimRecords(domain)) out.fixes.push({ id: "dkim", ...r, action: "add", why: `These let ${P.label} sign your email so inboxes can prove it really came from you.` });
  } else if (P?.forward && !out.dkim.length) {
    out.buyerSteps.push({ id: "dkim", title: "Turn on email signing where you send from", text: `${P.label} only forwards your incoming mail. The mail you send comes from another service (for example Gmail's "send mail as", or a newsletter or invoicing tool), and that service has its own "authenticate your domain" or DKIM setting. Reply and tell us what you send from, and we'll send the exact steps. Already set up? Tell us and we'll mark it verified.`, help: null });
  } else if (P && !out.dkim.length) out.buyerSteps.push({ id: "dkim", title: `Turn on (or confirm) DKIM in ${P.label}`, text: `We couldn't verify a DKIM key at the names ${P.label} normally uses. It may be off, or set up under a custom name. ${P.dkimSteps} Already on? Reply and tell us, and we'll mark it verified.`, help: P.dkimHelp });

  const spfOk = spf.length === 1 && /\s[~-]all\b|redirect=/i.test(spf[0]) && (!P || spf[0].toLowerCase().includes(SPF_INC.toLowerCase()) || /redirect=/i.test(spf[0])) && !(out.spf.lookups > 10);
  const dmarcOk = dmarc.length === 1 && ["none", "quarantine", "reject"].includes(out.dmarc.policy);
  out.locked = Boolean(P) && spfOk && dmarcOk && out.dkim.length > 0;
  out.senders = sendersIn(spf[0]);
  if (out.locked) out.extras = await extraChecks(domain, out, spf[0], dmarc[0], txt);
  return out;
}

// Extra checks for domains that already pass the four basics, so a protected buyer still learns something useful.
// Informational only: they never change the score or `locked`. status: "good" (in place), "tip" (worth doing next),
// "info" (optional nice-to-have).
export async function extraChecks(domain, out, spfRec = "", dmarcRec = "", txt) {
  const [sts, tls, bimi] = await Promise.all([txt(`_mta-sts.${domain}`), txt(`_smtp._tls.${domain}`), txt(`default._bimi.${domain}`)]);
  const x = [];
  const pol = out.dmarc?.policy;
  const pct = Number((dmarcRec.match(/\bpct=(\d+)/i) || [])[1] ?? 100);
  if (pol === "reject") x.push({ id: "enforce", label: "Fake email is blocked", status: "good", detail: "Your DMARC policy tells inboxes to reject mail that fakes your address." });
  else if (pol === "quarantine") x.push({ id: "enforce", label: "Fake email is blocked", status: pct < 100 ? "tip" : "good", next: "cover every fake, not just some", detail: pct < 100 ? `Inboxes send fakes to spam, but only for ${pct}% of them. Raising it to 100% covers every fake.` : "Your DMARC policy tells inboxes to send fakes to spam. The strictest step after this is reject." });
  else x.push({ id: "enforce", label: "Fake email is blocked", status: "tip", next: "move from monitoring fakes to blocking them", detail: "Not yet. Your DMARC policy is in monitor mode, so fakes are reported but still delivered. Once every service that sends as you passes, moving to quarantine blocks them." });

  const rua = (dmarcRec.match(/\brua=([^;]+)/i) || [])[1];
  x.push(rua
    ? { id: "reports", label: "Fake-email reports", status: "good", detail: `Inboxes send reports about mail using your name to ${rua.replace(/mailto:/gi, "").split(",")[0].trim()}.` }
    : { id: "reports", label: "Fake-email reports", status: "tip", next: "turn on fake-email reports", detail: "No one receives DMARC reports, so you can't see who is sending as you. Adding a report address (rua=) turns that on." });

  if (spfRec) {
    const hard = /\s-all\b/i.test(spfRec);
    x.push({ id: "spfmode", label: "Approved-sender rule", status: hard ? "good" : "info", detail: hard ? "Strict (-all): mail from unapproved servers fails outright." : "Soft (~all): mail from unapproved servers is flagged, not failed. That's common and fine while DMARC does the blocking." });
    if (Number.isInteger(out.spf?.lookups)) x.push({ id: "lookups", label: "Room for more senders", status: out.spf.lookups <= 8 ? "good" : "tip", next: "make room in your approved-senders record", detail: `Your approved-senders record uses ${out.spf.lookups} of the 10 lookups inboxes allow.${out.spf.lookups <= 8 ? " There's room to add another tool that sends as you." : " You're close to the limit, so check before adding another sending tool."}` });
  }

  const hasSts = sts.some((r) => /^v=STSv1/i.test(r));
  x.push({ id: "mtasts", label: "Encrypted delivery (MTA-STS)", status: hasSts ? "good" : "info", detail: hasSts ? "Other mail servers must use encryption when they deliver to you." : "Optional. It makes other mail servers use encryption when delivering to you, instead of only trying to." });
  const hasTls = tls.some((r) => /^v=TLSRPTv1/i.test(r));
  x.push({ id: "tlsrpt", label: "Delivery problem reports", status: hasTls ? "good" : "info", detail: hasTls ? "You get reports when mail to you can't be delivered securely." : "Optional. Sends you a daily report if mail to you couldn't be delivered securely." });
  const hasBimi = bimi.some((r) => /^v=BIMI1/i.test(r));
  x.push({ id: "bimi", label: "Your logo in inboxes (BIMI)", status: hasBimi ? "good" : "info", detail: hasBimi ? "Your logo record is published. Some inboxes show it next to your emails." : pol === "none" ? "Optional. It can show your logo next to your emails in some inboxes, once DMARC blocks fakes." : "Optional. It can show your logo next to your emails in some inboxes. Your DMARC policy already meets the first requirement." });
  return x;
}

// What's still open, for reminders: ids of fixes and buyer steps.
export function openItems(a) {
  return [...a.fixes.map((f) => f.id), ...a.buyerSteps.map((s) => s.id)];
}
