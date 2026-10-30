// Services offered on /services/. Prices are starting points, scoped per project.
// Remote IT pricing basis: see docs/pricing-research.md.
export interface Offer {
  slug: string;
  name: string;
  from: number;
  range: string;
  for: string;
  items: string[];
  href?: string;
  featured?: boolean;
  unit?: string;
  /** Optional link to a working demo of this kind of build. */
  demo?: { label: string; href: string };
}

export const remoteIt: Offer = {
  slug: 'remote-it',
  name: 'Remote Small-Office IT Setup',
  from: 150,
  range: '$150–$400',
  for: 'Get email, Wi-Fi, backups and passwords set up properly for a small office or solo business, fully remote',
  items: [
    'Business email on your own domain (Google Workspace or Microsoft 365)',
    'Email authentication: SPF, DKIM and DMARC',
    'Wi-Fi and router security walkthrough',
    'Backups, password manager rollout and device checklists',
  ],
  href: '/services/remote-it/',
  featured: true,
};

export const remoteSupportPlan: Offer = {
  slug: 'remote-support-plan',
  name: 'Monthly Remote Support Plan',
  from: 75,
  range: '$75–$150 per month',
  unit: '/mo',
  for: 'Optional add-on after setup: async help by email or ticket, with an agreed response window',
  items: [
    'A set number of small requests each month, agreed up front',
    'Email or ticket based, answered within an agreed business-day window',
    'Account adds and removes, settings changes, how-to questions',
    'No 24/7 or emergency cover; cancel anytime',
  ],
  href: '/services/remote-it/#support-plan',
};

export const automationOffers: Offer[] = [
  { slug: 'quick-win', name: 'One-Workflow Quick Win', from: 75, range: '$75–$150', for: 'Automate one repetitive task', items: ['One workflow, scoped together first', 'Connects tools you already use', 'Short walkthrough video and notes', 'Handoff so you own it'], demo: { label: 'See a working demo', href: '/lab/ai-inquiry-triage/' } },
  { slug: 'ai-faq', name: 'AI Intake & FAQ Assistant', from: 250, range: '$250–$500', for: 'Answer common questions and capture inquiries', items: ['Trained on your own FAQ content', 'Captures name, contact and request details', 'Clear handoff to a human', 'Review and tuning session'] },
  { slug: 'lead-routing', name: 'Lead-Routing & Follow-Up System', from: 400, range: '$400–$900', for: 'Send new leads to the right place and follow up on time', items: ['Form, email or chat intake', 'Routing rules to the right person or sheet', 'Follow-up reminders and templates', 'Simple tracking view'] },
];
