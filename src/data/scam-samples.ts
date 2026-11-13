// Practice messages for /learn/is-this-a-scam/. EVERY message here is made up for practice (tagged demo, labeled
// "Sample" in the UI). No real submissions, no real people, no real phone numbers: numbers use the 555-01xx range
// set aside for fiction, and links use made-up domains.
// Each entry: what it looks like, the right call, the tells, and what to do. Wording rule: never tell a reader a
// message is "safe". The most we say is that it fits a normal message, and to go direct if in doubt.

export type ScamSample = {
  id: string;
  channel: 'Text' | 'Email' | 'Pop-up';
  from: string;
  body: string;
  /** 'scam' = the tells add up to a scam. 'normal' = fits a normal message, still checked the direct way. */
  call: 'scam' | 'normal';
  headline: string;
  tells: string[];
  todo: string;
  source: { label: string; href: string };
};

export const scamSamples: ScamSample[] = [
  {
    id: 'package',
    channel: 'Text',
    from: '+1 (555) 010-4471',
    body: 'USPS: Your package is on hold due to an incomplete address. Pay the $1.25 redelivery fee within 24 hours: usps-redeliver-help.top/track',
    call: 'scam',
    headline: 'Scam: a fake delivery text',
    tells: [
      'A tiny fee is the hook. The real goal is your card number.',
      'The link is not usps.com. It just has "usps" in a made-up address.',
      'A 24-hour deadline to stop you from checking.',
    ],
    todo: "Don't tap. If you're expecting a package, type usps.com yourself and enter the tracking number from the seller's email. Forward the text to 7726, then delete it.",
    source: { label: 'US Postal Inspection Service: smishing', href: 'https://www.uspis.gov/news/scam-article/smishing' },
  },
  {
    id: 'grandkid',
    channel: 'Text',
    from: '+1 (555) 010-2290',
    body: "Hi Grandma it's me, I dropped my phone in the lake so this is my new number. I'm in a bit of trouble and need $400 for a bus home. Please don't tell Mom, I'll explain later ❤️",
    call: 'scam',
    headline: 'Scam: a "new number" family emergency',
    tells: [
      'A new number plus an urgent money request.',
      '"Don\'t tell Mom" is there to stop you from checking.',
      'No name. It works on anyone who has a grandchild.',
    ],
    todo: 'Call your grandchild, or their parent, on the number you already have. A family code word settles it in seconds. Never send money to a "new number" first.',
    source: { label: 'FTC: family emergency scams', href: 'https://consumer.ftc.gov/scams/family-emergency-scams' },
  },
  {
    id: 'toll',
    channel: 'Text',
    from: 'tolls-notice@ezpay-roads.info',
    body: 'FINAL NOTICE: You have an unpaid toll balance of $6.99. Pay now to avoid a $50 late fee and suspension of your license: ezpay-roads.info/pay',
    call: 'scam',
    headline: 'Scam: an "unpaid toll" text',
    tells: [
      'Threats about your license over a few dollars.',
      "A web address that isn't your state's toll agency.",
      'It went out to people who never drove on a toll road.',
    ],
    todo: "Don't tap. If you think you might owe a toll, log in to your toll account the way you normally do, or call the number on the agency's own website.",
    source: { label: 'FTC: unpaid toll texts', href: 'https://www.consumer.ftc.gov/consumer-alerts/2025/01/got-text-about-unpaid-tolls-its-probably-scam' },
  },
  {
    id: 'bank-code',
    channel: 'Text',
    from: 'Fraud Dept',
    body: 'First Sample Bank: Did you try a $892.00 purchase at an electronics store? Reply YES or NO. A specialist will call you to verify your identity with the code we just sent.',
    call: 'scam',
    headline: 'Scam: a fake fraud alert that wants your code',
    tells: [
      'The "specialist" call is the scam: they ask you to read back a login code.',
      'A big, scary charge you never made, so you act fast.',
      'Your real bank never needs you to read a code back to them.',
    ],
    todo: "Don't reply and don't share any code. Call the number on the back of your card, or open your bank's app, and ask them if anything is wrong.",
    source: { label: 'FTC: spam text messages', href: 'https://consumer.ftc.gov/articles/how-recognize-and-report-spam-text-messages' },
  },
  {
    id: 'popup',
    channel: 'Pop-up',
    from: 'Windows Security Alert',
    body: '⚠ Your computer is infected with 3 viruses. Your files and banking passwords are at risk. Do NOT close this window. Call Microsoft Support now: (555) 010-0199',
    call: 'scam',
    headline: 'Scam: a fake virus warning with a phone number',
    tells: [
      'Real security warnings from Microsoft or Apple never ask you to call a number.',
      '"Do NOT close this window" is there to keep you on the page.',
      'Big claims with no way to check them.',
    ],
    todo: "Don't call. Close the browser (on Windows, Ctrl + Shift + Esc opens Task Manager if it won't close). Never let a caller connect to your computer.",
    source: { label: 'FTC: tech support scams', href: 'https://consumer.ftc.gov/articles/how-spot-avoid-and-report-tech-support-scams' },
  },
  {
    id: 'code-you-asked-for',
    channel: 'Text',
    from: '55501',
    body: 'Your Sample Shop verification code is 482913. It expires in 10 minutes. Sample Shop will never call or text to ask for this code.',
    call: 'normal',
    headline: 'Fits a normal message, if you just asked for it',
    tells: [
      'No link and nothing to pay.',
      'It warns you never to share the code, which real services do.',
      'The catch: it only fits if you just tried to sign in yourself.',
    ],
    todo: "Use the code only on the site or app you opened yourself, and never read it to anyone. If you didn't just try to sign in, someone may have your password: change it from the official app.",
    source: { label: 'FTC: spam text messages', href: 'https://consumer.ftc.gov/articles/how-recognize-and-report-spam-text-messages' },
  },
];

// Family Shield waitlist (demand test only; nothing is built). Planned price shown as planned, never charged.
// Matches workers/quiz/src/waitlist.js PRODUCTS["family-shield"].
export const familyShield = {
  product: 'family-shield',
  name: 'Family Shield',
  plannedMonthly: 7,
  plannedYearly: 70,
  maxAdults: 5,
  who: [
    { value: 'parents', label: 'My parents or grandparents' },
    { value: 'partner', label: 'My partner or another adult at home' },
    { value: 'adult-kids', label: 'My adult kids' },
    { value: 'friends', label: 'Friends or other family' },
    { value: 'myself', label: 'Just me' },
  ],
};
