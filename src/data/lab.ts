// Lab projects: sample write-ups for the demo site.
// These are placeholders until real builds are documented. Keep every entry marked as demo.
export interface LabProject {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  level: string;
  service?: { label: string; href: string };
}

export const labTags = ['Homelab', 'Automation', 'Networking', 'Security', 'AI'];

export const labProjects: LabProject[] = [
  {
    slug: 'n8n-lead-intake-automation',
    title: 'Lead intake automation with self-hosted n8n',
    summary: 'A web form that lands in a sheet, emails the right person and sends a polite auto-reply, all running on a home n8n box.',
    tags: ['Automation', 'Homelab'],
    level: 'Beginner → Intermediate',
    service: { label: 'Lead-Routing & Follow-Up System', href: '/services/' },
  },
  {
    slug: 'homelab-network-segmentation',
    title: 'Segmenting a home network with VLANs',
    summary: 'Separate networks for IoT gadgets, guests and lab gear on a prosumer router and a mini PC, so one weak device can\'t see everything.',
    tags: ['Networking', 'Security', 'Homelab'],
    level: 'Intermediate',
  },
  {
    slug: 'ai-faq-assistant-small-business',
    title: 'AI FAQ assistant for a (fictional) small business',
    summary: 'A simple assistant that answers common questions from a short FAQ document and hands off to a human when it isn\'t sure.',
    tags: ['AI', 'Automation'],
    level: 'Beginner → Intermediate',
    service: { label: 'AI Intake & FAQ Assistant', href: '/services/' },
  },
];
