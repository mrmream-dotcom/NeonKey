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
    slug: 'ai-inquiry-triage',
    title: 'AI inquiry triage: a working demo',
    summary: 'Paste a customer message and an AI sorts it, flags urgency, pulls out the key details and drafts a reply for a human to review. Live demo plus the full write-up.',
    tags: ['AI', 'Automation'],
    level: 'Beginner → Intermediate',
    service: { label: 'Quick Win + Tech Checkup', href: '/services/' },
    icon: 'spark', accent: 'cyan', flag: 'Live demo',
  },
  {
    slug: 'receipt-sorter',
    title: 'AI receipt & invoice sorter',
    summary: 'Snap a receipt or upload an invoice and an AI reads the date, vendor, total, tax and category into a form you check. Add payments by hand too, then export a simple ledger to a spreadsheet.',
    tags: ['AI', 'Automation'],
    level: 'Beginner',
    service: { label: 'Quick Win + Tech Checkup', href: '/services/' },
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
