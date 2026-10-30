// Made-up sample inquiries for the AI inquiry triage demo (/lab/ai-inquiry-triage/).
// The people, businesses and phone numbers are fictional (555-01xx numbers are reserved for fiction).
export interface TriageSample { id: string; label: string; message: string }

export const triageSamples: TriageSample[] = [
  {
    id: 'bakery',
    label: 'New project request',
    message:
      "Hi! I'm Dana Ortiz and I run Ortiz Family Bakery in Tucson. Custom cake orders come in through Instagram DMs, email and phone, and we keep losing track of them. Could you set up something that collects orders in one place and sends customers a confirmation? Ideally before the holiday rush starts in mid-November. Our budget is around $300. Thanks!",
  },
  {
    id: 'physio',
    label: 'Something is broken',
    message:
      'Hello, this is Sam from Ridgeway Physio. The online booking form on our website stopped sending us notification emails yesterday morning, and two patients said they booked but we never saw it. We have a full clinic tomorrow. Can someone look at this today? Best number is 555-0142.',
  },
  {
    id: 'seo-spam',
    label: 'Spammy pitch',
    message:
      'Dear Website Owner, we GUARANTEE #1 Google ranking and 10,000 high-quality backlinks for only $49!!! Limited time offer, act now. Reply YES to claim your SEO package today. To stop receiving these offers reply STOP.',
  },
];
