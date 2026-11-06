// Lab projects.
// `draft: true` = not published: the card is hidden everywhere (home, /lab/) and the page file lives in
// src/_drafts/lab/ (outside src/pages, so Astro doesn't build it). To publish one, see LAUNCH.md "Hidden drafts".
// The AI inquiry triage entry is a real, deployed build. The three entries after it are sample write-ups, not
// documented real builds yet, so they stay drafts.
export interface LabProject {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  level: string;
  service?: { label: string; href: string };
  /** Card artwork: icon + accent for the branded thumbnail (no screenshots yet). */
  icon?: 'spark' | 'receipt' | 'flask' | 'wifi' | 'shield' | 'bolt';
  accent?: 'cyan' | 'magenta' | 'violet' | 'amber';
  /** Short flag shown on the card image, e.g. when the page has a working tool. */
  flag?: string;
  /** Hidden until it's a real, documented build. */
  draft?: boolean;
}

export const labTags = ['Homelab', 'Automation', 'Networking', 'Security', 'AI'];

export const labProjects: LabProject[] = [
  {
    slug: 'front-office',
    title: 'Front office demo: what we build for a small business',
    summary: 'Click through the system behind the Front Office Package: every inquiry in one tracker, FAQ answers after hours, routing, replies you approve, follow-ups that stop when the customer answers, and email security.',
    tags: ['Automation', 'AI'],
    level: 'Beginner',
    service: { label: 'Front Office Package', href: '/services/#front-office-package' },
    icon: 'bolt', accent: 'cyan', flag: 'Interactive demo',
  },
  {
    slug: 'ai-inquiry-triage',
    title: 'AI inquiry triage: a working demo',
    summary: 'Paste a customer message and an AI sorts it, flags urgency, pulls out the key details and drafts a reply for a human to review. Live demo plus the full write-up.',
    tags: ['AI', 'Automation'],
    level: 'Beginner → Intermediate',
    service: { label: 'Website Inquiry Capture & Alerts', href: '/services/#quick-win' },
    icon: 'spark', accent: 'cyan', flag: 'Live demo',
  },
  {
    slug: 'review-reply',
    title: 'Review reply helper: a working demo',
    summary: 'Paste a customer review and an AI reads the mood, flags anything risky, tells you how fast to respond and drafts a public reply for you to edit. Live demo plus the full write-up.',
    tags: ['AI', 'Automation'],
    level: 'Beginner',
    service: { label: 'Automation services', href: '/services/#automation-menu' },
    icon: 'spark', accent: 'magenta', flag: 'Live demo',
  },
  {
    slug: 'office-ai',
    title: 'Office AI: ask your own documents',
    summary: 'Ask a question and an AI answers only from a business\'s own handbook, price sheet and how-tos, quotes the exact lines it used, and says so when the answer isn\'t in the documents. Live demo plus the full write-up.',
    tags: ['AI', 'Automation'],
    level: 'Beginner → Intermediate',
    service: { label: 'AI Intake & FAQ Assistant', href: '/services/#ai-faq' },
    icon: 'spark', accent: 'violet', flag: 'Live demo',
  },
  {
    slug: 'receipt-sorter',
    title: 'AI receipt & invoice sorter',
    summary: 'Snap a receipt or upload an invoice and an AI reads the date, vendor, total, tax and category into a form you check. Add payments by hand too, then export a simple ledger to a spreadsheet.',
    tags: ['AI', 'Automation'],
    level: 'Beginner',
    service: { label: 'Automation services', href: '/services/#automation-menu' },
    icon: 'receipt', accent: 'magenta', flag: 'Try it',
  },
  {
    draft: true,
    slug: 'n8n-lead-intake-automation',
    title: 'Lead intake automation with self-hosted n8n',
    summary: 'A web form that lands in a sheet, emails the right person and sends a polite auto-reply, all running on a home n8n box.',
    tags: ['Automation', 'Homelab'],
    level: 'Beginner → Intermediate',
    service: { label: 'Lead-Routing & Follow-Up System', href: '/services/' },
  },
  {
    draft: true,
    slug: 'homelab-network-segmentation',
    title: 'Segmenting a home network with VLANs',
    summary: 'Separate networks for IoT gadgets, guests and lab gear on a prosumer router and a mini PC, so one weak device can\'t see everything.',
    tags: ['Networking', 'Security', 'Homelab'],
    level: 'Intermediate',
    service: { label: 'Remote Small-Office IT Setup', href: '/services/remote-it/' },
  },
  {
    draft: true,
    slug: 'ai-faq-assistant-small-business',
    title: 'AI FAQ assistant for a (fictional) small business',
    summary: 'A simple assistant that answers common questions from a short FAQ document and hands off to a human when it isn\'t sure.',
    tags: ['AI', 'Automation'],
    level: 'Beginner → Intermediate',
    service: { label: 'AI Intake & FAQ Assistant', href: '/services/' },
  },
];

/** Projects that are published (not drafts). Use this for every list and link. */
export const publishedLabProjects = labProjects.filter((p) => !p.draft);
