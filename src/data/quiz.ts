// "What service do I need?" quiz: questions, scoring and plan copy.
// Shared by the page (src/pages/services/quiz.astro, runs in the browser) and the plan-email
// Worker (workers/quiz/), so the on-screen result and the email always match.
// Names and prices come from ./services.ts only. Never add per-item prices or estimates here.
import { remoteIt, remoteSupportPlan, automationOffers, type Offer } from './services';

const quickWin = automationOffers.find((o) => o.slug === 'quick-win')!;
const aiFaq = automationOffers.find((o) => o.slug === 'ai-faq')!;
const leadRouting = automationOffers.find((o) => o.slug === 'lead-routing')!;

export type ServiceKey = 'R' | 'Q' | 'F' | 'L';
export const SERVICES: Record<ServiceKey | 'S', Offer> = { R: remoteIt, Q: quickWin, F: aiFaq, L: leadRouting, S: remoteSupportPlan };
const SERVICE_HREF: Record<ServiceKey, string> = { R: '/services/remote-it/', Q: '/services/#quick-win', F: '/services/#ai-faq', L: '/services/#lead-routing' };
export const CONTACT_TOPIC: Record<ServiceKey | 'S', string> = { R: 'remote-it', S: 'support-plan', Q: 'quick-win', F: 'ai-faq', L: 'lead-routing' };

export function priceLine(o: Offer): string {
  return o.unit
    ? `Starting at $${o.from}${o.unit}. Typical range ${o.range}.`
    : `Starting at $${o.from}. Typical range ${o.range}, scoped per project.`;
}
export const PRICE_DISCLAIMER = 'Pricing is a starting point, not a quote.';

// ------------------------------------------------------------------ questions

export interface QuizOption { v: string; label: string; exclusive?: boolean }
export interface QuizQuestion { id: QId; text: string; hint?: string; multi?: boolean; options: QuizOption[] }
export type QId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7' | 'q8';

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

export type Answers = { q1: string; q2: string; q3: string; q4: string; q5: string[]; q6: string; q7: string; q8: string };

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
  answers: Answers;
}

const TIE: ServiceKey[] = ['R', 'Q', 'F', 'L'];

export function computePlan(a: Answers): Plan {
  const s: Record<ServiceKey, number> = { R: 0, Q: 0, F: 0, L: 0 };
  const items = new Set<ItemCode>();
  let wf: Plan['wf'] = null;
  const personal = a.q1 === 'D';
  const tooBig = a.q2 === 'D';
  const team = a.q2 === 'B' || a.q2 === 'C' || (a.q2 !== 'A' && a.q1 === 'B');

  if (a.q1 === 'A' || a.q1 === 'B') s.R += 1;
  const q3Primary: Record<string, ServiceKey> = { A: 'R', B: 'R', C: 'Q', D: 'F', E: 'L' };
  if (q3Primary[a.q3]) s[q3Primary[a.q3]] += 3;
  if (a.q4 === 'A') { s.R += 2; items.add('R-EMAIL'); items.add('R-AUTH'); }
  if (a.q4 === 'B') { s.R += 2; items.add('R-AUTH'); }
  if (a.q4 === 'D') { s.R += 1; items.add('R-AUTH'); }
  const q5map: Record<string, ItemCode[]> = { A: ['R-PWM'], B: ['R-WIFI'], C: ['R-BACKUP'], D: ['R-DEVICE'], F: ['R-PWM', 'R-BACKUP'] };
  for (const v of a.q5) if (q5map[v]) { s.R += 1; q5map[v].forEach((i) => items.add(i)); }
  if (a.q6 === 'A') s.F += 2;
  if (a.q6 === 'B') s.L += 2;
  if (a.q6 === 'C') { s.Q += 2; wf = 'copy'; }
  if (a.q6 === 'D') { s.Q += 2; wf = 'reminders'; }

  let type: ResultType;
  if (personal) type = 'LEARN';
  else if (tooBig) type = 'TALK';
  else if (q3Primary[a.q3]) type = q3Primary[a.q3];
  else {
    const best = [...TIE].sort((x, y) => s[y] - s[x] || TIE.indexOf(x) - TIE.indexOf(y))[0];
    type = s[best] >= 3 ? best : 'LEARN-BIZ';
  }

  let secondary: ServiceKey | null = null;
  if (type === 'R' || type === 'Q' || type === 'F' || type === 'L') {
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

  return { type, scores: s, items: itemList, healthCheck, support, secondary, basicsTip, wf, team, personal, answers: a };
}

// ---------------------------------------------------------------- plan copy

export interface Link { label: string; href: string; primary?: boolean }
export interface ItemView { code: ItemCode; name: string; reason: string; covers: string; ready: string[] }
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

function secondaryView(k: ServiceKey, p: Plan): PlanView['secondary'] {
  const o = SERVICES[k];
  const names = p.items.map((c) => itemView(c, p).name);
  const text = k === 'R'
    ? `Your answers flagged ${names.length} ${names.length === 1 ? 'basic' : 'basics'} to tighten up: ${names.join(', ')}. Ask about them on the same call.`
    : k === 'Q' ? (p.wf === 'copy' ? 'Copying information between apps by hand could be a quick win to automate.' : p.wf === 'reminders' ? 'Sending the same emails or reminders by hand could be a quick win to automate.' : 'A repetitive task came up too.')
    : k === 'F' ? 'Repeat questions came up too.' : 'Missed inquiries came up too.';
  return { name: o.name, price: `Starting at $${o.from}`, text, href: SERVICE_HREF[k] };
}

const BASICS_TIP = `Tip: a business email on your own domain makes any automation cleaner and looks more trustworthy to customers. It\'s part of the ${remoteIt.name} (starting at $${remoteIt.from}).`;

export function buildPlan(p: Plan): PlanView {
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
      price: `Starting at $${remoteIt.from}. Typical range ${remoteIt.range}, depending on how many people, accounts and items are in scope. With ${people} and ${n} ${n === 1 ? 'item' : 'items'}, you get a fixed quote after a short scoping call. ${PRICE_DISCLAIMER}`,
      youGet: 'What you get either way: plain-English notes of every change, admin access that stays with you, and a short recorded walkthrough where it helps.',
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
      : p.wf === 'reminders' ? 'Sending the emails or reminders you currently type by hand, automatically and at the right time.'
      : "The task you repeat most. We\'ll pick it together on the call.";
    const apps = t === 'A' ? ' (for example Gmail, Google Sheets, Google Calendar)' : t === 'B' ? ' (for example Outlook, Excel, Teams)' : t === 'C' ? ', including any phone apps you use for it' : '';
    const v: PlanView = {
      ...base, resultName: quickWin.name, kicker, heading: quickWin.name,
      intro: 'One repetitive task is eating your week. I pick that one task with you and automate it using tools you already use, so it\'s a small, low-risk first step.',
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
        { label: 'Ask about a Quick Win', href: contact('quick-win'), primary: true },
        { label: 'See a working demo', href: '/lab/ai-inquiry-triage/' },
      ],
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
      price: `${priceLine(aiFaq)} ${PRICE_DISCLAIMER}`,
      demo: { label: 'See the triage demo', href: '/lab/ai-inquiry-triage/', text: 'Related demo: the AI inquiry triage demo in the Lab sorts a customer message and drafts a reply for a person to review.' },
      links: [
        { label: 'Ask about this', href: contact('ai-faq'), primary: true },
        { label: 'See the triage demo', href: '/lab/ai-inquiry-triage/' },
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
      price: `${priceLine(leadRouting)} ${PRICE_DISCLAIMER}`,
      note: solo && a.q6 !== 'B' ? `Only one or two places to watch? A ${quickWin.name} (starting at $${quickWin.from}) might cover it. I\'ll tell you honestly on the call.` : undefined,
      links: [
        { label: 'Ask about this', href: contact('lead-routing'), primary: true },
        { label: 'See all services', href: '/services/' },
      ],
      subject: 'Your NeonKey plan: stop losing leads between inboxes',
      preheader: 'The intake, routing and follow-up pieces your answers point to.',
    };
    addExtras(v, p);
    return v;
  }

  const freeLinks: PlanView['freeLinks'] = [
    { label: 'Learn', href: '/learn/', text: 'Plain-language guides on security, networking, automation and practical IT. The first track is a CompTIA Security+ study guide, with more tutorials on the way.' },
    { label: 'The Lab', href: '/lab/', text: 'Hands-on builds, including what broke, and a working AI inquiry triage demo.' },
    { label: 'Unlock the Week', href: '/newsletter/', text: 'One short email a week with tech and AI reads worth your time.' },
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
      setupNote: { text: `Want hands-on help with your own setup? The ${remoteIt.name} (starting at $${remoteIt.from}) is available if you want it. Ask, and I\'ll tell you honestly whether it makes sense for you.`, href: '/services/remote-it/' },
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
      intro: `Your basics sound covered and no single task stands out. If you\'d like a small first step, a ${quickWin.name} is the lightest way to try automation. Otherwise, the free guides and weekly email will keep you sharp.`,
      price: `${quickWin.name}: ${priceLine(quickWin)} ${PRICE_DISCLAIMER}`,
      freeLinks,
      links: [
        { label: 'See all services', href: '/services/', primary: true },
        { label: 'Ask about a Quick Win', href: contact('quick-win') },
        { label: 'Go to Learn', href: '/learn/' },
      ],
      subject: 'Your NeonKey next steps: free guides to start with',
      preheader: 'Nothing urgent jumped out. Here are a few good places to start.',
    };
  }

  // TALK (11+ people)
  const q3Map: Record<string, ServiceKey> = { A: 'R', B: 'R', C: 'Q', D: 'F', E: 'L' };
  const named = q3Map[a.q3];
  const touched = TIE.filter((k) => p.scores[k] >= 2).map((k) => `${SERVICES[k].name} (starting at $${SERVICES[k].from})`);
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
      text: 'Optional add-on after setup: async help by email or ticket. It covers a set number of small requests each month (account adds and removes, settings changes, how-to questions), answered within a business-day window agreed in writing. No 24/7 or emergency cover; cancel anytime.',
      price: priceLine(sp),
      href: sp.href!,
    };
  }
  if (p.secondary) v.secondary = secondaryView(p.secondary, p);
  if (p.basicsTip) v.tip = BASICS_TIP;
  if (p.type !== 'R' && p.secondary === 'R') v.footnote = "Handle regulated data (for example HIPAA or PCI), or need someone onsite? That\'s outside the IT setup. Mention it and I\'ll say so up front.";
}

/** Human-readable answer summary (used in the lead copy sent to NeonKey). */
export function answerSummary(a: Answers): { q: string; a: string }[] {
  return QUESTIONS.map((q) => {
    const vals = Array.isArray(a[q.id]) ? (a[q.id] as string[]) : [a[q.id] as string];
    return { q: q.text, a: vals.map((v) => q.options.find((o) => o.v === v)?.label ?? v).join('; ') };
  });
}
