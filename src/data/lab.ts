// Lab projects.
// `draft: true` = not published: the card is hidden everywhere (home, /lab/) and the page file lives in
// src/_drafts/lab/ (outside src/pages, so Astro doesn't build it). To publish one, see LAUNCH.md "Hidden drafts".
// The three entries below are sample write-ups, not documented real builds yet, so they stay drafts.
export interface LabProject {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  level: string;
  service?: { label: string; href: string };
  /** Hidden until it's a real, documented build. */
  draft?: boolean;
}

export const labTags = ['Homelab', 'Automation', 'Networking', 'Security', 'AI'];

export const labProjects: LabProject[] = [
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
