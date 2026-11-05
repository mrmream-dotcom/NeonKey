// Sample data for the Front Office demo at /lab/front-office/.
// Every business, person and message here is made up. The page can be personalized for a lead with URL
// parameters (see scripts/demo-link.mjs): ?type=home&biz=Acme%20Plumbing&owner=Pat&domain=acmeplumbing.com
// In the text below, {biz}, {owner} and {domain} are replaced with the sample values or the lead's values.

export type InquiryKind = 'faq' | 'route' | 'urgent';

export interface DemoInquiry {
  src: 'Website form' | 'Email' | 'After-hours chat';
  name: string;
  when: string;
  msg: string;
  kind: InquiryKind;
  req: string;
  /** Who it's routed to (route and urgent). */
  to?: string;
  /** FAQ answer given by the assistant (faq). */
  ans?: string;
  /** Draft reply for a person to approve (route). */
  draft?: string;
}

export interface DemoBusinessType {
  key: string;
  label: string;
  /** Sample business used when no lead name is given. */
  biz: string;
  owner: string;
  domain: string;
  what: string;
  team: string;
  rules: string[];
  inquiries: DemoInquiry[];
}

export const demoTypes: DemoBusinessType[] = [
  {
    key: 'home',
    label: 'Home services',
    biz: 'Ridgeline Home Services',
    owner: 'Dana',
    domain: 'ridgelinehome.com',
    what: 'a repair and remodeling crew',
    team: '{owner} (owner), Sam (office), field crew',
    rules: [
      'Questions about hours, service area and payment are answered from your FAQ',
      'Repair requests go to Sam in the office',
      'Estimate requests go to {owner}',
      'Anything about gas, smoke, flooding or no heat skips the workflow and alerts {owner} right away',
      'Templates never quote prices or promise a time slot',
    ],
    inquiries: [
      { src: 'After-hours chat', name: 'Riley T.', when: 'Mon 9:14 PM', msg: 'Do you work on Saturdays?', kind: 'faq', req: 'Hours question', ans: 'Yes, Saturdays 9 AM to 1 PM for booked jobs. Want someone to reach out to book?' },
      { src: 'Website form', name: 'Morgan L.', when: 'Tue 7:42 AM', msg: 'Looking for a quote to replace two bathroom fans. Do you do free estimates?', kind: 'route', req: 'Estimate: bathroom fans', to: '{owner} (owner)', draft: 'Hi Morgan,\n\nThanks for reaching out to {biz}. Yes, we can take a look at the two bathroom fans and give you a written estimate.\n\nWhat days this week work best for a quick visit? Mornings or afternoons?\n\nThanks,\n{owner}\n{biz}' },
      { src: 'Email', name: 'Chris P.', when: 'Tue 10:05 AM', msg: 'Our kitchen sink is leaking under the cabinet. Can someone come look this week?', kind: 'route', req: 'Repair: sink leak', to: 'Sam (office)', draft: 'Hi Chris,\n\nThanks for letting us know about the leak. Sam here from {biz}. Until we get there, it helps to close the shutoff valve under the sink and keep a towel or bucket underneath.\n\nCan you reply with a good phone number and two times that work this week?\n\nThanks,\nSam\n{biz}' },
      { src: 'Website form', name: 'Jordan K.', when: 'Tue 6:31 PM', msg: 'Our furnace stopped working and the house is getting cold.', kind: 'urgent', req: 'No heat', to: '{owner} (owner)' },
    ],
  },
  {
    key: 'office',
    label: 'Professional office',
    biz: 'Northbank Bookkeeping',
    owner: 'Alex',
    domain: 'northbankbooks.com',
    what: 'a small bookkeeping firm',
    team: '{owner} (owner), Priya (client manager)',
    rules: [
      'Questions about services, hours and onboarding are answered from your FAQ',
      'New client inquiries go to {owner}',
      'Existing client requests go to Priya',
      'Tax or legal questions are never answered by the assistant and go to {owner}',
      'Templates never quote fees before a consult',
    ],
    inquiries: [
      { src: 'After-hours chat', name: 'Sam R.', when: 'Sun 8:02 PM', msg: 'Do you handle payroll too, or just bookkeeping?', kind: 'faq', req: 'Services question', ans: 'We do monthly bookkeeping and payroll setup. Want someone to follow up about your business?' },
      { src: 'Website form', name: 'Taylor M.', when: 'Mon 8:15 AM', msg: 'I run a small landscaping company and my books are a mess. Can you help monthly?', kind: 'route', req: 'New client: monthly books', to: '{owner} (owner)', draft: 'Hi Taylor,\n\nThanks for reaching out to {biz}. Messy books are a normal place to start.\n\nWould a 20-minute call this week work to go over what you use today and what you need each month? Reply with a couple of times that suit you.\n\nBest,\n{owner}\n{biz}' },
      { src: 'Email', name: 'Jamie W.', when: 'Mon 11:40 AM', msg: "Could you resend last month's statement? I can't find it.", kind: 'route', req: 'Client: resend statement', to: 'Priya (client manager)', draft: "Hi Jamie,\n\nNo problem. Priya here. I'll resend last month's statement today to this address.\n\nIf you'd like it sent anywhere else too, just reply with the address.\n\nThanks,\nPriya\n{biz}" },
      { src: 'Website form', name: 'Casey D.', when: 'Mon 4:55 PM', msg: "I got a letter from the IRS today and I'm not sure what it means.", kind: 'urgent', req: 'IRS letter', to: '{owner} (owner)' },
    ],
  },
  {
    key: 'salon',
    label: 'Salon or studio',
    biz: 'Studio Aster',
    owner: 'Lee',
    domain: 'studioaster.com',
    what: 'a small salon',
    team: '{owner} (owner), front desk',
    rules: [
      'Questions about hours, parking and gift cards are answered from your FAQ',
      'Booking requests go to the front desk',
      'Group or event bookings go to {owner}',
      'Complaints go straight to {owner}, with no automatic reply',
      'Templates never promise a specific stylist or time until confirmed',
    ],
    inquiries: [
      { src: 'After-hours chat', name: 'Avery N.', when: 'Thu 10:20 PM', msg: 'Do you sell gift cards?', kind: 'faq', req: 'Gift card question', ans: 'Yes, gift cards are available at the front desk in any amount. Want someone to follow up?' },
      { src: 'Website form', name: 'Quinn H.', when: 'Fri 9:00 AM', msg: 'Looking to book hair and makeup for a wedding party of 5 in June.', kind: 'route', req: 'Event booking: party of 5', to: '{owner} (owner)', draft: "Hi Quinn,\n\nCongratulations, and thanks for thinking of {biz}! We'd love to help with your wedding party.\n\nCould you share the date, start time and what each person would like done? Then I'll put together options for you.\n\nThanks,\n{owner}\n{biz}" },
      { src: 'Email', name: 'Drew S.', when: 'Fri 12:15 PM', msg: 'Can I get a cut and color sometime next week?', kind: 'route', req: 'Booking: cut and color', to: 'Front desk', draft: "Hi Drew,\n\nThanks for reaching out! We'd be happy to get you in for a cut and color next week.\n\nWhich days and times work best for you? We'll confirm a stylist and time once we hear back.\n\nThanks,\n{biz} front desk" },
      { src: 'Website form', name: 'Robin F.', when: 'Fri 5:40 PM', msg: "I'm not happy with my color from Tuesday.", kind: 'urgent', req: 'Complaint', to: '{owner} (owner)' },
    ],
  },
  {
    key: 'shop',
    label: 'Local shop',
    biz: 'Copper Kettle Kitchen Supply',
    owner: 'Pat',
    domain: 'copperkettlesupply.com',
    what: 'a kitchen store',
    team: '{owner} (owner), shop staff',
    rules: [
      'Questions about hours, returns and parking are answered from your FAQ',
      'Stock questions go to shop staff',
      'Wholesale and bulk orders go to {owner}',
      'Anything about a damaged or unsafe product goes straight to {owner}',
      'Templates never promise stock until someone checks',
    ],
    inquiries: [
      { src: 'After-hours chat', name: 'Kim B.', when: 'Sat 9:48 PM', msg: "What's your return policy?", kind: 'faq', req: 'Returns question', ans: 'Unused items can be returned within 30 days with a receipt. Want someone to follow up?' },
      { src: 'Website form', name: 'Rowan G.', when: 'Mon 8:30 AM', msg: 'I run a small café and want to order 40 mugs in bulk. Do you do wholesale?', kind: 'route', req: 'Wholesale: 40 mugs', to: '{owner} (owner)', draft: "Hi Rowan,\n\nThanks for reaching out to {biz}. We do take bulk orders for local businesses.\n\nWhich mug are you looking at, and when would you need them? I'll check stock and get back to you with options.\n\nThanks,\n{owner}\n{biz}" },
      { src: 'Email', name: 'Ellis V.', when: 'Mon 1:10 PM', msg: 'Do you have the 10-inch cast iron pan in stock?', kind: 'route', req: 'Stock check: cast iron', to: 'Shop staff', draft: "Hi Ellis,\n\nThanks for asking! We'll check the shelf and reply today to confirm whether the 10-inch cast iron pan is in stock.\n\nWould you like us to hold one for you if it is?\n\nThanks,\n{biz}" },
      { src: 'Email', name: 'Harper C.', when: 'Mon 3:25 PM', msg: 'The kettle I bought last week is sparking when I plug it in.', kind: 'urgent', req: 'Unsafe product', to: '{owner} (owner)' },
    ],
  },
];

/** The four follow-up touches shown in step 3. */
export const followUpSteps = [
  { d: 0, h: 'First reply', p: 'You approve and send the reply.' },
  { d: 1, h: 'Next-day check-in', p: "A short note if they haven't answered." },
  { d: 3, h: 'Day 3 follow-up', p: 'A friendly nudge with one clear question.' },
  { d: 7, h: 'Final check-in', p: 'A polite last note, then the lead is closed.' },
];
