// "What service do I need?" quiz: questions, scoring and plan copy.
// Shared by the page (src/pages/services/quiz.astro, runs in the browser) and the plan-email
// Worker (workers/quiz/), so the on-screen result and the email always match.
// Names and prices come from ./services.ts only. Never add per-item prices or estimates here.
import { remoteIt, remoteSupportPlan, automationOffers, officeTuneUp, frontOfficePackage, followUpDesk, followUpDeskSale, followUpDeskTrialDays, showPackageValue, introPricing, usd, type Offer } from './services';

const quickWin = automationOffers.find((o) => o.slug === 'quick-win')!;
const aiFaq = automationOffers.find((o) => o.slug === 'ai-faq')!;
const leadRouting = automationOffers.find((o) => o.slug === 'lead-routing')!;

// D = the self-serve Follow-Up Desk (audit Nov 7 2026, A4: the quiz could not recommend it). It is the pick when sent
// estimates go quiet or reminders are sent by hand; L (inside the Front Office Package) stays the pick for intake/routing.
export type ServiceKey = 'R' | 'Q' | 'F' | 'L' | 'D';
export const SERVICES: Record<ServiceKey | 'S', Offer> = { R: remoteIt, Q: quickWin, F: aiFaq, L: leadRouting, D: followUpDesk, S: remoteSupportPlan };
const SERVICE_HREF: Record<ServiceKey, string> = { R: '/services/remote-it/', Q: '/services/#quick-win', F: '/services/#front-office-package', L: '/services/#front-office-package', D: '/follow-up-desk/' };
export const CONTACT_TOPIC: Record<ServiceKey | 'S', string> = { R: 'remote-it', S: 'support-plan', Q: 'quick-win', F: 'front-office-package', L: 'front-office-package', D: 'follow-up-desk' };

/** Founding sale checked at call time (the quiz Worker can outlive a build), so the plan never shows an ended price. */
const deskSaleLive = () => Boolean(followUpDeskSale.monthlyUrl && followUpDeskSale.annualUrl) && Date.now() < Date.parse(followUpDeskSale.endsAt);
const deskMonthly = () => (deskSaleLive() ? followUpDeskSale.monthly : followUpDesk.from);
// Never shown as a crossed-out "was" price: $250 is the price from Dec 1 (see followUpDeskSale in services.ts).
const deskPriceLine = () => deskSaleLive()
  ? `${followUpDeskTrialDays} days free, then ${usd(followUpDeskSale.monthly)}/month. That is the founding price for anyone who starts by ${followUpDeskSale.endsLabel}, and it stays ${usd(followUpDeskSale.monthly)} for as long as you stay subscribed. From ${followUpDeskSale.regularFrom}, new signups pay ${usd(followUpDesk.from)}/month. Card required to start, cancel anytime.`
  : `${followUpDeskTrialDays} days free, then ${usd(followUpDesk.from)}/month. Card required to start, cancel anytime.`;

export function priceLine(o: Offer): string {
  return o.unit
    ? `Starting at ${usd(o.from)}${o.unit}.`
    : `Starting at ${usd(o.from)}, scoped per project.`;
}
const QW_UPSELL = `Want more than one form handled, or your whole office set up? That\'s what the ${remoteIt.name} (starting at ${usd(remoteIt.from)}) and the ${frontOfficePackage.name} are for.`;
// F and L results point at the Front Office Package: the $499/$799 parts are quoted on request, not listed (Nov 4 2026).
const PACKAGE_PRICE = () => `This is part of the ${frontOfficePackage.name}: ${usd(frontOfficePackage.from)} flat for the assistant, lead routing, email authentication setup and three months of support. Need only this one piece? Ask, and we'll quote it on its own.`;
export const PRICE_DISCLAIMER = `Pricing is a starting point, not a quote. ${introPricing.label} apply to the first 10 clients.`;

// ------------------------------------------------------------------ questions

export interface QuizOption { v: string; label: string; exclusive?: boolean }
export interface QuizQuestion { id: QId; text: string; hint?: string; multi?: boolean; options: QuizOption[] }
export type QId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7' | 'q8' | 'q9';

export const QUESTIONS: QuizQuestion[] = [
  { id: 'q1', text: "Who\'s this for?", options: [
    { v: 'A', label: 'I run my own business or work solo (freelancer, consultant, trade, creator)' },
    { v: 'B', label: 'I run or manage a small team or office' },
    { v: 'C', label: "I\'m starting a business or side project" },
    { v: 'D', label: 'Just me, for personal use or to learn more about tech' },
  ] },
  { id: 'q2', text: 'How many people (including you) need work email, logins or devices set up?', options: [
    { v: 'A', label: 'Just me' },
    { v: 'B', label: '2–5' },
    { v: 'C', label: '6–10' },
    { v: 'D', label: '11 or more' },
    { v: 'E', label: "Doesn\'t apply to me" },
  ] },
  { id: 'q3', text: "What\'s bugging you most right now?", hint: 'Pick one.', options: [
    { v: 'A', label: "Email and accounts are a mess (personal addresses, shared logins, nobody\'s sure who has access)" },
    { v: 'B', label: "I\'m worried about security: passwords, Wi-Fi, losing important files" },
    { v: 'C', label: 'I lose hours to the same repetitive task every week' },
    { v: 'D', label: 'I answer the same customer questions again and again' },
    { v: 'E', label: 'New inquiries or leads slip through the cracks, or follow-up is slow' },
    { v: 'G', label: "Estimates or quotes I've already sent go quiet, and I chase them by hand (or never get to it)" },
    { v: 'F', label: "Nothing urgent. I\'m curious what\'s possible" },
  ] },
  { id: 'q4', text: 'What email do you use for work today?', options: [
    { v: 'A', label: 'A personal address (Gmail, Yahoo, Outlook.com, etc.)' },
    { v: 'B', label: "My own domain, but messages land in spam or I\'m not sure it\'s set up right" },
    { v: 'C', label: 'My own domain, and it works well' },
    { v: 'D', label: 'Not sure' },
    { v: 'E', label: "I don\'t use email for work" },
  ] },
  { id: 'q5', text: 'Which of these sound familiar?', hint: 'Pick all that apply.', multi: true, options: [
    { v: 'A', label: "Passwords get reused, shared by text or doc, or two-factor sign-in isn\'t on" },
    { v: 'B', label: "I\'ve never updated my router or changed its admin password (or I don\'t know how)" },
    { v: 'C', label: "No backup, or I\'ve never tested restoring one" },
    { v: 'D', label: 'Laptops and phones get set up (or handed back) differently every time' },
    { v: 'E', label: "None of these, I\'m in good shape", exclusive: true },
    { v: 'F', label: 'Not sure' },
  ] },
  { id: 'q6', text: 'Which of these happens in your week?', hint: 'Pick the closest.', options: [
    { v: 'A', label: 'People ask the same questions (hours, prices, how to book)' },
    { v: 'B', label: 'Inquiries come in from several places (form, email, DMs) and some get missed' },
    { v: 'C', label: 'I copy information between apps by hand (form to spreadsheet, email to calendar)' },
    { v: 'D', label: 'I send the same emails or reminders by hand' },
    { v: 'E', label: 'None of these / not sure' },
  ] },
  { id: 'q7', text: 'After things are set up, how would you like to handle small IT changes?', options: [
    { v: 'A', label: "I\'d like someone I can email for small changes (adding a person, a setting, a how-to)" },
    { v: 'B', label: "I\'ll handle it myself if I have good notes" },
    { v: 'C', label: 'Not sure yet' },
  ] },
  { id: 'q8', text: 'Which tools do you use most day to day?', hint: 'This helps me tailor what to have ready.', options: [
    { v: 'A', label: 'Google (Gmail, Google Drive, Google Workspace)' },
    { v: 'B', label: 'Microsoft (Outlook, OneDrive, Microsoft 365)' },
    { v: 'C', label: 'Mostly my phone and its apps' },
    { v: 'D', label: 'A mix, or something else (Apple, Dropbox, etc.)' },
    { v: 'E', label: 'Not sure' },
  ] },
];

export type Answers = { q1: string; q2: string; q3: string; q4: string; q5: string[]; q6: string; q7: string; q8: string; /** Retired Nov 2026 (site is remote-only); old saved answers may still carry it. */ q9?: string };

/** Strict whitelist check. Returns normalized answers or null. Used by the Worker on every request. */
export function validateAnswers(raw: unknown): Answers | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const q of QUESTIONS) {
    const allowed = q.options.map((o) => o.v);
    const val = r[q.id];
    if (q.multi) {
      if (!Array.isArray(val) || val.length < 1 || val.length > allowed.length) return null;
      const set = [...new Set(val)];
      if (!set.every((x) => typeof x === 'string' && allowed.includes(x))) return null;
      const excl = q.options.filter((o) => o.exclusive).map((o) => o.v);
      if (set.some((x) => excl.includes(x as string)) && set.length > 1) return null;
      out[q.id] = (set as string[]).sort();
    } else {
      if (typeof val !== 'string' || !allowed.includes(val)) return null;
      out[q.id] = val;
    }
  }
  return out as Answers;
}

// -------------------------------------------------------------------- scoring

export type ItemCode = 'R-EMAIL' | 'R-AUTH' | 'R-WIFI' | 'R-BACKUP' | 'R-PWM' | 'R-DEVICE';
const ITEM_ORDER: ItemCode[] = ['R-EMAIL', 'R-AUTH', 'R-PWM', 'R-WIFI', 'R-BACKUP', 'R-DEVICE'];
export type ResultType = ServiceKey | 'LEARN' | 'LEARN-BIZ' | 'TALK';

export interface Plan {
  type: ResultType;
  scores: Record<ServiceKey, number>;
  items: ItemCode[];
  healthCheck: boolean;
  support: 'yes' | 'soft' | null;
  secondary: ServiceKey | null;
  basicsTip: boolean;
  wf: 'copy' | 'reminders' | null;
  team: boolean;
  personal: boolean;
  /** Office in Fairbanks or North Pole: the on-site tune-up is an option. */
  local: boolean;
  /** Both the FAQ assistant and lead routing came up: the Front Office Package fits. */
  packageFit: boolean;
  answers: Answers;
}

const TIE: ServiceKey[] = ['R', 'Q', 'F', 'L', 'D'];

export function computePlan(a: Answers): Plan {
  const s: Record<ServiceKey, number> = { R: 0, Q: 0, F: 0, L: 0, D: 0 };
  const items = new Set<ItemCode>();
  let wf: Plan['wf'] = null;
  const personal = a.q1 === 'D';
  const tooBig = a.q2 === 'D';
  const team = a.q2 === 'B' || a.q2 === 'C' || (a.q2 !== 'A' && a.q1 === 'B');

  if (a.q1 === 'A' || a.q1 === 'B') s.R += 1;
  const q3Primary: Record<string, ServiceKey> = { A: 'R', B: 'R', C: 'Q', D: 'F', E: 'L', G: 'D' };
  if (q3Primary[a.q3]) s[q3Primary[a.q3]] += 3;
  if (a.q4 === 'A') { s.R += 2; items.add('R-EMAIL'); items.add('R-AUTH'); }
  if (a.q4 === 'B') { s.R += 2; items.add('R-AUTH'); }
  if (a.q4 === 'D') { s.R += 1; items.add('R-AUTH'); }
  const q5map: Record<string, ItemCode[]> = { A: ['R-PWM'], B: ['R-WIFI'], C: ['R-BACKUP'], D: ['R-DEVICE'], F: ['R-PWM', 'R-BACKUP'] };
  for (const v of a.q5) if (q5map[v]) { s.R += 1; q5map[v].forEach((i) => items.add(i)); }
  if (a.q6 === 'A') s.F += 2;
  if (a.q6 === 'B') s.L += 2;
  if (a.q6 === 'C') { s.Q += 2; wf = 'copy'; }
  // Reminders typed by hand are outgoing follow-up work: the Desk sends those. Inquiry capture (Q) only alerts on new requests.
  if (a.q6 === 'D') { s.D += 2; wf = 'reminders'; }

  let type: ResultType;
  if (personal) type = 'LEARN';
  else if (tooBig) type = 'TALK';
  else if (q3Primary[a.q3]) type = q3Primary[a.q3];
  else {
    const best = [...TIE].sort((x, y) => s[y] - s[x] || TIE.indexOf(x) - TIE.indexOf(y))[0];
    type = s[best] >= 3 ? best : 'LEARN-BIZ';
  }

  let secondary: ServiceKey | null = null;
  if (type === 'R' || type === 'Q' || type === 'F' || type === 'L' || type === 'D') {
    const others = TIE.filter((k) => k !== type && (k === 'R' ? s[k] >= 3 : s[k] >= 2));
    others.sort((x, y) => s[y] - s[x] || TIE.indexOf(x) - TIE.indexOf(y));
    secondary = others[0] ?? null;
  }

  let itemList = ITEM_ORDER.filter((i) => items.has(i));
  let healthCheck = false;
  if (type === 'R' && itemList.length === 0) { itemList = ['R-AUTH', 'R-PWM', 'R-BACKUP']; healthCheck = true; }
  const rShown = type === 'R' || secondary === 'R';
  const support = rShown ? (a.q7 === 'A' ? 'yes' : a.q7 === 'C' ? 'soft' : null) : null;
  const basicsTip = (type === 'Q' || type === 'F' || type === 'L') && items.has('R-EMAIL') && secondary !== 'R';

  // The site is remote-only (Michael, Nov 4 2026): the on-site tune-up is offered only through direct local outreach.
  const local = false;
  const packageFit = !personal && !tooBig && ((type === 'F' && s.L >= 2) || (type === 'L' && s.F >= 2));

  return { type, scores: s, items: itemList, healthCheck, support, secondary, basicsTip, wf, team, personal, local, packageFit, answers: a };
}

// ---------------------------------------------------------------- plan copy

export interface Link { label: string; href: string; primary?: boolean }
export interface ItemView { code: ItemCode; name: string; reason: string; covers: string; ready: string[] }
/** One numbered step in the emailed plan (email only; the on-screen result shows names only). */
export interface PlanStep { title: string; what: string; why?: string; ready?: string[] }
export interface PlanView {
  type: ResultType;
  resultName: string;
  kicker: string;
  heading: string;
  intro: string;
  items?: { title: string; list: ItemView[] };
  focus?: { title: string; text: string };
  includes?: { title: string; list: string[] };
  ready?: string[];
  price?: string;
  youGet?: string;
  note?: string;
  demo?: Link & { text: string };
  addon?: { name: string; reason: string; text: string; price: string; href: string };
  secondary?: { name: string; price: string; text: string; href: string };
  tip?: string;
  freeLinks?: (Link & { text: string })[];
  selfHelp?: string[];
  setupNote?: { text: string; href: string };
  footnote?: string;
  links: Link[];
  subject: string;
  preheader: string;
  /** One sentence tying the answers to the recommendation (shown on screen and in the email). */
  why?: string;
  /** Office in Fairbanks or North Pole: the on-site tune-up, shown next to the recommendation. */
  localPick?: { name: string; price: string; text: string; href: string };
  /** Both the FAQ assistant and lead routing came up: the Front Office Package. */
  packagePick?: { name: string; price: string; text: string; href: string };
  /** Every service with a one-line fit note, so the result never hides an option. */
  allOptions?: { name: string; price: string; line: string; href: string; mark: 'recommended' | 'also' | null }[];
  /** On-screen initial scope: short price line and item names only. */
  startPrice?: string;
  scope?: { title: string; list: string[] };
  /** Emailed plan only: numbered steps in recommended order, why this order, and next steps. */
  steps?: PlanStep[];
  orderNote?: string;
  nextSteps?: string[];
}

const contact = (topic?: string) => `/contact/?${topic ? `topic=${topic}&` : ''}from=quiz`;

function itemView(code: ItemCode, p: Plan): ItemView {
  const a = p.answers;
  const t = a.q8; // tools: A google, B microsoft, C phone, D mix, E unsure
  const check = 'a quick check';
  switch (code) {
    case 'R-EMAIL': return {
      code, name: 'Business email & domain', reason: 'you said you use a personal address for work',
      covers: 'Google Workspace or Microsoft 365 on your own domain: mailboxes, aliases like hello@ or billing@, shared calendars and a clean admin account that you own.',
      ready: [
        a.q1 === 'C' ? "Your domain name and the login for where you bought it (or tell me if you don\'t have one yet)" : "Your domain name and the login for where you bought it (or tell me if you don\'t have one)",
        t === 'A' ? "You already use Google tools, so think about whether you\'d like to stay with Google (Google Workspace). Microsoft 365 is the other option."
          : t === 'B' ? "You already use Microsoft tools, so think about whether you\'d like to stay with Microsoft (Microsoft 365). Google Workspace is the other option."
          : t === 'C' ? 'Which phone you use (iPhone or Android), so your new mail and calendar get set up there too'
          : 'Whether you lean toward Google Workspace or Microsoft 365 (I can help you choose)',
        p.team ? 'A list of who needs a mailbox, and which shared addresses you want (like hello@)' : "The shared addresses you\'d like, such as hello@",
      ] };
    case 'R-AUTH': return {
      code, name: 'Email authentication (SPF, DKIM, DMARC)',
      reason: p.healthCheck ? check : a.q4 === 'A' ? 'needed for your new domain email' : a.q4 === 'B' ? "you said mail lands in spam or you\'re not sure it\'s set up right" : "a quick check, since you weren\'t sure",
      covers: 'Publishing SPF, DKIM and DMARC records so your mail is more likely to land in inboxes and harder to spoof. DMARC starts in monitor mode and is tightened once reports look clean.',
      ready: [
        "Access to your domain\'s DNS settings (usually where you bought the domain)",
        'A list of every tool that sends email as you (newsletter, invoicing, booking, website forms)',
        ...(a.q4 !== 'A' && t === 'A' ? ['Your Google Workspace admin login, if you have one'] : a.q4 !== 'A' && t === 'B' ? ['Your Microsoft 365 admin login, if you have one'] : []),
      ] };
    case 'R-PWM': return {
      code, name: 'Password manager rollout',
      reason: p.healthCheck ? check : a.q5.includes('A') ? 'you said passwords get reused or shared' : check,
      covers: `Choosing a business password manager, setting up shared vaults, turning on two-factor sign-in for key accounts, and a short how-to ${p.team ? 'for everyone' : 'for you'}.`,
      ready: [
        'A rough list of the accounts that matter most (email, bank, domain, payments, social)',
        ...(p.team ? ['Who needs access to which shared logins'] : []),
        t === 'C' ? "Your phone, since that\'s where you\'ll use the password manager most (and where two-factor codes will live)" : 'Your phone, for two-factor setup',
      ] };
    case 'R-WIFI': return {
      code, name: 'Wi-Fi & router security walkthrough', reason: "you said the router hasn\'t been updated or you\'re not sure how",
      covers: "A guided video session on your own router: firmware updates, strong admin and Wi-Fi passwords, WPA2/WPA3, a separate guest network and turning off features you don\'t use.",
      ready: ['Be near the router during the call', 'Its brand and model (usually on a sticker)', "The admin login if you have it (no worries if you don\'t)"] };
    case 'R-BACKUP': return {
      code, name: 'Backups',
      reason: p.healthCheck ? check : a.q5.includes('C') ? "you said there\'s no backup or it\'s never been tested" : check,
      covers: 'A simple 3-2-1 plan for the files that matter: what gets backed up, where, how often, and a test restore so you know it works.',
      ready: [
        t === 'A' ? 'What lives in Google Drive and what only lives on a laptop or phone'
          : t === 'B' ? 'What lives in OneDrive and what only lives on a laptop or phone'
          : t === 'C' ? "What lives only on your phone (photos, files, notes) and whether phone backup is turned on"
          : 'Where your important files live today (laptop, Google Drive, OneDrive, Dropbox, iCloud, an external drive)',
        'Roughly how much data there is',
      ] };
    case 'R-DEVICE': return {
      code, name: 'Device setup checklists', reason: 'you said devices get set up differently every time',
      covers: 'A written checklist for new and departing laptops and phones (updates, disk encryption, screen lock, accounts in and out) that you can reuse.',
      ready: [t === 'C' ? 'A list of the phones (iPhone or Android) and any laptops used for work' : 'A list of the laptops and phones used for work, and whether they are Windows, Mac, iPhone or Android'] };
  }
}

/** F and L are sold inside the Front Office Package on the site, so they never show their own starting price. */
function startLabel(k: ServiceKey): string {
  if (k === 'D') return `${followUpDeskTrialDays} days free, then ${usd(deskMonthly())}/month${deskSaleLive() ? ` (founding price until ${followUpDeskSale.endsLabel})` : ''}`;
  return k === 'F' || k === 'L' ? `Part of the ${frontOfficePackage.name}, ${usd(frontOfficePackage.from)}` : `Starting at ${usd(SERVICES[k].from)}`;
}

function secondaryView(k: ServiceKey, p: Plan): PlanView['secondary'] {
  const o = SERVICES[k];
  const names = p.items.map((c) => itemView(c, p).name);
  const text = k === 'R'
    ? `Your answers flagged ${names.length} ${names.length === 1 ? 'basic' : 'basics'} to tighten up: ${names.join(', ')}. The setup covers them remotely, on accounts you own. Ask about them on the same call.`
    : k === 'Q' ? (p.wf === 'copy' ? `You said you copy information between apps by hand. ${quickWin.name} starts small: one website form feeding a shared list, with an alert to one person, so requests stop getting retyped or lost.` : `You said a repetitive task eats your week. A ${quickWin.name} takes one task off your plate: one website form feeding a shared list, with an alert to one person.`)
    : k === 'D' ? (p.answers.q6 === 'D' ? `You said you send the same emails or reminders by hand. If those are follow-ups on estimates or invoices you've sent, the ${followUpDesk.name} sends them for you and stops when the customer replies. You set it up yourself, no call needed.` : `You said estimates you've sent go quiet. The ${followUpDesk.name} follows up on them for you and stops when the customer replies. You set it up yourself, no call needed.`)
    : k === 'F' ? `You said people ask the same questions. The ${aiFaq.name} answers them from your own FAQ and captures the details of new inquiries.`
    : `You said inquiries slip through or follow-up is slow. The ${leadRouting.name} puts every lead in one flow with reminders so each one gets a reply.`;
  return { name: o.name, price: startLabel(k), text, href: SERVICE_HREF[k] };
}

const BASICS_TIP = `Tip: a business email on your own domain makes any automation cleaner and looks more trustworthy to customers. It\'s part of the ${remoteIt.name} (starting at ${usd(remoteIt.from)}).`;

export function buildPlan(p: Plan): PlanView {
  const v = buildPlanBase(p);
  addDetail(v, p);
  addPicks(v, p);
  return v;
}

const Q3_WHY: Record<string, string> = {
  A: 'your email and accounts are a mess',
  B: 'security is what worries you most',
  C: 'you lose hours to the same repetitive task every week',
  D: 'you answer the same customer questions again and again',
  E: 'new inquiries slip through the cracks or follow-up is slow',
  G: "estimates you've already sent go quiet and you chase them by hand",
  F: 'nothing is urgent and you are curious what is possible',
};
const SIZE: Record<string, string> = { A: 'just you', B: 'a team of 2–5', C: 'a team of 6–10', D: 'a team of 11 or more', E: 'no team setup needed' };

// The parts of the result that make sure every option is visible: why this pick, the on-site option for
// Fairbanks and North Pole, the package when two automation needs overlap, and a one-line fit note per service.
function addPicks(v: PlanView, p: Plan) {
  const a = p.answers;
  const pick = p.type;
  const why = Q3_WHY[a.q3] ?? 'of what you told me';
  v.why = p.type === 'LEARN'
    ? 'Recommended because you said this is for personal use or to learn, and the paid services are built for businesses.'
    : p.type === 'TALK'
      ? `Recommended because you said ${SIZE[a.q2]}, which is bigger than the usual scope, so a short call is the honest next step.`
      : p.type === 'LEARN-BIZ'
        ? 'Recommended because none of your answers flagged a pressing problem, so a small first step or the free guides fit best.'
        : `Recommended because you said ${why}, for ${SIZE[a.q2] ?? 'your business'}.`;

  if (p.local) {
    const t = officeTuneUp;
    v.localPick = {
      name: t.name, price: `${usd(t.from)}, one visit`, href: t.href!,
      text: pick === 'R'
        ? `You are in Fairbanks or North Pole, so the same basics (Wi-Fi, backups, 2-step sign-in, email security, printers) can be checked and fixed in person in one visit instead of remotely. Pick whichever you prefer; the written quote works the same way.`
        : `You are in Fairbanks or North Pole, so an on-site visit is an option too: Wi-Fi, backups, 2-step sign-in, email security and printers checked and fixed in person, with a one-page report.`,
    };
  }
  if (p.packageFit) {
    const f = frontOfficePackage;
    v.packagePick = {
      name: f.name, price: showPackageValue ? `${usd(f.from)}, ${usd(f.value)}+ value` : usd(f.from), href: f.href!,
      text: `Both repeat questions and missed inquiries came up in your answers. The ${f.name} (the Start-Up Deal) bundles the ${aiFaq.name}, the ${leadRouting.name}, email authentication setup and three months of the ${remoteSupportPlan.name} as one connected system.`,
    };
  }

  // When both FAQ and lead problems come up, the package is the recommendation and its parts are 'also'.
  const mark = (k: string): 'recommended' | 'also' | null => (k === pick ? (p.packageFit ? 'also' : 'recommended') : k === p.secondary ? 'also' : null);
  const fit = (k: ServiceKey | 'S' | 'T' | 'P'): string => {
    if (k === 'D') return a.q3 === 'G' ? 'Fits: estimates you sent go quiet. Self-serve: you add them, and the follow-ups send on their own and stop when the customer replies.'
      : a.q6 === 'D' ? 'Fits: you send the same reminders by hand. Self-serve follow-ups on estimates or invoices you sent, which stop when the customer replies.'
      : 'Self-serve follow-ups on estimates you already sent, which stop when the customer replies. Did not come up in your answers.';
    switch (k) {
      case 'R': return p.items.length ? `Covers the basics your answers flagged: ${p.items.map((c) => itemView(c, p).name).join(', ')}.` : 'Email on your own domain, email security, passwords, Wi-Fi and backups, set up remotely on accounts you own.';
      case 'S': return a.q7 === 'A' ? 'You said you would like someone to email for small changes; this is that, after a setup.' : 'Optional after a setup: small changes and how-to questions by email, a set number each month.';
      case 'Q': return p.wf === 'copy' ? 'Fits: you copy information between apps by hand.' : 'One website form connected to a shared list, with an alert to one person. The lightest first step.';
      case 'F': return a.q6 === 'A' || a.q3 === 'D' ? 'Fits: people ask you the same questions (hours, prices, how to book).' : 'For businesses that answer the same customer questions every day. Did not come up in your answers.';
      case 'L': return a.q6 === 'B' || a.q3 === 'E' ? 'Fits: inquiries arrive in several places and some get missed.' : 'For businesses losing leads between inboxes. Did not come up in your answers.';
      case 'T': return p.local ? 'Fits: you are in Fairbanks or North Pole, so the basics can be checked and fixed in person.' : 'On-site only, in Fairbanks and North Pole, Alaska. Not available where you are; the remote setup covers the same ground.';
      case 'P': return p.packageFit ? 'Fits: both repeat questions and missed inquiries came up. All four parts as one system.'
        : pick === 'F' ? `${fit('F')} The FAQ assistant, lead routing, email authentication setup and three months of support as one project.`
        : pick === 'L' ? `${fit('L')} Lead routing, the FAQ assistant, email authentication setup and three months of support as one project.`
        : 'The FAQ assistant, lead routing, email authentication setup and three months of support as one project. Best when repeat questions or missed inquiries are a problem.';
    }
  };
  v.allOptions = [
    { name: remoteIt.name, price: `from ${usd(remoteIt.from)}`, line: fit('R'), href: '/services/remote-it/', mark: mark('R') },
    { name: remoteSupportPlan.name, price: `from ${usd(remoteSupportPlan.from)}/mo`, line: fit('S'), href: remoteSupportPlan.href!, mark: p.support === 'yes' ? 'also' : null },
    { name: quickWin.name, price: `from ${usd(quickWin.from)}`, line: fit('Q'), href: '/services/#quick-win', mark: mark('Q') ?? (p.type === 'LEARN-BIZ' ? 'also' : null) },
    { name: `${frontOfficePackage.name} (Start-Up Deal)`, price: usd(frontOfficePackage.from), line: fit('P'), href: frontOfficePackage.href!, mark: p.packageFit || pick === 'F' || pick === 'L' ? 'recommended' : null },
    { name: followUpDesk.name, price: `${usd(deskMonthly())}/mo${deskSaleLive() ? ' founding price' : ''}, ${followUpDeskTrialDays} days free`, line: fit('D'), href: followUpDesk.href!, mark: mark('D') },
  ];
}

function buildPlanBase(p: Plan): PlanView {
  const a = p.answers;
  const t = a.q8;
  const kicker = "What I\'d recommend";
  const base = { type: p.type };

  if (p.type === 'R') {
    const pain = a.q3 === 'A' ? 'your email and accounts feel messy' : a.q3 === 'B' ? 'security is on your mind' : "you\'re curious what to tighten up";
    const list = p.items.map((c) => itemView(c, p));
    const n = list.length;
    const people = a.q2 === 'B' ? 'a team of 2–5' : a.q2 === 'C' ? 'a team of 6–10' : 'just you';
    const v: PlanView = {
      ...base, resultName: remoteIt.name, kicker, heading: remoteIt.name,
      intro: `You told me ${pain}. The fixes your answers point to are the basics this setup covers: email, passwords, Wi-Fi and backups, done remotely by video call and screen share, on accounts you own.`,
      items: { title: p.healthCheck ? 'Start with a quick health check' : 'Based on your answers, start with', list },
      price: `Starting at ${usd(remoteIt.from)}. The final price depends on how many people, accounts and items are in scope. With ${people} and ${n} ${n === 1 ? 'item' : 'items'}, you get a fixed written quote before any work starts. ${PRICE_DISCLAIMER}`,
      youGet: 'What you get either way: clear notes on every change, admin access that stays with you, and a short recorded walkthrough where it helps.',
      footnote: "Handle regulated data (for example HIPAA or PCI), or need someone onsite? That\'s outside this setup. Mention it and I\'ll say so up front and point you somewhere better.",
      links: [
        { label: 'Ask about a setup', href: contact('remote-it'), primary: true },
        { label: "See what\'s included", href: '/services/remote-it/' },
      ],
      subject: `Your NeonKey plan: ${n} IT ${n === 1 ? 'basic' : 'basics'} to set up${p.team ? ' for your team' : ''}`,
      preheader: `The pieces of the ${remoteIt.name} your answers point to, plus what to have ready.`,
    };
    addExtras(v, p);
    return v;
  }

  if (p.type === 'Q') {
    const focusText = p.wf === 'copy' ? 'Moving information between apps automatically, for example new form entries into a spreadsheet, or email requests onto your calendar.'
      : "The task you repeat most. We\'ll pick it together on the call.";
    const apps = t === 'A' ? ' (for example Gmail, Google Sheets, Google Calendar)' : t === 'B' ? ' (for example Outlook, Excel, Teams)' : t === 'C' ? ', including any phone apps you use for it' : '';
    const v: PlanView = {
      ...base, resultName: quickWin.name, kicker, heading: quickWin.name,
      intro: 'One repetitive task is eating your week. Website Inquiry Capture & Alerts starts with the most common one: I connect one website form to a shared list and set up an alert to one person for each new request, using tools you already use. It\'s a small, low-risk first step.',
      focus: { title: 'A good first candidate', text: focusText },
      includes: { title: "What\'s included", list: quickWin.items },
      ready: [
        'The steps you do today, start to finish (bullet points are fine)',
        'How often you do it, and roughly how long it takes',
        `Which apps are involved${apps}, and admin logins for them`,
        'One or two real examples, with private details removed',
      ],
      price: `${priceLine(quickWin)} ${PRICE_DISCLAIMER}`,
      demo: { label: 'See a working demo', href: '/lab/ai-inquiry-triage/', text: 'Want to see the kind of thing I build? Try the AI inquiry triage demo in the Lab.' },
      links: [
        { label: 'Ask about Website Inquiry Capture & Alerts', href: contact('quick-win'), primary: true },
        { label: 'See a working demo', href: '/lab/ai-inquiry-triage/' },
      ],
      setupNote: { text: QW_UPSELL, href: '/services/remote-it/' },
      subject: 'Your NeonKey plan: one task worth automating first',
      preheader: 'The workflow your answers point to, and how to get it ready.',
    };
    addExtras(v, p);
    return v;
  }

  if (p.type === 'F') {
    const solo = !p.team;
    const faqDoc = t === 'A' ? ' (a Google Doc is fine)' : t === 'B' ? ' (a Word doc is fine)' : '';
    const v: PlanView = {
      ...base, resultName: aiFaq.name, kicker, heading: aiFaq.name,
      intro: "You\'re answering the same questions on repeat. An assistant trained on your own FAQ answers the common ones, collects the details and hands anything tricky to a person.",
      includes: { title: 'What it would include for you', list: aiFaq.items.map((i) => i === 'Clear handoff to a human' ? `Clear handoff to a human: ${solo ? 'to you' : 'to the right person on your team'}` : i) },
      ready: [
        `Your 10–20 most common questions, with the answers you usually give (hours, prices, services, how to book, policies)${faqDoc}`,
        'Where those questions come in today (website, email, social DMs, texts)',
        'What details you need from someone before you can help (name, contact, what they need, when)',
        solo ? "How you\'d like to be alerted when it hands off" : 'Who should get which kind of request when it hands off',
      ],
      price: `${PACKAGE_PRICE()} ${PRICE_DISCLAIMER}`,
      demo: { label: 'See the triage demo', href: '/lab/ai-inquiry-triage/', text: 'Related demo: the AI inquiry triage demo in the Lab sorts a customer message and drafts a reply for a person to review.' },
      links: [
        { label: 'Get a written quote', href: contact('front-office-package'), primary: true },
        { label: 'Try the front office demo', href: '/lab/front-office/' },
      ],
      subject: 'Your NeonKey plan: an assistant for your repeat questions',
      preheader: 'What it would include for you, and the FAQ prep that makes it work.',
    };
    addExtras(v, p);
    return v;
  }

  if (p.type === 'L') {
    const solo = !p.team;
    const tracking = t === 'A' ? "even if it\'s a Google Sheet or your Gmail inbox" : t === 'B' ? "even if it\'s an Excel sheet or your Outlook inbox" : t === 'C' ? "even if it\'s your texts or phone notes" : "even if it\'s a spreadsheet or your inbox";
    const v: PlanView = {
      ...base, resultName: leadRouting.name, kicker, heading: leadRouting.name,
      intro: 'Leads are arriving in more than one place and some slip through. This brings every inquiry into one flow, sends it to the right place and reminds you to follow up on time.',
      includes: { title: 'What it would include for you', list: [
        'Form, email or chat intake, pulling in the places your leads arrive today',
        solo ? 'Routing rules to the right sheet, so everything lands in one list' : 'Routing rules to the right person, so each lead has an owner',
        'Follow-up reminders and templates',
        'Simple tracking view',
      ] },
      ready: [
        'Every place a lead can reach you today (website form, email, phone or text, social DMs, marketplaces)',
        solo ? 'How you sort leads (by service, location, urgency)' : 'Who handles which kind of lead',
        "How quickly you\'d like to follow up, and the message you usually send first",
        `Where you track leads now, ${tracking}`,
      ],
      price: `${PACKAGE_PRICE()} ${PRICE_DISCLAIMER}`,
      note: solo && a.q6 !== 'B' ? `Only one or two places to watch? ${quickWin.name} (starting at ${usd(quickWin.from)}) might cover it. I\'ll tell you honestly on the call.` : undefined,
      links: [
        { label: 'Get a written quote', href: contact('front-office-package'), primary: true },
        { label: 'See the Front Office Package', href: frontOfficePackage.href! },
      ],
      subject: 'Your NeonKey plan: stop losing leads between inboxes',
      preheader: 'The intake, routing and follow-up pieces your answers point to.',
    };
    addExtras(v, p);
    return v;
  }

  if (p.type === 'D') {
    const fd = followUpDesk;
    const fop = frontOfficePackage;
    const v: PlanView = {
      ...base, resultName: fd.name, kicker, heading: fd.name,
      intro: `Estimates you've sent are going quiet, and chasing them takes time you don't have. The ${fd.name} sends polite follow-ups on the estimates you add, under your business name, and stops the moment a customer replies. It's self-serve: you set it up yourself in about five minutes, with no call needed.`,
      includes: { title: "What's included", list: [...fd.items] },
      ready: [
        'Your open estimates: customer name, email and the job (paste a list from QuickBooks or a spreadsheet, or add them one at a time)',
        'How you like to word a follow-up (start from ours and edit it)',
        'The inbox where customer replies should land',
      ],
      price: deskPriceLine(),
      note: `Follow-ups come from your business name at a NeonKey sending address, and replies reach your own inbox. They go out Monday to Friday, between 9 AM and noon in your time zone, at most 60 a day.`,
      setupNote: { text: `Would you rather a person on your team send every follow-up from your own inbox, or do new inquiries need capturing and routing too? That's the ${fop.name}, set up for you with a written quote first (${usd(fop.from)}).`, href: fop.href! },
      links: [
        { label: `See how the ${fd.name} works`, href: fd.href!, primary: true },
        { label: 'Compare it with a custom setup', href: '/services/#compare' },
      ],
      subject: 'Your NeonKey plan: stop letting estimates go quiet',
      preheader: `How the ${fd.name} would follow up on your estimates, and what to have ready.`,
    };
    addExtras(v, p);
    return v;
  }

  const freeLinks: PlanView['freeLinks'] = [
    { label: 'Learn', href: '/learn/', text: 'Plain-language guides on security, networking, automation and practical IT. The first track is a CompTIA Security+ study guide, with more tutorials on the way.' },
    { label: 'The Lab', href: '/lab/', text: 'Hands-on builds, including what broke, and a working AI inquiry triage demo.' },
    { label: 'Unlock the Week', href: '/newsletter/', text: 'One short email every Wednesday with a one-minute tech or customer follow-up fix, plus a free Learn guide.' },
  ];

  if (p.type === 'LEARN') {
    const tips: string[] = [];
    if (a.q5.includes('A') || a.q5.includes('F')) tips.push('Turn on two-factor sign-in for your email and bank, and start using a password manager instead of reusing passwords');
    if (a.q5.includes('B')) tips.push("Change your router\'s admin password and update its firmware (the brand\'s app or admin page usually has an update button)");
    if (a.q5.includes('C') || a.q5.includes('F')) tips.push('Make one backup of your important files, then try restoring a single file to be sure it works');
    if (a.q5.includes('D') || t === 'C') tips.push('Turn on automatic updates and a screen lock on your phone and laptop');
    if (a.q4 === 'B' || a.q4 === 'D') tips.push('Check your email account\'s security page for unfamiliar sign-ins or devices');
    if (!tips.length) tips.push('Turn on two-factor sign-in for your main email account, since it can reset most of your other passwords');
    return {
      ...base, resultName: 'Free guides (Learn, Lab, newsletter)', kicker, heading: 'Start with the free guides',
      intro: 'My paid services are built for small businesses and solo pros, so for personal use the best next step is free: plain-language guides, hands-on Lab builds and a weekly email.',
      freeLinks,
      selfHelp: tips,
      setupNote: { text: `Want hands-on help with your own setup? The ${remoteIt.name} (starting at ${usd(remoteIt.from)}) is available if you want it. Ask, and I\'ll tell you honestly whether it makes sense for you.`, href: '/services/remote-it/' },
      links: [
        { label: 'Go to Learn', href: '/learn/', primary: true },
        { label: 'Try the Lab', href: '/lab/' },
        { label: 'Get Unlock the Week', href: '/newsletter/' },
      ],
      subject: 'Your NeonKey next steps: free guides to start with',
      preheader: 'Where to start on NeonKey, plus a few quick things you can do yourself.',
    };
  }

  if (p.type === 'LEARN-BIZ') {
    return {
      ...base, resultName: 'Nothing urgent (free guides, or a small first step)', kicker, heading: 'Good news: nothing urgent jumped out',
      intro: `None of your answers flagged a pressing problem: your email, passwords and backups sound covered and no repetitive task stood out. If you want a small first step anyway, ${quickWin.name} (starting at ${usd(quickWin.from)}) connects one website form to a shared list and alerts one person on each new request. Otherwise, the free guides and weekly email are the right next stop, and every service is listed below so you can see what else exists.`,
      price: `${quickWin.name}: ${priceLine(quickWin)} ${PRICE_DISCLAIMER}`,
      freeLinks,
      links: [
        { label: 'See all services', href: '/services/', primary: true },
        { label: 'Ask about Website Inquiry Capture & Alerts', href: contact('quick-win') },
        { label: 'Go to Learn', href: '/learn/' },
      ],
      subject: 'Your NeonKey next steps: free guides to start with',
      preheader: 'Nothing urgent jumped out. Here are a few good places to start.',
    };
  }

  // TALK (11+ people)
  const q3Map: Record<string, ServiceKey> = { A: 'R', B: 'R', C: 'Q', D: 'F', E: 'L', G: 'D' };
  const named = q3Map[a.q3];
  const touched = TIE.filter((k) => p.scores[k] >= 2).map((k) => `${SERVICES[k].name} (${startLabel(k).toLowerCase()})`);
  return {
    ...base, resultName: "Let\'s talk it through", kicker, heading: "Let\'s talk it through",
    intro: `My setups are built for teams of about 1–10 people, so a bigger team may need more than I offer. I\'d rather say that up front. A short chat is the honest way to find out, and if it\'s not something I can help with, I\'ll say so.${named ? ` The ${SERVICES[named].name} may still help with one piece.` : ''}`,
    includes: touched.length ? { title: 'What your answers touched on', list: touched } : undefined,
    links: [
      { label: 'Get in touch', href: contact(named ? CONTACT_TOPIC[named] : undefined), primary: true },
      { label: 'See all services', href: '/services/' },
    ],
    subject: "Your NeonKey quiz result: let\'s talk it through",
    preheader: "Your team is bigger than my usual scope. Here\'s the honest next step.",
  };
}

function addExtras(v: PlanView, p: Plan) {
  if (p.support) {
    const sp = remoteSupportPlan;
    v.addon = {
      name: sp.name,
      reason: p.support === 'yes' ? "you said you\'d like someone to email for small changes" : 'optional, in case it helps later',
      text: 'Optional add-on after setup: help by email, answered in writing. Up to 3 small requests a month, about 30 minutes each (account adds and removes, settings changes, how-to questions), with a first reply by the end of the next business day (Monday to Friday). Not for emergencies: for an outage or security problem, contact your provider (for example Google or Microsoft) first. Cancel anytime.',
      price: priceLine(sp),
      href: sp.href!,
    };
  }
  if (p.secondary) v.secondary = secondaryView(p.secondary, p);
  if (p.basicsTip) v.tip = BASICS_TIP;
  if (p.type !== 'R' && p.secondary === 'R') v.footnote = "Handle regulated data (for example HIPAA or PCI), or need someone onsite? That\'s outside the IT setup. Mention it and I\'ll say so up front.";
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const SCOPING = [
  "Reply to this email (or use the button below) with any questions.",
  "We confirm exactly what's in scope by email (or a short call, if you prefer).",
  "You get a fixed quote before any work starts.",
];

// Splits the result into an on-screen scope (names only) and the detailed emailed plan.
function addDetail(v: PlanView, p: Plan) {
  const a = p.answers;
  const toolsWhy = a.q8 === 'A' ? 'you said you mostly use Google tools' : a.q8 === 'B' ? 'you said you mostly use Microsoft tools' : a.q8 === 'C' ? 'you said you mostly work from your phone' : a.q8 === 'D' ? 'you said you use a mix of tools' : '';
  const r = v.ready ?? [];
  if (p.type === 'R') {
    const list = v.items!.list;
    v.startPrice = `Starting at ${usd(remoteIt.from)}`;
    v.scope = { title: p.healthCheck ? 'A quick health check of' : 'Based on your answers, your setup would cover', list: list.map((i) => i.name) };
    v.steps = list.map((i) => ({ title: i.name, what: i.covers, why: i.reason.startsWith('a quick check') ? "Your answers didn't flag this directly. It's one of the basics worth a quick check." : cap(i.reason) + '.', ready: i.ready }));
    v.orderNote = "Why this order: email and its authentication come first because most other accounts sign in or reset through your email. Passwords and two-factor sign-in come next because they protect every other account. The network, backups and device checklists build on top of that.";
    v.nextSteps = [...SCOPING, "The work is done remotely by video call and screen share, on accounts you own, with jargon-free notes on every change."];
  } else if (p.type === 'Q') {
    const why = a.q6 === 'C' ? 'You said you copy information between apps by hand.' : a.q3 === 'C' ? 'You said you lose hours to the same repetitive task every week.' : 'Your answers pointed to a repetitive task worth automating.';
    v.startPrice = `Starting at ${usd(quickWin.from)}`;
    v.scope = { title: 'Based on your answers, your inquiry capture setup would cover', list: [...quickWin.items] };
    if (!v.footnote) v.footnote = QW_UPSELL;
    v.steps = [
      { title: 'Write down the task', what: 'A good first candidate: ' + v.focus!.text.charAt(0).toLowerCase() + v.focus!.text.slice(1), why, ready: r.slice(0, 2).concat(r.slice(3)) },
      { title: 'Scope it together', what: 'We pick the single workflow on a short call and agree what it will and won\'t do before anything is built. Keeping it to one task keeps it small and low-risk.', why: 'One workflow, scoped together first, is how every inquiry capture setup starts.', ready: [r[2]] },
      { title: 'Build it on tools you already use', what: 'The automation connects the apps you already use, so your day-to-day routine barely changes.', why: toolsWhy ? cap(toolsWhy) + ', so the build starts there.' : 'The build uses whatever you already work in.' },
      { title: 'Walkthrough and handoff', what: 'A short walkthrough video and notes, then a handoff so you own it.', why: 'So you can run and adjust it without me.' },
    ];
    v.nextSteps = SCOPING;
  } else if (p.type === 'F') {
    const why = a.q6 === 'A' ? 'You said people ask the same questions (hours, prices, how to book).' : 'You said you answer the same customer questions again and again.';
    v.startPrice = startLabel('F');
    v.scope = { title: 'Based on your answers, your assistant would include', list: v.includes!.list };
    v.steps = [
      { title: 'Gather your common questions and answers', what: 'The assistant is trained on your own FAQ content, so this is the most important prep.', why, ready: [r[0]] },
      { title: 'Map where questions come in', what: 'It answers the common questions and captures name, contact and request details from the places people already reach you.', why: 'So nothing new is asked of your customers.', ready: [r[1], r[2]] },
      { title: 'Decide the handoff', what: v.includes!.list.find((x) => x.startsWith('Clear handoff')) + '. Anything tricky goes to a person.', why: p.team ? 'You said you work with a team, so requests can go to the right person.' : 'You said you work solo, so handoffs come to you.', ready: [r[3]] },
      { title: 'Review and tuning session', what: 'Once it\'s running, we review real answers together and tune anything that\'s off.', why: 'So it sounds like you and hands off the right things.' },
    ];
    v.nextSteps = SCOPING;
  } else if (p.type === 'L') {
    const why = a.q6 === 'B' ? 'You said inquiries come in from several places and some get missed.' : 'You said new inquiries or leads slip through the cracks, or follow-up is slow.';
    const inc = v.includes!.list;
    v.startPrice = startLabel('L');
    v.scope = { title: 'Based on your answers, your system would include', list: ['Form, email or chat intake', p.team ? 'Routing rules to the right person' : 'Routing rules into one list', 'Follow-up reminders and templates', 'Simple tracking view'] };
    v.steps = [
      { title: 'Bring every inquiry into one flow', what: inc[0] + '.', why, ready: [r[0]] },
      { title: 'Set the routing rules', what: inc[1] + '.', why: p.team ? 'You said you work with a team, so each lead gets an owner.' : 'You said you work solo, so everything lands in one list.', ready: [r[1]] },
      { title: 'Follow-up reminders and templates', what: 'Reminders so each lead gets a reply on time, using templates based on the message you already send.', why: 'Slow follow-up is where leads usually get lost.', ready: [r[2]] },
      { title: 'A simple tracking view', what: 'One place to see every lead and where it stands.', why: toolsWhy ? cap(toolsWhy) + ', so it can live in tools you already use.' : 'So you can see what needs a reply at a glance.', ready: [r[3]] },
    ];
    v.nextSteps = SCOPING;
  } else if (p.type === 'D') {
    const why = a.q3 === 'G' ? "You said estimates you've already sent go quiet." : 'You said you send the same emails or reminders by hand.';
    v.startPrice = startLabel('D');
    v.scope = { title: `What the ${followUpDesk.name} does for you`, list: v.includes!.list };
    v.steps = [
      { title: 'Start the free trial', what: `${followUpDeskTrialDays} days free, card required. Your private dashboard link arrives by email; there's no password to remember.`, why },
      { title: 'Add your open estimates', what: 'Add them one at a time or paste a list. Each one gets up to three follow-ups.', why: 'The follow-ups only go to estimates you add, so nothing is sent to anyone you did not choose.', ready: [r[0]] },
      { title: 'Check the wording and send yourself a preview', what: 'You pick the days and write your own wording. A preview shows exactly what your customers get.', why: 'So every follow-up sounds like you before anything goes out.', ready: [r[1], r[2]] },
      { title: 'Let it run', what: 'When a customer replies, their reply lands in your inbox and that job\'s follow-ups stop on their own. Mark jobs Won, Lost or Stop with one click, and get a short report every Monday.', why: 'Slow or forgotten follow-up is where quotes usually go cold.' },
    ];
    v.nextSteps = [
      `Open the ${followUpDesk.name} page and start the free trial when you're ready.`,
      'Add a few open estimates and send yourself a preview.',
      'Reply to this email if anything is unclear. A person reads every reply.',
    ];
  } else if (p.type === 'LEARN') {
    v.scope = { title: 'Where to start (free)', list: ['Learn: plain-language guides', 'The Lab: hands-on builds and a working demo', 'Unlock the Week: one short weekly email'] };
    v.nextSteps = ['Pick one of the quick fixes above and do it this week.', 'Browse Learn or the Lab when you have a few minutes.', 'Reply to this email if you get stuck.'];
  } else if (p.type === 'LEARN-BIZ') {
    v.startPrice = `${quickWin.name}: starting at ${usd(quickWin.from)}`;
    v.scope = { title: 'Good places to start', list: ['Free guides in Learn and the Lab', 'Unlock the Week, one short weekly email', `Optional: ${quickWin.name}`] };
    v.nextSteps = ['Browse the free guides when you have a few minutes.', `If a repetitive task comes to mind, reply and ask about ${quickWin.name}.`, 'You get a fixed written quote before any work starts.'];
  } else {
    v.scope = v.includes ? { title: v.includes.title, list: v.includes.list } : undefined;
    v.nextSteps = ['Reply to this email with roughly how many people you have and what\'s bugging you most.', 'I\'ll tell you honestly whether it\'s something I can help with, and point you somewhere better if not.'];
  }
}

/** Human-readable answer summary (used in the lead copy sent to NeonKey). */
export function answerSummary(a: Answers): { q: string; a: string }[] {
  return QUESTIONS.map((q) => {
    const vals = Array.isArray(a[q.id]) ? (a[q.id] as string[]) : [a[q.id] as string];
    return { q: q.text, a: vals.map((v) => q.options.find((o) => o.v === v)?.label ?? v).join('; ') };
  });
}
