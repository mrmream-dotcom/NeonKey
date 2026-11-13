// Founder Watchdog waitlist (demand test, Nov 13 2026). Shared by the page (src/pages/founders/watchdog.astro, runs in
// the browser) and the quiz Worker's POST /watchdog route (workers/quiz/src/watchdog.js), so both use the same answer
// whitelist and the same definition of a "qualified" signup.
//
// Status: WAITLIST ONLY. Founder Watchdog is not for sale. There is no Stripe product, no beta and no promise to build
// it. Michael parked a $20-30 "Email Watch" on Nov 7 2026; the $9/$90 figures below are the master plan's PLANNED
// prices, shown only so interest is measured against a real number. Showing them on the live site is an open owner
// decision Michael made on Nov 13 2026 ("Ship all items"), so the waitlist is live (WATCHDOG_WAITLIST in src/config.ts). Pure data and functions only: no import.meta.env here, the Worker bundles this file too.

export const watchdog = {
  name: 'Founder Watchdog',
  status: 'waitlist' as const,
  plannedMonthly: 9,
  plannedYearly: 90,
  /** What the planned basic tier would watch, from master plan section G. Planned scope, not a promise. */
  plannedChecks: [
    'SPF, DKIM and DMARC: alert when a record disappears, breaks or loosens',
    'Mail servers (MX) and DNS host (NS) changes',
    'HTTPS certificate close to expiring',
    'Domain registration close to expiring',
    'Your homepage going down',
  ],
};

/** Whitelisted answers. The form uses these exact keys; the Worker rejects anything else. */
export const WD_OPTIONS = {
  dns: {
    self: 'I can add DNS records myself',
    other: 'Someone else manages DNS (a developer, agency or IT person)',
    unsure: 'Not sure who manages it',
  },
  domains: { one: '1 domain', few: '2 to 5 domains', many: '6 or more' },
  plan: {
    monthly: 'Monthly, at the planned $9',
    yearly: 'Yearly, at the planned $90',
    free_only: 'Only if it were free',
    unsure: 'Not sure yet',
  },
  watch: {
    email: 'Email authentication (SPF, DKIM, DMARC)',
    ssl: 'HTTPS certificate expiry',
    expiry: 'Domain renewal date',
    uptime: 'Website up or down',
    changes: 'Any DNS change I did not make',
  },
} as const;

/** Where the visitor came from on the site. Unknown values become "direct". */
export const WD_FROM = ['preflight', 'lockdown-check', 'lockdown-thanks', 'guide', 'guide-thanks', 'founders-hub', 'direct'] as const;

export type WdDns = keyof typeof WD_OPTIONS.dns;
export type WdDomains = keyof typeof WD_OPTIONS.domains;
export type WdPlan = keyof typeof WD_OPTIONS.plan;
export type WdWatch = keyof typeof WD_OPTIONS.watch;
export type WdFrom = (typeof WD_FROM)[number];

export interface WdAnswers { dns: WdDns; domains: WdDomains; plan: WdPlan; watch: WdWatch[]; from: WdFrom }

const has = (o: object, k: unknown): boolean => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

/** Strict check of the form answers. Returns null if anything is missing or not on the whitelist. */
export function validateWdAnswers(raw: unknown): WdAnswers | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!has(WD_OPTIONS.dns, r.dns) || !has(WD_OPTIONS.domains, r.domains) || !has(WD_OPTIONS.plan, r.plan)) return null;
  const watchIn = Array.isArray(r.watch) ? r.watch : [];
  if (watchIn.length > Object.keys(WD_OPTIONS.watch).length) return null;
  const watch = [...new Set(watchIn)].filter((w) => has(WD_OPTIONS.watch, w)) as WdWatch[];
  if (watch.length !== watchIn.length) return null;
  const from = (WD_FROM as readonly string[]).includes(String(r.from)) ? (r.from as WdFrom) : 'direct';
  return { dns: r.dns as WdDns, domains: r.domains as WdDomains, plan: r.plan as WdPlan, watch, from };
}

// Personal mailbox domains: nobody can watch these for a customer. Same list as workers/lockdown/src/audit.js FREE_MAIL.
export const FREE_MAIL_DOMAINS = ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'ymail.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'gmx.com', 'zoho.com'];

/** "https://www.Shop.com/x", "me@shop.com", "shop.com." -> "shop.com". Null if it isn't a plausible domain. */
export function cleanWdDomain(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let d = input.trim().toLowerCase();
  if (d.includes('@')) d = d.split('@').pop() || '';
  d = d.replace(/^[a-z]+:\/\//, '').split(/[/?#:\s]/)[0].replace(/\.$/, '').replace(/^www\./, '');
  return /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d) ? d : null;
}

export interface WdQualification { qualified: boolean; payIntent: boolean; controlIntent: 'self' | 'helper' | 'unknown'; reasons: string[] }

/**
 * A signup counts toward the Dec 13 gate (master plan section J: 25+ waitlist) only when it is QUALIFIED:
 *   1. a real domain of their own (not gmail.com and friends),
 *   2. a route to adding a DNS record (they can, or someone who manages it for them can), because Watchdog only watches
 *      a domain after a TXT record proves control (master plan, domain ownership rule),
 *   3. they would pay the planned price (monthly or yearly), not "only if free".
 * "Not sure" on DNS or price keeps the signup but leaves it unqualified. Reasons are for the lead copy, not the visitor.
 */
export function qualifyWd(domain: string | null, a: WdAnswers): WdQualification {
  const reasons: string[] = [];
  if (!domain) reasons.push('no valid domain');
  else if (FREE_MAIL_DOMAINS.includes(domain)) reasons.push('personal mailbox domain');
  const controlIntent = a.dns === 'self' ? 'self' : a.dns === 'other' ? 'helper' : 'unknown';
  if (controlIntent === 'unknown') reasons.push('unsure who manages DNS');
  const payIntent = a.plan === 'monthly' || a.plan === 'yearly';
  if (!payIntent) reasons.push(a.plan === 'free_only' ? 'only if free' : 'unsure about price');
  return { qualified: reasons.length === 0, payIntent, controlIntent, reasons };
}

/** Short one-line summary of the answers, for the lead copy email. */
export function wdSummary(domain: string | null, a: WdAnswers): string[] {
  return [
    `Domain: ${domain || '(none given)'}`,
    `DNS: ${WD_OPTIONS.dns[a.dns]}`,
    `Domains: ${WD_OPTIONS.domains[a.domains]}`,
    `Would pay: ${WD_OPTIONS.plan[a.plan]}`,
    `Wants watched: ${a.watch.length ? a.watch.map((w) => WD_OPTIONS.watch[w]).join('; ') : '(none picked)'}`,
    `Came from: ${a.from}`,
  ];
}
