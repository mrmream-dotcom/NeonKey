// Founder Watchdog. Shared by the site (sales page, CTAs) and the quiz Worker's old POST /watchdog waitlist route
// (workers/quiz/src/watchdog.js), so keep the exports that route uses (plannedMonthly/plannedYearly, WD_OPTIONS,
// validateWdAnswers, cleanWdDomain, qualifyWd, wdSummary). Pure data and functions only: no import.meta.env here.
//
// Status: ON SALE since Nov 13 2026. Michael: "why are we doing a waitlist ... make it live now". Prices $9/mo and
// $90/yr were in the master plan and are the ones he approved. The checking itself runs in workers/watchdog/ (README
// there). The waitlist page is gone; its route on the quiz Worker stays only so old links fail politely.

export const watchdog = {
  name: 'Founder Watchdog',
  status: 'live' as const,
  monthly: 9,
  yearly: 90,
  /** Kept for the quiz Worker's waitlist route (same numbers). */
  plannedMonthly: 9,
  plannedYearly: 90,
  // Stripe Payment Links (live account). Each asks for the domain at checkout (custom field "domain") and returns to
  // /founders/watchdog/thanks/. Product prod_VcfopubLOi4DBj; prices price_1UbQT1CRxS1tvAi2bk17BDux ($9/mo,
  // nk_watchdog_monthly) and price_1UbQT2CRxS1tvAi2iepDAxMV ($90/yr, nk_watchdog_yearly).
  monthlyUrl: 'https://buy.stripe.com/aFaeVc38OeV2cNF4Oob3q09', // plink_1UbQTOCRxS1tvAi2exE78atm
  yearlyUrl: 'https://buy.stripe.com/dRm3cucJo28g5ldgx6b3q0a', // plink_1UbQTPCRxS1tvAi2PvqRoQM0
  portalUrl: 'https://billing.stripe.com/p/login/dRm9AS6l07sA29180Ab3q00',
  refundDays: 30,
  /** What the Worker actually checks today (workers/watchdog/src/engine.js). Keep in step with the code. */
  checks: [
    'SPF, DKIM and DMARC: a record that disappears, breaks or gets weaker than it was',
    'Mail servers (MX) and DNS host (NS) changing',
    'Your homepage not loading over HTTPS (an expired certificate shows up here too)',
    'Domain registration expiring: a warning 30 days and 7 days out',
  ],
  /** Honest limits, shown on the page. */
  limits: [
    'One domain per subscription.',
    'Checks run once a day, not every minute. A problem is checked a second time about 15 minutes later before we email you, so one blip does not wake you up.',
    'We warn about the domain renewal date, but not about an HTTPS certificate before it expires; an expired certificate shows up as your homepage not loading.',
    'Alerts come by email from hello@neonkey.tech. We never change anything on your domain.',
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
