// Family Shield free check: a rules-based read on a message someone pasted (Nov 13 2026).
// Runs entirely in the visitor's browser. The text is never sent, stored or logged anywhere; only the verdict and the
// tell ids go to Umami. No AI: the paid family plan adds an AI second opinion later (docs/family-shield/README.md).
//
// Wording rules (docs/family-shield/README.md section 8): three outcomes only, never "safe", never a percentage,
// every result ends with what to do and says it is advice, not a promise.

/** Brands that scammers put inside look-alike web addresses, with the real domains they own. */
const BRANDS = {
  usps: ["usps.com"], ups: ["ups.com"], fedex: ["fedex.com"], dhl: ["dhl.com"],
  amazon: ["amazon.com"], paypal: ["paypal.com"], apple: ["apple.com", "icloud.com"],
  microsoft: ["microsoft.com", "live.com", "office.com"], netflix: ["netflix.com"],
  chase: ["chase.com"], wellsfargo: ["wellsfargo.com"], bankofamerica: ["bankofamerica.com"],
  irs: ["irs.gov"], ezpass: ["e-zpassny.com", "ezpassnj.com", "e-zpassiag.com"], sunpass: ["sunpass.com"],
  fastrak: ["bayareafastrak.org"], venmo: ["venmo.com"], zelle: ["zellepay.com"], coinbase: ["coinbase.com"],
  facebook: ["facebook.com"], instagram: ["instagram.com"], google: ["google.com"], walmart: ["walmart.com"],
  costco: ["costco.com"], verizon: ["verizon.com"], att: ["att.com"], tmobile: ["t-mobile.com"],
};
const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy", "t.ly", "tiny.cc"];
const ODD_TLDS = ["top", "xyz", "click", "icu", "buzz", "rest", "cfd", "sbs", "live", "shop", "info", "online", "site", "vip", "win", "loan", "work", "support", "help", "cc", "ru", "cn", "tk", "ml", "ga", "cf", "gq", "pw", "lol", "mom", "bond", "cyou"];

/**
 * Each tell: id, weight (3 strong, 2 medium, 1 weak), a test, and what we tell the reader.
 * Weights are judgment calls from the FTC and USPIS patterns used on the practice page, not measured rates.
 */
const TELLS = [
  { id: "pay-odd", w: 3, re: /\b(gift ?cards?|itunes card|google play card|steam card|bitcoin|crypto(currency)?|usdt|wire (transfer|the money)|western union|moneygram|bitcoin atm)\b/i,
    say: "It asks for gift cards, crypto or a wire transfer. Real companies and agencies don't take payment that way." },
  { id: "code", w: 3, re: /\b(read|send|give|tell|share|forward)\b[^.!?\n]{0,40}\b(code|passcode|pin|one[- ]time)\b|\b(code|pin)\b[^.!?\n]{0,40}\b(read it back|to verify you|to confirm (it'?s|it is) you)\b|\b(verify|confirm|identify) (you|your identity) (with|using) the code\b/i,
    say: "It asks you to share a code. A code is a key to your account; nobody real asks you to read one back." },
  { id: "login", w: 2, re: /\b(verify|confirm|update|validate|unlock|restore)\b[^.!?\n]{0,30}\b(account|identity|login|log-in|password|billing|payment (info|details|method)|card details)\b|\b(social security number|ssn)\b/i,
    say: "It asks you to confirm your account, password or card details." },
  { id: "urgent", w: 2, re: /\b(urgent|immediately|right away|act now|final (notice|warning|reminder)|last (chance|notice)|within (\d+|twenty[- ]four|24|48) ?(hours?|hrs?|minutes?|mins?)|today only|expires? (today|soon)|suspended|will be (suspended|closed|locked|deactivated|cancel+ed)|locked|deactivat\w*)\b/i,
    say: "It rushes you with a deadline or a threat. Pressure is there to stop you from checking." },
  { id: "threat", w: 2, re: /\b(late fee|penalt(y|ies)|arrest|warrant|legal action|lawsuit|license (suspension|suspended)|police|collections?|court)\b/i,
    say: "It threatens a fee, legal trouble or losing something. Real agencies send letters and give you time." },
  { id: "secret", w: 3, re: /\b(don'?t|do not|please don'?t) (tell|call|mention|say anything to)\b|\bkeep (this|it) (between us|secret|quiet)\b/i,
    say: "It asks you to keep it secret. Secrecy is there to stop the one call that would end the scam." },
  { id: "new-number", w: 2, re: /\b(new (phone )?number|(lost|broke|dropped|cracked) my (old )?phone|this is my new)\b/i,
    say: "Someone says they have a new number. Check by calling the number you already have for them." },
  { id: "family-money", w: 2, re: /\b(hi|hey|hello) (mom|mum|dad|grandma|grandpa|nana|papa|auntie?|uncle)\b|\b(in (a bit of )?trouble|bail|stuck at|need money for|send (me )?money)\b/i,
    say: "It's a family member asking for money out of the blue. Call them on the number you already have, or ask your family code word." },
  { id: "small-fee", w: 2, re: /\b(re-?delivery|redeliver|shipping|customs|handling|processing|unpaid|toll|outstanding) (fee|balance|charge|toll)\b|\$\s?[0-4]\.\d{2}\b/i,
    say: "A small fee is the hook. The real goal is your card number." },
  { id: "package", w: 1, re: /\b(package|parcel|shipment|delivery)\b[^.!?\n]{0,40}\b(on hold|held|failed|could not be delivered|incomplete address|address (issue|problem))\b/i,
    say: "It says a delivery is stuck. Track it on the carrier's own site with the number from the seller, not from a text." },
  { id: "toll", w: 1, re: /\b(unpaid|outstanding|overdue) tolls?\b|\btoll (balance|notice|violation)\b/i,
    say: "Unpaid-toll texts are a common scam right now. Log in to your toll account the usual way instead." },
  { id: "prize", w: 2, re: /\b(you('ve| have)? won|winner|you('ve| have) been selected|claim (your|the) (prize|reward|gift)|free (gift|iphone|vacation)|lottery|sweepstakes|congratulations)\b/i,
    say: "It says you won something you didn't enter. Real prizes don't ask you to pay or log in to claim them." },
  { id: "tech-support", w: 3, re: /\b(call|contact) (microsoft|apple|windows|amazon|geek squad|tech|norton|mcafee) (support|help|security)\b|\b(virus(es)?|infected|malware|hacked|compromised)\b[^.!?\n]{0,60}\b(call|phone|contact)\b/i,
    say: "It says to call a support number about your device. Real security warnings never ask you to call." },
  { id: "infected", w: 2, re: /\b(infected|virus(es)? (detected|found)|your (computer|device|phone|pc|mac) (is|has been) (infected|hacked|compromised|locked))\b|\bdo not (close|turn off|restart|shut down)\b/i,
    say: "It says your device is infected or tells you not to close the window. That's a scare tactic to keep you stuck." },
  { id: "fraud-alert", w: 2, re: /\b(did you (try|make|attempt|authorize)|was this you)\b[^.!?\n]{0,40}\b(purchase|charge|transaction|payment|transfer|login|sign[- ]in)\b|\b(specialist|agent|representative|fraud (team|department)) will (call|contact)\b/i,
    say: "It's a \"fraud alert\" that wants you to reply or take a call. Call the number on the back of your card instead." },
  { id: "remote", w: 3, re: /\b(anydesk|teamviewer|ultraviewer|remote (access|desktop|support|control)|screen ?share)\b/i,
    say: "It asks for remote access to your device. Only allow that for someone you contacted yourself." },
  { id: "refund", w: 2, re: /\b(refund|overpa(id|yment)|reimburse(ment)?|tax return)\b[^.!?\n]{0,40}\b(click|claim|verify|confirm|process|send)\b/i,
    say: "It offers a refund or says you were overpaid. That's a common way to get you to send money back." },
  { id: "job", w: 2, re: /\b(work from home|remote job|earn \$?\d+|per day|daily pay|easy money|part[- ]time (job|position))\b[^.!?\n]{0,60}\b(whatsapp|telegram|text|reply|signal)\b|\b(job|position) offer\b[^.!?\n]{0,40}\b(whatsapp|telegram)\b/i,
    say: "It's a job offer you didn't apply for that moves you to WhatsApp or Telegram." },
  { id: "reply-yes", w: 1, re: /\breply (yes|no|y|n|stop|1|2)\b/i,
    say: "It asks you to reply. Replying tells scammers your number is real; check the direct way instead." },
];

const URL_RE = /\b((?:https?:\/\/)?(?:www\.)?((?:[a-z0-9-]+\.)+[a-z]{2,}|\d{1,3}(?:\.\d{1,3}){3}))(?::\d+)?(\/[^\s<>"')\]]*)?/gi;

/** Pull web addresses out of the text (with or without http). Skips email addresses. */
export function findLinks(text) {
  const out = [];
  const seen = new Set();
  for (const m of String(text).matchAll(URL_RE)) {
    const before = text[m.index - 1];
    if (before === "@") continue; // part of an email address
    const host = m[2].toLowerCase().replace(/^www\./, "");
    if (!/[a-z]/.test(host.split(".").pop()) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) continue;
    if (/^\d+\.\d+$/.test(host)) continue; // "1.25" is a price, not a link
    if (seen.has(host)) continue;
    seen.add(host);
    out.push(host);
  }
  return out;
}

function registrable(host) {
  const parts = host.split(".");
  return parts.slice(-2).join(".");
}

/** Link problems for one host. Returns tell objects (same shape as TELLS results). */
export function linkTells(host) {
  const tells = [];
  const tld = host.split(".").pop();
  const base = registrable(host);
  const flat = host.replace(/[^a-z0-9]/g, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) tells.push({ id: "link-ip", w: 3, say: `The link (${host}) is a bare number, not a company's web address.` });
  if (host.includes("xn--")) tells.push({ id: "link-punycode", w: 3, say: `The link (${host}) uses look-alike letters to copy a real address.` });
  if (SHORTENERS.includes(base) || SHORTENERS.includes(host)) tells.push({ id: "link-short", w: 2, say: `The link (${host}) is a shortened link that hides where it really goes.` });
  for (const [brand, real] of Object.entries(BRANDS)) {
    if (!flat.includes(brand)) continue;
    const owned = real.some((r) => host === r || host.endsWith("." + r));
    if (!owned && brand.length >= 3) {
      tells.push({ id: "link-lookalike", w: 3, say: `The link (${host}) has "${brand}" in it but isn't ${real.length === 1 ? real[0] : "one of its real web addresses"}. That's a classic look-alike.` });
      break;
    }
  }
  if (ODD_TLDS.includes(tld) && !tells.some((t) => t.id === "link-lookalike")) tells.push({ id: "link-odd-ending", w: 2, say: `The link (${host}) ends in .${tld}, an ending scammers use a lot. Not proof on its own.` });
  if ((host.match(/-/g) || []).length >= 2) tells.push({ id: "link-hyphens", w: 1, say: `The link (${host}) strings words together with dashes, a common look-alike trick.` });
  return tells;
}

/** True when a host is one of the real brand domains above (e.g. docs.google.com). */
function isKnownHost(host) {
  return Object.values(BRANDS).some((real) => real.some((r) => host === r || host.endsWith("." + r)));
}

export const VERDICTS = {
  scam: "Looks like a scam",
  unsure: "Can't tell, check it the direct way",
  normal: "Fits a normal message, still go direct if money or a login is involved",
};

const MONEY_OR_LOGIN = /\b(pay|payment|fee|\$\d|card|bank|account|login|log in|sign in|password|code|verify|money|transfer|refund|invoice|bill)\b/i;

/**
 * Check a pasted message. Returns { verdict, label, score, tells: [{id, say}], links, todo, empty }.
 * Pure function: no network, no storage.
 */
export function checkMessage(input) {
  const text = String(input || "").slice(0, 8000);
  if (text.trim().length < 8) return { empty: true, verdict: "", label: "", score: 0, tells: [], links: [], todo: "" };
  const found = [];
  for (const t of TELLS) if (t.re.test(text)) found.push({ id: t.id, w: t.w, say: t.say });
  const links = findLinks(text);
  for (const h of links.slice(0, 5)) for (const lt of linkTells(h)) if (!found.some((f) => f.id === lt.id)) found.push(lt);
  // A link plus a request for money, a login or a code is the core phishing pattern.
  const asks = found.some((f) => ["login", "small-fee", "pay-odd", "code", "refund"].includes(f.id));
  if (found.some((f) => f.id === "new-number") && /\b(send|need|borrow|lend|wire|transfer)\b[^.!?\n]{0,30}(\$\s?\d|money|cash|funds)/i.test(text))
    found.push({ id: "new-number-money", w: 2, say: "A \"new number\" plus a money request is the most common family scam. Call them on the number you already have before sending anything." });
  if (links.length && asks) found.push({ id: "link-plus-ask", w: 2, say: "It pairs a link with a request for money, a login or a code. Go to the company's site yourself instead of tapping." });

  const score = found.reduce((s, f) => s + f.w, 0);
  const strong = found.filter((f) => f.w >= 3).length;
  let verdict;
  if (score >= 6 || strong >= 2 || (strong >= 1 && score >= 5)) verdict = "scam";
  else if (score >= 2 || links.some((h) => !isKnownHost(h))) verdict = "unsure";
  else verdict = "normal";

  const money = MONEY_OR_LOGIN.test(text);
  const todo =
    verdict === "scam"
      ? "Don't tap, reply or call back. If it names a company you use, open its app or type its website yourself. Forward scam texts to 7726, then delete them. Already paid or shared a code? See the steps below."
      : verdict === "unsure"
        ? "Don't use the link or number in the message. Check it the direct way: open the company's app, type its website yourself, or call a number you find yourself. For a family member, call the number you already have."
        : money
          ? "Nothing obvious stood out, but it mentions money or an account. Check it the direct way before you act: the official app, or a number you find yourself."
          : "Nothing obvious stood out. If you weren't expecting it, or it starts asking for money, a code or a login later, check it the direct way.";
  return { empty: false, verdict, label: VERDICTS[verdict], score, tells: found.map(({ id, say }) => ({ id, say })), links, todo };
}
