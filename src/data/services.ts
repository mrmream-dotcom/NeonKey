// Services offered on /services/. Prices are starting points, scoped per project.
// Remote IT pricing basis: see docs/pricing-research.md.
export interface Offer {
  slug: string;
  name: string;
  from: number;
  for: string;
  /** Plain-English business outcome, shown first on the home and services cards. */
  outcome?: string;
  items: string[];
  href?: string;
  featured?: boolean;
  unit?: string;
  /** Optional card label (defaults to the section's). */
  kicker?: string;
  /** Optional upsell line pointing to a bigger service. */
  upsell?: { text: string; linkText: string; href: string };
  /** Optional link to a working demo of this kind of build. */
  demo?: { label: string; href: string };
  /** Longer plain-English explanation, shown in "See details" and on detail pages. */
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
  /** Extra plain-English note (running costs, limits). */
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
  from: 299,
  outcome: "Help your emails reach inboxes instead of spam, make it harder for scammers to fake your domain, and get your Wi-Fi, backups and passwords locked down",
  for: 'Get email, Wi-Fi, backups and passwords set up properly for a small office or solo business, fully remote',
  items: [
    'Business email on your own domain (Google Workspace or Microsoft 365)',
    'Email authentication: SPF, DKIM and DMARC',
    'Wi-Fi and router security walkthrough',
    'Backups, password manager rollout and device checklists',
  ],
  href: '/services/remote-it/',
  featured: true,
  details: {
    who: "For small offices and solo pros, roughly 1 to 10 people, whose email, passwords and backups grew up by accident. It gets the basics set up properly, on accounts you own, without hiring an IT department.",
    included: [
      'Business email on your own domain in Google Workspace or Microsoft 365: mailboxes, aliases (like hello@ or billing@) and shared calendars',
      'SPF, DKIM and DMARC records published for your domain, with DMARC started in monitor mode',
      'A guided video session on your router: firmware, admin and Wi-Fi passwords, WPA2/WPA3 and a guest network',
      'A simple backup plan for the files that matter, with a test restore',
      'A business password manager set up with shared vaults, plus two-factor sign-in on key accounts',
      'Written checklists for setting up and retiring laptops and phones',
      'Plain-English notes of every change, and admin access that stays with you',
    ],
    steps: [
      { h: 'Scoping call', p: 'A short video call to list what you have today and pick what is in scope. You get a fixed quote before any work starts.' },
      { h: 'Setup sessions', p: 'I do the work remotely by screen share and in the admin consoles you give me access to. Some steps, like DNS changes, can take a day or two to settle.' },
      { h: 'Check it works', p: 'We send test emails, check the authentication records, try signing in with two-factor and do a test restore from backup.' },
      { h: 'Walkthrough and handoff', p: 'A short walkthrough of what changed, the written notes and checklists, and a review that you hold every admin login.' },
    ],
    provide: [
      'Admin access to your domain registrar or DNS host, and to Google Workspace or Microsoft 365 if you already use one',
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
  from: 99,
  unit: '/mo',
  outcome: "Get small IT changes and questions handled without hiring an IT department",
  for: 'Optional add-on after setup: async help by email or ticket, with an agreed response window',
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
      'Settings changes, for example a new alias, a shared folder or a password manager vault',
      'How-to questions answered in plain English',
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
    kicker: 'Start here',
    from: 99,
    outcome: "Get one repetitive task off your plate and a clear list of the tech fixes that matter most",
    for: 'Automate one repetitive task and get a quick remote check of your tech basics',
    items: [
      'One simple workflow automated, scoped together first, using tools you already use',
      'A short remote checkup of the basics: passwords and two-factor sign-in, backups, Wi-Fi and router basics, device updates and security settings',
      'A plain-English written to-do list of the top fixes',
      'Short walkthrough video and notes, then a handoff so you own it',
    ],
    demo: { label: 'See a working demo', href: '/lab/ai-inquiry-triage/' },
    upsell: { text: 'Want the fixes done for you?', linkText: "That's what the Remote Small-Office IT Setup is for.", href: '/services/remote-it/' },
  },
  { slug: 'ai-faq', name: 'AI Intake & FAQ Assistant', from: 499, outcome: "Answer the questions customers ask every day and catch new inquiries before they slip through the cracks", for: 'Answer common questions and capture inquiries', items: ['Trained on your own FAQ content', 'Captures name, contact and request details', 'Clear handoff to a human', 'Review and tuning session'], details: {
      who: "For businesses that answer the same questions every day (hours, prices, booking, what's included) and lose track of new inquiries. The assistant answers from your own FAQ content and collects the details of anyone who wants more.",
      included: [
      'An assistant set up on your own FAQ, policies and service info, written or cleaned up together',
      'A chat or form on your website, or drafted replies to incoming email, depending on what fits your setup',
      'Inquiry capture: name, contact details and what they need, sent to a sheet or your inbox',
      'A clear handoff to a person when the assistant is unsure or the question is outside your FAQ',
      'Rules for what it should never answer (for example exact quotes or medical or legal advice)',
      'A testing round with real example questions, then a review and tuning session',
      'Plain-English notes on how to update the content yourself',
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
  { slug: 'lead-routing', name: 'Lead-Routing & Follow-Up System', from: 799, outcome: "Get every new lead to the right person and follow up on time, so fewer slip away", for: 'Send new leads to the right place and follow up on time', items: ['Form, email or chat intake', 'Routing rules to the right person or sheet', 'Follow-up reminders and templates', 'Simple tracking view'], details: {
      who: "For businesses where new leads arrive from several places (website forms, email, booking tools) and some get missed or answered late. It collects them in one place, sends each to the right person and reminds you to follow up.",
      included: [
      'Intake from your sources, for example your website form, a shared inbox or a booking tool',
      'Routing rules, for example by service, location or source, to the right person, sheet or CRM',
      'An instant confirmation to the person who reached out, if you want one',
      'Follow-up reminders for you, plus email templates for the first few replies',
      'A simple tracking view, for example a Google Sheet or a CRM pipeline, showing every lead and its status',
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
      tools: 'Google Workspace or Microsoft 365, Google Sheets or Excel, common form tools (for example Google Forms, Microsoft Forms, Jotform or Typeform), Slack or Teams for alerts, and CRMs with a standard integration or API, such as HubSpot. Built with mainstream automation tools (for example Zapier, Make or n8n) or Google Apps Script. Anything else is checked on the scoping call.',
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
