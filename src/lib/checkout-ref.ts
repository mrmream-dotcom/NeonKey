// Checkout attribution for Stripe Payment Links (docs: 05-conversion-tracking-spec, section 4).
//
// Every buy button gets a Stripe `client_reference_id` at build time, so each Checkout Session can be joined back to
// the lane, the offer (sku) and the spot on the page that sent it:
//   nk1_<lane>_<sku>_<location>            (built here, works with JavaScript off)
//   nk1_<lane>_<sku>_<location>_<src>      (public/js/checkout-attr.js adds the first-touch utm_source, or "direct")
// Stripe accepts only letters, digits, "-" and "_", up to 200 characters, and silently drops anything else, so every
// value is validated here. Never put personal data (names, emails, phone numbers) in it.
//
// Prices are not set here: each sku reads its amount from src/data/services.ts. The Payment Link URLs are not changed
// either; this only adds a query parameter with the URL API, so existing ones (like ?prefilled_promo_code=) survive.
import { emailLockdown, setupGuide, followUpDesk, followUpDeskSale } from '../data/services';

export type Lane = 'founders' | 'smb' | 'family';

/** One entry per sellable checkout. `trial` = the first charge comes after a free trial (nothing is paid at checkout). */
export const SKUS = {
  'email-auth-29': { price: emailLockdown.from, offer: emailLockdown.name, trial: false },
  'founder-stack-29': { price: setupGuide.price, offer: setupGuide.name, trial: false },
  'desk-founding-99m': { price: followUpDeskSale.monthly, offer: `${followUpDesk.name} founding monthly`, trial: true },
  'desk-founding-891y': { price: followUpDeskSale.annualPerYear, offer: `${followUpDesk.name} founding yearly`, trial: false },
  'desk-250m': { price: followUpDesk.from, offer: followUpDesk.name, trial: true },
} as const;
export type Sku = keyof typeof SKUS;

const LANES: readonly Lane[] = ['founders', 'smb', 'family'];
/** Stripe's rule for client_reference_id. */
export const REF_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
/** Our own room for the build-time part, leaving space for "_<src>" (src is at most 20 characters). */
const BUILD_REF_MAX = 170;

/** Lowercase, keep [a-z0-9-] only (underscore is the field separator), trim dashes, cap the length. */
export const slugPart = (s: string, max: number) =>
  String(s).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, max).replace(/-$/, '');

export interface CheckoutTag { lane: Lane; sku: Sku; location: string }

/** The build-time client_reference_id, e.g. nk1_smb_email-auth-29_home-lockdown-strip. Throws on bad input. */
export function checkoutRef({ lane, sku, location }: CheckoutTag): string {
  if (!LANES.includes(lane)) throw new Error(`[checkout-ref] unknown lane "${lane}"`);
  if (!(sku in SKUS)) throw new Error(`[checkout-ref] unknown sku "${sku}"`);
  const loc = slugPart(location, 60) || 'page';
  const ref = `nk1_${lane}_${sku}_${loc}`;
  if (!REF_PATTERN.test(ref) || ref.length > BUILD_REF_MAX) throw new Error(`[checkout-ref] invalid client_reference_id "${ref}"`);
  return ref;
}

/** The Payment Link URL with client_reference_id set. An empty base stays empty (button not live yet). */
export function checkoutUrl(base: string | undefined, tag: CheckoutTag): string {
  if (!base) return '';
  const u = new URL(base);
  if (u.protocol !== 'https:' || u.hostname !== 'buy.stripe.com') throw new Error(`[checkout-ref] not a Stripe Payment Link: ${base}`);
  u.searchParams.set('client_reference_id', checkoutRef(tag));
  return u.toString();
}

/**
 * Attributes for a buy button: spread onto the <a> as {...buyAttrs(url, {...})}. Adds href (with the ref) and the
 * Umami props lane, sku, price and ref next to the existing data-umami-event="buy-click", offer and location.
 */
export function buyAttrs(base: string | undefined, tag: CheckoutTag) {
  return {
    href: checkoutUrl(base, tag),
    'data-umami-event-lane': tag.lane,
    'data-umami-event-sku': tag.sku,
    'data-umami-event-price': String(SKUS[tag.sku].price),
    'data-umami-event-ref': checkoutRef(tag),
  };
}

/** sku -> { price, trial } for public/js/checkout-return.js (passed as a data attribute so prices live in one place). */
export const skuPricesJson = () =>
  JSON.stringify(Object.fromEntries(Object.entries(SKUS).map(([k, v]) => [k, { price: v.price, trial: v.trial }])));
