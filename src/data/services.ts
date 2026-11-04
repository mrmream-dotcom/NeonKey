// Services offered on /services/. Prices are starting points, scoped per project.
// Remote IT pricing basis: see docs/pricing-research.md.
export interface Offer {
  slug: string;
  name: string;
  from: number;
  for: string;
  /** Business outcome in everyday words, shown first on the home and services cards. */
  outcome?: string;
  /**
   * Short outcome-first card heading (copy test started Nov 2026): the result the client gets.
   * The service `name` is shown under it as a small label, and stays the name used in tracking,
   * pay links and the contact form.
   */
  headline?: string;
  items: string[];
  href?: string;
  featured?: boolean;
  unit?: string;
  /** Standard (post-founding) starting price. Founding-client rates (`from`) apply to the first 10 clients. */
  standard?: number;
  /** Optional card label (defaults to the section's). */
  kicker?: string;
  /** Optional upsell line pointing to a bigger service. */
  upsell?: { text: string; linkText: string; href: string };
  /** Optional link to a working demo of this kind of build. */
  demo?: { label: string; href: string; example?: string };
  /** Longer jargon-free explanation, shown in "See details" and on detail pages. */
  details?: OfferDetails;
}

export interface OfferDetails {
  who: string;
  included: string[];
  steps: { h: string; p: string }[];
  provide: string[];
  tools: string;
  /** Rough range with "usually" wording. Not a promise; omit when it doesn't apply. */
  turnaround?: string;
  priceFactors: string[];
  /** Extra note in simple terms (running costs, limits). */
  note?: string;
}

/** Honest urgency note: NeonKey has no clients yet, so the first 10 genuinely get these rates. */
export const introPricing = {
  label: 'Founding-client rates',
  short: 'Founding-client rate: first 10 clients',
  note: 'Intro pricing for the first 10 clients. Rates go up after that, and your quoted price stays locked in for your project.',
};

/** Format a price like $1,200. */
export const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

export const remoteIt: Offer = {
  slug: 'remote-it',
  name: 'Remote Small-Office IT Setup',
  headline: 'Email, Wi-Fi and backups, set up right',
  from: 299,
  outcome: "Help your emails reach inboxes instead of spam, make it harder for scammers to fake your domain, and get your Wi-Fi, backups and passwords locked down",
  for: 'Get email, Wi-Fi, backups and passwords set up properly for a small office or solo business, fully remote',
  items: [
    'Business email on your own domain (Google Workspace or Microsoft 365)',
    'Email security settings that stop scammers faking your address (SPF, DKIM, DMARC)',
    'Wi-Fi and router security walkthrough',
    'Backups, password manager rollout and device checklists',
  ],
  href: '/services/remote-it/',
  featured: true,
  details: {
    who: "For small offices and solo pros, roughly 1 to 10 people, whose email, passwords and backups grew up by accident. It gets the basics set up properly, on accounts you own, without hiring an IT department.",
    included: [
      'Business email on your own domain in Google Workspace or Microsoft 365: mailboxes, extra addresses that land in the same inbox (aliases, like hello@ or billing@) and shared calendars',
      'Email security settings published for your domain, so scammers can\'t easily fake your address (SPF, DKIM and DMARC records), with DMARC started in report-only mode (monitor mode)',
      'A guided video session on your router: its built-in software (firmware) updates, admin and Wi-Fi passwords, modern Wi-Fi encryption (WPA2/WPA3) and a guest network',
      'A simple backup plan for the files that matter, with a test restore',
      'A business password manager set up with shared password folders (vaults), plus a second login step, like a code on your phone (2FA), on key accounts',
      'Written checklists for setting up and retiring laptops and phones',
      'Clear notes on every change, and admin access that stays with you',
    ],
    steps: [
      { h: 'Scoping call', p: 'A short video call to list what you have today and pick what is in scope. You get a fixed quote before any work starts.' },
      { h: 'Setup sessions', p: 'I do the work remotely by screen share and in the admin settings pages (admin consoles) you give me access to. Some steps, like changes to your domain settings (DNS), can take a day or two to settle.' },
      { h: 'Check it works', p: 'We send test emails, check the authentication records, try signing in with the second login step (2FA) and do a test restore from backup.' },
      { h: 'Walkthrough and handoff', p: 'A short walkthrough of what changed, the written notes and checklists, and a review that you hold every admin login.' },
    ],
    provide: [
      'Admin access to the company where you bought your domain (registrar) or where its settings are managed (DNS host), and to Google Workspace or Microsoft 365 if you already use one',
      'A list of the people, mailboxes and devices to include',
      'Someone at the office who can join a video call and follow along on the router and devices',
    ],
    tools: 'Google Workspace or Microsoft 365, common business password managers (for example Bitwarden or 1Password), mainstream cloud backup tools, and consumer or prosumer routers you already own. Other tools are checked on the scoping call.',
    turnaround: 'Usually 1 to 2 weeks from the scoping call, depending on scope and how quickly sessions can be booked. Your quote gives the plan.',
    priceFactors: [
      'How many people, mailboxes and devices are included',
      'Moving existing email from another provider',
      'How many of the setup items you need',
      'Extra domains, or cleanup of an old or messy setup',
    ],
    note: 'Software subscriptions (for example Google Workspace, Microsoft 365 or a password manager) are billed to you directly by those providers and are not part of this price.',
  },
};

export const remoteSupportPlan: Offer = {
  slug: 'remote-support-plan',
  name: 'Monthly Remote Support Plan',
  headline: 'IT help on call, without hiring IT',
  from: 99,
  standard: 129,
  unit: '/mo',
  outcome: "Get small IT changes and questions handled without hiring an IT department",
  for: 'Optional add-on after setup: help by email or support ticket, answered in writing rather than live (async), with an agreed response window',
  items: [
    'A set number of small requests each month, agreed up front',
    'Email or ticket based, answered within an agreed business-day window',
    'Account adds and removes, settings changes, how-to questions',
    'No 24/7 or emergency cover; cancel anytime',
  ],
  href: '/services/remote-it/#support-plan',
  details: {
    who: "For offices that already have their basics set up and want someone to email when a small change or question comes up, without a big IT contract.",
    included: [
      'A set number of small requests each month, agreed up front',
      'Account adds and removes when people join or leave',
      'Settings changes, for example a new alias, a shared folder or a shared password folder (vault)',
      'How-to questions answered without the jargon',
      'A short note of what was changed for each request',
    ],
    steps: [
      { h: 'Agree the plan', p: 'We agree how many requests are included each month and the response window, in writing.' },
      { h: 'Send a request', p: 'Email or open a ticket describing what you need.' },
      { h: 'Get it handled', p: 'I answer within the agreed business-day window and make the change remotely where needed.' },
      { h: 'Review as you go', p: 'If your needs change, we adjust the plan. Cancel anytime.' },
    ],
    provide: [
      'Admin access (or a delegated admin account) for the systems covered',
      'Requests by email or ticket, with enough detail to act on',
    ],
    tools: 'The same tools covered by the setup: Google Workspace or Microsoft 365, your password manager, backups and devices. Usually offered after a Remote Small-Office IT Setup.',
    priceFactors: [
      'How many people are covered',
      'How many requests are included each month',
      'The response window you choose',
    ],
    note: 'No 24/7, emergency or onsite cover. Bigger projects are scoped and quoted separately.',
  },
};

export const automationOffers: Offer[] = [
  {
    slug: 'quick-win',
    name: 'Quick Win + Tech Checkup',
    headline: 'One repetitive task, off your plate',
    kicker: 'Start here',
    from: 99,
    outcome: "Get one repetitive task off your plate and a clear list of the tech fixes that matter most",
    for: 'Automate one repetitive task and get a quick remote check of your tech basics',
    items: [
      'One simple workflow automated, scoped together first, using tools you already use',
      'A short remote checkup of the basics: passwords and a second login step, like a code on your phone (2FA), backups, Wi-Fi and router basics, device updates and security settings',
      'A jargon-free written to-do list of the top fixes',
      'Short walkthrough video and notes, then a handoff so you own it',
    ],
    demo: { label: 'See a working demo', href: '/lab/ai-inquiry-triage/', example: 'AI inquiry triage' },
    upsell: { text: 'Want the fixes done for you?', linkText: "That's what the Remote Small-Office IT Setup is for.", href: '/services/remote-it/' },
  },
  { slug: 'ai-faq', headline: 'Customer questions answered, even after hours', name: 'AI Intake & FAQ Assistant', from: 499, standard: 699, outcome: "Answer the questions customers ask every day and catch new inquiries before they slip through the cracks", for: 'Answer common questions and capture inquiries', items: ['Trained on your own FAQ content', 'Captures name, contact and request details', 'Clear handoff to a human', 'Review and tuning session'], demo: { label: 'See a working demo', href: '/lab/office-ai/', example: 'Office AI' }, details: {
      who: "For businesses that answer the same questions every day (hours, prices, booking, what's included) and lose track of new inquiries. The assistant answers from your own FAQ content and collects the details of anyone who wants more.",
      included: [
      'An assistant set up on your own FAQ, policies and service info, written or cleaned up together',
      'A chat or form on your website, or drafted replies to incoming email, depending on what fits your setup',
      'Inquiry capture: name, contact details and what they need, sent to a sheet or your inbox',
      'A clear handoff to a person when the assistant is unsure or the question is outside your FAQ',
      'Rules for what it should never answer (for example exact quotes or medical or legal advice)',
      'A testing round with real example questions, then a review and tuning session',
      'Step-by-step notes on how to update the content yourself',
      ],
      steps: [
        { h: 'Scoping call', p: 'We go through the questions you get most, where they come in, and what should always go to a person. You get a fixed quote before work starts.' },
        { h: 'Content and setup', p: 'We gather your FAQ content, then I set up the assistant and connect it to where inquiries should land.' },
        { h: 'Testing', p: 'I test it with real example questions, including tricky and off-topic ones, and you review the answers before it goes live.' },
        { h: 'Launch, tuning and handoff', p: 'It goes live, we review the first real conversations together and adjust, then you get a walkthrough and notes.' },
      ],
      provide: [
        'Your current FAQ, price list, policies or common replies (rough notes are fine)',
        'Access to your website editor or email account, depending on where it will run',
        'Where captured inquiries should go, for example a Google Sheet, Excel file or inbox',
        'An AI provider account in your name, which I can help you set up',
      ],
      tools: 'Google Workspace or Microsoft 365 email, Google Sheets or Excel, and websites where you can add a custom code snippet (most website builders allow this, sometimes only on paid plans). AI models from mainstream providers, for example Google Gemini or OpenAI, on a paid tier.',
      turnaround: 'Usually 1 to 3 weeks from the scoping call, depending mostly on how ready your FAQ content is. Your quote gives the plan.',
      priceFactors: [
        'How much FAQ content there is and how organized it is',
        'Where it runs: website, email, or both',
        'Which tools captured inquiries are sent to',
        'Extra languages or more rounds of testing and tuning',
      ],
      note: 'AI usage and any tool subscriptions are billed to you directly by those providers. AI answers can be wrong, so the assistant is set up to hand off to a person, and you should review it regularly.',
    }, },
  { slug: 'lead-routing', headline: 'Every lead followed up, on time', name: 'Lead-Routing & Follow-Up System', from: 799, standard: 999, outcome: "Get every new lead to the right person and follow up on time, so fewer slip away", for: 'Send new leads to the right place and follow up on time', items: ['Form, email or chat intake', 'Routing rules to the right person or sheet', 'Follow-up reminders and templates', 'Simple tracking view'], details: {
      who: "For businesses where new leads arrive from several places (website forms, email, booking tools) and some get missed or answered late. It collects them in one place, sends each to the right person and reminds you to follow up.",
      included: [
      'Intake from your sources, for example your website form, a shared inbox or a booking tool',
      'Routing rules, for example by service, location or source, to the right person, sheet or customer database (CRM)',
      'An instant confirmation to the person who reached out, if you want one',
      'Follow-up reminders for you, plus email templates for the first few replies',
      'A simple tracking view, for example a Google Sheet or a sales pipeline in your customer database (CRM), showing every lead and its status',
      'Duplicate checks and an alert if a step fails',
      'A walkthrough video and notes covering how to change rules and templates yourself',
      ],
      steps: [
        { h: 'Map it out', p: 'On a scoping call we list where leads come from, who should get them and what a good follow-up looks like. You get a fixed quote before work starts.' },
        { h: 'Build', p: 'I connect your intake sources, set up the routing rules, the tracking view and the reminder and template steps.' },
        { h: 'Test with real examples', p: 'We send test leads through every path, check they land in the right place and fix anything that misfires.' },
        { h: 'Go live and hand off', p: 'It goes live, we check the first real leads together, and you get a walkthrough, notes and ownership of every account.' },
      ],
      provide: [
        'A list of where leads come from today, and who handles what',
        'Admin access to the forms, inbox and any CRM involved',
        'The replies you send now, so templates match how you write',
      ],
      tools: 'Google Workspace or Microsoft 365, Google Sheets or Excel, common form tools (for example Google Forms, Microsoft Forms, Jotform or Typeform), Slack or Teams for alerts, and customer databases (CRMs) such as HubSpot that can connect to other apps (a standard integration or API). Built with mainstream automation tools (for example Zapier, Make or n8n) or Google Apps Script, Google\'s built-in automation scripting. Anything else is checked on the scoping call.',
      turnaround: 'Usually 2 to 4 weeks from the scoping call, depending on how many sources and tools are involved. Your quote gives the plan.',
      priceFactors: [
        'How many intake sources and tools need connecting',
        'How many routing rules and follow-up steps there are',
        'Connecting a CRM, or cleaning up existing lead data',
        'Whether the automation tool needs a paid plan for your volume',
      ],
      note: 'Automation tool and CRM subscriptions are billed to you directly by those providers and are not part of this price.',
    }, },
];

/** On-site Office Tech Tune-Up for Fairbanks and North Pole (page: /local/). Founding rate $249 (Michael, Nov 3 2026). */
export const officeTuneUp: Offer = {
  slug: 'tune-up',
  name: 'Office Tech Tune-Up',
  headline: 'Your office tech, checked and fixed in one visit',
  kicker: 'On-site · Fairbanks and North Pole',
  from: 249,
  outcome: 'Your office tech, checked and fixed in one visit',
  for: 'For small offices, shops and studios in Fairbanks and North Pole, Alaska, that want the basics checked and fixed in person',
  items: ['Wi-Fi and router: passwords, updates, guest network', 'Backups confirmed and a restore tested', '2-step sign-in on email and key accounts', 'Email security records (SPF, DKIM, DMARC) fixed', 'Printers and slow computers sorted out', 'A one-page report of what was fixed and what is next'],
  href: '/local/',
  details: { who: 'Small offices with up to about 10 devices in Fairbanks or North Pole. Evening and Saturday times.', included: [], steps: [], timeline: 'One visit of about 2 to 3 hours', ready: [], priceFactors: ['Number of devices', 'Extra work found on the day, quoted before it is done'] },
};

/**
 * All-inclusive package: AI Intake & FAQ + Lead-Routing + email lockdown + 3 months of the Support Plan.
 * Founding-client rate $999 (Michael, Nov 3 2026). `separately` is what the same parts cost booked one by one at
 * STANDARD rates (Michael set them Nov 3 2026: $699 + $999 + $79 email lockdown + 3 x $129 support = $2,164);
 * `value` is the rounded-down "$2,000+ value" shown crossed out on the card, so the value claim stays true.
 * Shown as the "Start-Up Deal".
 */
export const frontOfficePackage: Offer & { value: number; separately: number; parts: { name: string; value: string }[] } = {
  slug: 'front-office-package',
  name: 'Front Office Package',
  headline: 'Your whole front office, handled',
  kicker: 'Start-Up Deal · All-inclusive',
  from: 999,
  value: 2000,
  separately: 2164,
  outcome: "Answer customer questions, catch every new lead, follow up on time and lock down your business email, set up together as one system with three months of support",
  for: 'The all-in-one option for small businesses that want their front office handled in one project instead of four',
  parts: [
    { name: 'AI Intake & FAQ Assistant', value: 'standard rate from $699' },
    { name: 'Lead-Routing & Follow-Up System', value: 'standard rate from $999' },
    { name: 'Email lockdown (SPF, DKIM and DMARC checked and fixed)', value: 'standard rate $79' },
    { name: '3 months of the Monthly Remote Support Plan', value: 'standard rate $129/mo' },
  ],
  items: [
    'An AI assistant that answers your common questions from your own FAQ and captures new inquiries',
    'Every new lead sent to the right person or sheet, with follow-up reminders and reply templates',
    'Your email security settings checked and fixed, so scammers have a harder time faking your address',
    'Three months of the Monthly Remote Support Plan, so small changes and questions are covered while it beds in',
  ],
  href: '/services/#front-office-package',
  featured: true,
  details: {
    who: "For small businesses that get regular customer questions and new inquiries from more than one place, and want the whole front office handled in one go: answering, capturing, routing, following up and keeping email secure. It's the same work as booking the pieces separately, planned as one connected system.",
    included: [
      'AI Intake & FAQ Assistant: set up on your own FAQ, policies and service info, on your website, email or both, with a clear handoff to a person',
      'Lead-Routing & Follow-Up System: intake from your forms, inbox or booking tool, routing rules, follow-up reminders, reply templates and a simple tracking view',
      'The assistant and the lead routing connected, so inquiries the assistant captures go straight into your lead tracking',
      'Email lockdown: your domain\'s email security records (SPF, DKIM and DMARC) checked and fixed, with DMARC started in report-only mode (monitor mode)',
      'Three months of the Monthly Remote Support Plan, starting at go-live: small changes, tuning and how-to questions by email or ticket',
      'One walkthrough video and written notes covering the whole system, and admin access that stays with you',
    ],
    steps: [
      { h: 'Scoping call', p: 'We map where questions and leads come from, who handles what and what should always go to a person. You get a fixed quote before work starts.' },
      { h: 'Email lockdown first', p: 'I check and fix your email security records early, because domain changes can take a day or two to settle.' },
      { h: 'Build and connect', p: 'I set up the assistant and the lead routing, connect them, and test with real example questions and leads. You review before anything goes live.' },
      { h: 'Go live, then three months of support', p: 'We check the first real conversations and leads together, then the support plan covers tuning and small changes for three months. After that, keep the plan or cancel; it\'s up to you.' },
    ],
    provide: [
      'Your current FAQ, price list, policies or common replies (rough notes are fine)',
      'A list of where leads come from today, and who handles what',
      'Admin access to your website editor, inbox, forms and the company that manages your domain settings (DNS)',
      'An AI provider account in your name, which I can help you set up',
    ],
    tools: 'Google Workspace or Microsoft 365, Google Sheets or Excel, common form and booking tools, websites where you can add a custom code snippet, and mainstream automation tools (for example Zapier, Make or n8n). AI models from mainstream providers on a paid tier. Anything else is checked on the scoping call.',
    turnaround: 'Usually 3 to 5 weeks from the scoping call, depending on how ready your FAQ content is and how many lead sources are involved. Your quote gives the plan.',
    priceFactors: [
      'How much FAQ content there is and how organized it is',
      'How many lead sources and tools need connecting',
      'Connecting a customer database (CRM), or cleaning up existing lead data',
      'Extra domains, languages or rounds of testing',
    ],
    note: 'AI usage, automation tools and other software subscriptions are billed to you directly by those providers and are not part of this price. AI answers can be wrong, so the assistant hands off to a person when unsure. After the three included months, the support plan continues at its normal rate only if you choose to keep it.',
  },
};

/**
 * "What can we automate?" menu on /services/#automation-menu.
 * Everyday jobs a small business can hand to an automation, grouped by the work they save,
 * each pointing to the service it usually fits inside. Examples, not a fixed catalog:
 * every build is scoped on a call, and simple ones may not need custom work at all.
 */
export interface MenuGroup {
  id: string;
  title: string;
  /** Offer slug on this page (an id on /services/) that this group usually fits inside. */
  fits: string;
  fitsLabel: string;
  items: string[];
}

export const automationMenu: MenuGroup[] = [
  {
    id: 'leads', title: 'New leads and inquiries', fits: 'lead-routing', fitsLabel: 'Lead-Routing & Follow-Up',
    items: [
      'Sort and tag new inquiries as they arrive, so the hot ones get seen first',
      'Send each lead to the right person, inbox or spreadsheet automatically',
      'Follow-up reminders and ready-to-send templates, so nobody goes cold',
    ],
  },
  {
    id: 'questions', title: 'Customer questions', fits: 'ai-faq', fitsLabel: 'AI Intake & FAQ Assistant',
    items: [
      'A website assistant that answers your common questions from your own FAQ',
      'Collect name, contact and request details before a human takes over',
      'First-pass sorting of support emails by topic and urgency',
    ],
  },
  {
    id: 'email', title: 'Email and replies', fits: 'quick-win', fitsLabel: 'Quick Win',
    items: [
      'An instant "we got your message" reply that sets expectations',
      'Draft replies to everyday emails that you review before sending',
      'Labels and filters that keep receipts, orders and newsletters out of the way',
    ],
  },
  {
    id: 'money', title: 'Invoices, receipts and admin', fits: 'quick-win', fitsLabel: 'Quick Win',
    items: [
      'Polite payment reminders from the invoicing tool you already use',
      'Receipts read and logged into a spreadsheet by category',
      'Meeting notes summarized and emailed to everyone after the call',
    ],
  },
  {
    id: 'reviews', title: 'Bookings and reviews', fits: 'quick-win', fitsLabel: 'Quick Win',
    items: [
      'Booking reminders that cut down on no-shows',
      'A review request sent a day after the job is done',
      'An alert when a new review lands, with a suggested reply to edit',
    ],
  },
  {
    id: 'it', title: 'Office IT health', fits: 'support-plan', fitsLabel: 'Monthly Remote Support Plan',
    items: [
      'An alert when a backup has not run',
      'A checklist that runs when someone joins or leaves, so accounts are added and closed on time',
      'A check that your email security settings (SPF, DKIM, DMARC) are still in place',
    ],
  },
];
