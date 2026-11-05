// Free email security check (Lab demo at /lab/email-check/). Runs in the visitor's browser: public DNS lookups
// through Cloudflare's DNS-over-HTTPS (cloudflare-dns.com, allowed in public/_headers connect-src). Nothing is
// stored or sent to NeonKey. Nine ratings, a 0-100 score and a letter grade. The paid Email Lockdown
// (workers/lockdown) writes the exact records; this page only says what's wrong.

const DOH = 'https://cloudflare-dns.com/dns-query';
const TYPES = { NS: 2, CNAME: 5, MX: 15, TXT: 16 };

async function lookup(name, type) {
  const r = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}&do=1`, { headers: { accept: 'application/dns-json' } });
  if (!r.ok) throw new Error('DNS lookup failed');
  const d = await r.json();
  return { status: d.Status, ad: Boolean(d.AD), answers: (d.Answer || []).filter((a) => a.type === TYPES[type]).map((a) => a.data) };
}
const joinTxt = (data) => {
  const parts = [...String(data).matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\(.)/g, '$1'));
  return parts.length ? parts.join('') : String(data).replace(/^"|"$/g, '');
};
const txt = async (name) => (await lookup(name, 'TXT')).answers.map(joinTxt);

export function cleanDomain(input) {
  if (!input || typeof input !== 'string') return null;
  let d = input.trim().toLowerCase();
  if (d.includes('@')) d = d.split('@').pop();
  d = d.replace(/^[a-z]+:\/\//, '').split(/[/?#\s]/)[0].replace(/\.$/, '').replace(/^www\./, '');
  return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d) ? d : null;
}

export const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'aol.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'gmx.com']);

function providerFromMx(mx) {
  const s = mx.join(' ').toLowerCase();
  if (/google(mail)?\.com|aspmx/.test(s)) return 'Google Workspace';
  if (/outlook\.com/.test(s)) return 'Microsoft 365';
  for (const [k, l] of [['zoho', 'Zoho Mail'], ['secureserver', 'GoDaddy email'], ['protonmail', 'Proton Mail'], ['messagingengine', 'Fastmail'], ['titan.email', 'Titan Email'], ['mx.cloudflare.net', 'Cloudflare Email Routing'], ['porkbun', 'Porkbun forwarding'], ['icloud', 'iCloud Mail']]) if (s.includes(k)) return l;
  return mx.length ? 'Other email host' : null;
}

async function spfLookups(record, depth = 0, seen = new Set()) {
  let n = 0;
  for (const term of record.split(/\s+/).slice(1)) {
    const t = term.replace(/^[+~?-]/, '').toLowerCase();
    if (t.startsWith('include:') || t.startsWith('redirect=')) {
      n += 1;
      const dom = t.split(/[:=]/)[1];
      if (dom && !seen.has(dom) && depth < 4) {
        seen.add(dom);
        const sub = (await txt(dom)).find((r) => /^v=spf1\b/i.test(r));
        if (sub) n += await spfLookups(sub, depth + 1, seen);
      }
    } else if (/^(a|mx|ptr)([:/]|$)|^exists:/.test(t)) n += 1;
  }
  return n;
}

// Each rating: { key, name, what, points, max, status: 'pass'|'partial'|'fail', detail }
export async function gradeDomain(domain) {
  const [mxR, rootTxt, dmarcTxt, stsTxt, tlsTxt] = await Promise.all([
    lookup(domain, 'MX'), txt(domain), txt(`_dmarc.${domain}`), txt(`_mta-sts.${domain}`), txt(`_smtp._tls.${domain}`),
  ]);
  if (mxR.status === 3) return { domain, exists: false };
  const mx = mxR.answers.map((m) => m.replace(/^\d+\s+/, '').replace(/\.$/, '')).filter(Boolean);
  const provider = providerFromMx(mx);
  const spf = rootTxt.filter((r) => /^v=spf1\b/i.test(r));
  const dmarc = dmarcTxt.filter((r) => /^v=dmarc1\b/i.test(r));
  const policy = dmarc.length === 1 ? ((dmarc[0].match(/\bp=(\w+)/i) || [])[1] || '').toLowerCase() : '';
  const pct = dmarc.length === 1 ? Number((dmarc[0].match(/\bpct=(\d+)/i) || [])[1] || 100) : 100;

  const sels = provider === 'Google Workspace' ? ['google'] : provider === 'Microsoft 365' ? ['selector1', 'selector2'] : ['google', 'selector1', 'selector2', 'default', 'k1', 's1', 'zoho', 'fm1', 'protonmail', 'resend', 'mail'];
  const dkim = [];
  await Promise.all(sels.map(async (s) => {
    const n = `${s}._domainkey.${domain}`;
    const [t, c] = await Promise.all([txt(n), lookup(n, 'CNAME')]);
    if (t.some((r) => /\bp=[A-Za-z0-9+/]/.test(r)) || c.answers.length) dkim.push(s);
  }));
  const lookups = spf.length === 1 ? await spfLookups(spf[0]) : 0;
  const spfEnd = spf.length === 1 ? ((spf[0].match(/\s([+~?-]?)all\b/i) || [])[1] ?? null) : null;

  const R = [];
  const add = (key, name, what, max, points, detail) => R.push({ key, name, what, max, points, status: points >= max ? 'pass' : points > 0 ? 'partial' : 'fail', detail });

  add('MX', 'Mail server', 'Where your email is delivered.', 10, mx.length ? 10 : 0,
    mx.length ? `${provider} (${mx[0]})` : 'No mail server found, so mail to this domain may bounce.');
  add('SPF', 'Approved senders', 'The public list of services allowed to send email as you.', 15,
    spf.length === 1 ? 15 : 0,
    spf.length === 1 ? spf[0] : spf.length > 1 ? `${spf.length} SPF records. Two or more count as none at all.` : 'No SPF record. Anyone can claim to send as you.');
  add('SPF+', 'SPF health', 'Ends safely and stays under the 10-lookup limit.', 10,
    spf.length !== 1 ? 0 : (spfEnd === '+' || spfEnd === '?' ? 0 : (lookups > 10 ? 3 : (spfEnd === '-' || spfEnd === '~' ? 10 : 5))),
    spf.length !== 1 ? 'Needs a working SPF record first.' : spfEnd === '+' ? 'Ends in +all, which lets anyone send as you.' : lookups > 10 ? `About ${lookups} lookups; receivers stop at 10.` : `About ${lookups} of 10 lookups, ends in ${spfEnd ? spfEnd + 'all' : 'no "all" rule'}.`);
  add('DKIM', 'Digital signature', 'Proves a message really came from you and wasn\'t changed.', 15, dkim.length ? 15 : 0,
    dkim.length ? `Signing key found (${dkim.join(', ')}).` : 'No signing key at the usual names.');
  add('DMARC', 'Spoofing policy', 'Tells inboxes what to do with mail that fakes your address.', 15,
    dmarc.length === 1 && policy ? 15 : 0,
    dmarc.length === 1 ? dmarc[0] : dmarc.length > 1 ? 'More than one DMARC record, so inboxes ignore it.' : 'No DMARC record.');
  add('ENF', 'Blocking fakes', 'Whether fake mail is actually stopped, not just watched.', 15,
    policy === 'reject' && pct === 100 ? 15 : policy === 'quarantine' || policy === 'reject' ? 10 : policy === 'none' ? 4 : 0,
    policy === 'reject' ? 'Fakes are rejected.' : policy === 'quarantine' ? (pct < 100 ? `Fakes go to spam, but only for ${pct}% of mail.` : 'Fakes go to spam.') : policy === 'none' ? 'Monitor mode: fakes are reported but still delivered.' : 'Nothing tells inboxes to stop fakes.');
  add('RUA', 'Spoofing reports', 'Daily reports showing who sends mail as you.', 5,
    dmarc.length === 1 && /rua=/i.test(dmarc[0]) ? 5 : 0,
    dmarc.length === 1 && /rua=/i.test(dmarc[0]) ? 'Reports are turned on.' : 'No one receives reports, so fakes go unnoticed.');
  add('TLS', 'Encrypted delivery', 'Makes other servers use encryption when they deliver mail to you.', 5,
    stsTxt.some((r) => /^v=STSv1/i.test(r)) ? 5 : tlsTxt.some((r) => /^v=TLSRPTv1/i.test(r)) ? 2 : 0,
    stsTxt.some((r) => /^v=STSv1/i.test(r)) ? 'MTA-STS is on.' : tlsTxt.some((r) => /^v=TLSRPTv1/i.test(r)) ? 'TLS reports on, MTA-STS off.' : 'Not set up (common for small businesses).');
  add('DNSSEC', 'Tamper-proof DNS', 'Signed DNS so your records can\'t be quietly swapped.', 10, mxR.ad ? 10 : 0,
    mxR.ad ? 'DNSSEC is on and validates.' : 'DNSSEC is off. Your domain host can usually turn it on.');

  const score = R.reduce((s, r) => s + r.points, 0);
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  return { domain, exists: true, mx, provider, score, grade, ratings: R, freeMail: FREE_MAIL.has(domain) };
}

// Sales message by grade: lower grades get the stronger push, higher grades a lighter one. Every grade gets an offer.
export function pitchFor(r) {
  const fails = r.ratings.filter((x) => x.status !== 'pass').map((x) => x.name.charAt(0).toLowerCase() + x.name.slice(1));
  const list = fails.slice(0, 3).join(', ');
  switch (r.grade) {
    case 'F': return { tone: 'urgent', title: `Right now, almost anyone can send email pretending to be ${r.domain}.`, body: `Scammers look for domains like this to fake invoices and password resets to your customers. The missing pieces (${list}) take about 10 minutes to fix once you have the exact records.`, cta: 'Fix it today for $49', alt: 'Want us to handle all of it, plus answering and routing new leads? See the Front Office Package.' };
    case 'D': return { tone: 'urgent', title: `${r.domain} is easy to fake, and your real mail is more likely to land in spam.`, body: `The gaps are ${list}. The Email Lockdown sends you the exact records for your setup, usually within minutes, then rechecks until everything passes.`, cta: 'Close the gaps for $49', alt: 'Your $49 counts toward any bigger NeonKey package later.' };
    case 'C': return { tone: 'firm', title: `Partly protected. A few gaps still let fakes through.`, body: `You have some of the basics, but ${list} still need work. That's exactly what the Email Lockdown fixes.`, cta: 'Finish the job for $49', alt: 'Your $49 counts toward any bigger NeonKey package later.' };
    case 'B': return { tone: 'light', title: `Good shape. A couple of upgrades would make it solid.`, body: `What's left: ${list}. Small changes, but they're the ones that stop fakes instead of just spotting them.`, cta: 'Get the exact changes for $49', alt: 'Already handled? Ask about the Monthly Remote Support Plan to keep it that way.' };
    default: return { tone: 'soft', title: `Excellent. ${r.domain} is well protected.`, body: `Nicely done. Settings drift when you add new tools that send email as you, like a newsletter or invoicing app. We can keep an eye on it for you.`, cta: 'See the Monthly Remote Support Plan', alt: 'Know someone whose domain needs this? The Email Lockdown is $49.' };
  }
}
