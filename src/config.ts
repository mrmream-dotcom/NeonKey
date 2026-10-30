// Central site config. Values come from env vars at build time (see astro.config.mjs and README).
export type SiteMode = 'demo' | 'live';

export const SITE_MODE: SiteMode = import.meta.env.PUBLIC_SITE_MODE === 'live' ? 'live' : 'demo';
export const IS_LIVE = SITE_MODE === 'live';
export const IS_DEMO = !IS_LIVE;

export const SITE_NAME = 'NeonKey';
export const DEFAULT_DESCRIPTION =
  'NeonKey: unlock tech, whatever your level. AI automation, honest tech picks, hands-on learning and a weekly newsletter.';

// Umami analytics (Umami Cloud). Michael's website ID is the default, so every build includes tracking.
// The ID is public by design (it appears in the page source).
//   PUBLIC_UMAMI_WEBSITE_ID = override the ID; set to "off" to build without analytics.
//   PUBLIC_UMAMI_SRC        = script URL (default https://cloud.umami.is/script.js).
//   PUBLIC_UMAMI_DOMAINS    = comma-separated hostnames the script may report from (Umami's data-domains).
//                             Default "neonkey.tech,www.neonkey.tech": localhost, *.pages.dev and github.io previews load
//                             the script but send nothing, so they don't pollute the stats.
const DEFAULT_UMAMI_WEBSITE_ID = '2c6a467e-392a-4226-b068-fdfc908a48da';
const DEFAULT_UMAMI_DOMAINS = 'neonkey.tech,www.neonkey.tech';
const umamiIdRaw = (import.meta.env.PUBLIC_UMAMI_WEBSITE_ID ?? '').trim();
export const UMAMI = {
  websiteId: /^(off|none|false|0)$/i.test(umamiIdRaw) ? '' : umamiIdRaw || DEFAULT_UMAMI_WEBSITE_ID,
  src: (import.meta.env.PUBLIC_UMAMI_SRC || 'https://cloud.umami.is/script.js').trim(),
  domains: (import.meta.env.PUBLIC_UMAMI_DOMAINS || DEFAULT_UMAMI_DOMAINS).trim(),
};

/** BASE_URL as configured, always ending in "/". */
export const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

/**
 * Base-aware internal URL. Use for every internal link and asset:
 *   url('/lab/')  -> '/lab/' (BASE_PATH=/)  or '/NeonKey/lab/' (BASE_PATH=/NeonKey/)
 * External URLs, anchors and mailto/tel links are returned unchanged.
 */
export function url(path = '/'): string {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(path)) return path;
  return BASE + path.replace(/^\/+/, '');
}

/** Absolute URL (SITE_URL + base + path) for canonical/OG tags. */
export function absoluteUrl(path: string, site: URL | undefined): string {
  return new URL(url(path), site ?? 'https://neonkey.tech').href;
}

// Newsletter: "Unlock the Week" on Kit (formerly ConvertKit). When nothing is configured the form shows a "coming soon" state.
//   PUBLIC_NEWSLETTER_PROVIDER = "kit" (only supported provider)
//   PUBLIC_KIT_FORM_ID         = numeric form ID. The site renders its own form that posts the email
//                                (field "email_address") to https://app.kit.com/forms/<FORM_ID>/subscriptions.
//                                Find it in Kit > Grow > Landing Pages & Forms > your form > Embed > HTML (the form's action URL).
//   PUBLIC_KIT_EMBED_SRC       = alternative: the src of Kit's JavaScript embed, e.g. https://<account>.kit.com/<uid>/index.js
//                                (Embed > JavaScript). Kit then draws its own form. Used only if PUBLIC_KIT_FORM_ID is unset.
//   PUBLIC_KIT_FORM_URL        = optional: override the full form action URL (must be https://app.kit.com/... or app.convertkit.com/...).
const nlProvider = (import.meta.env.PUBLIC_NEWSLETTER_PROVIDER || 'kit').trim().toLowerCase();
// Default: Michael's Kit form "Unlock the Week by NeonKey" (uid 69fa21cf05). Set PUBLIC_KIT_FORM_ID=off to disable.
const kitFormIdRaw = (import.meta.env.PUBLIC_KIT_FORM_ID || '10118914').trim();
const kitFormId = kitFormIdRaw.toLowerCase() === 'off' ? '' : kitFormIdRaw;
const kitFormUrlRaw = (import.meta.env.PUBLIC_KIT_FORM_URL || '').trim();
const kitEmbedSrc = (import.meta.env.PUBLIC_KIT_EMBED_SRC || '').trim();
const KIT_ACTION_RE = /^https:\/\/app\.(kit|convertkit)\.com\/forms\/\d+\/subscriptions\/?$/;
const KIT_EMBED_RE = /^https:\/\/[a-z0-9-]+\.kit\.com\/([a-z0-9]+)\/index\.js$/i;
if (kitFormId && !/^\d+$/.test(kitFormId)) throw new Error(`PUBLIC_KIT_FORM_ID must be numeric (got "${kitFormId}")`);
if (kitFormUrlRaw && !KIT_ACTION_RE.test(kitFormUrlRaw)) throw new Error('PUBLIC_KIT_FORM_URL must look like https://app.kit.com/forms/<FORM_ID>/subscriptions');
if (kitEmbedSrc && !KIT_EMBED_RE.test(kitEmbedSrc)) throw new Error('PUBLIC_KIT_EMBED_SRC must look like https://<account>.kit.com/<uid>/index.js');
const kitFormAction = kitFormUrlRaw || (kitFormId ? `https://app.kit.com/forms/${kitFormId}/subscriptions` : '');
const isKit = nlProvider === 'kit';
export const NEWSLETTER = {
  name: 'Unlock the Week',
  provider: nlProvider,
  mode: (isKit && kitFormAction ? 'form' : isKit && kitEmbedSrc ? 'embed' : 'off') as 'form' | 'embed' | 'off',
  kitFormAction,
  kitEmbedSrc,
  kitEmbedUid: kitEmbedSrc ? (kitEmbedSrc.match(KIT_EMBED_RE)?.[1] ?? '') : '',
};

// Public contact address. Placeholder until the domain and a business inbox exist (see LAUNCH.md).
export const CONTACT_EMAIL = (import.meta.env.PUBLIC_CONTACT_EMAIL || 'hello@neonkey.tech').trim();

// Lab demo: AI inquiry triage. Cloudflare Worker endpoint (source in workers/triage/). Public URL, not a secret.
//   PUBLIC_TRIAGE_API_URL = override, e.g. http://localhost:8787/triage when running `wrangler dev`.
export const TRIAGE_API_URL = (import.meta.env.PUBLIC_TRIAGE_API_URL || 'https://neonkey-triage.mr-mream.workers.dev/triage').trim();

// Service quiz: plan-email Worker endpoint (source in workers/quiz/). Public URL, not a secret.
//   PUBLIC_QUIZ_API_URL = override, e.g. http://localhost:8787/plan when running `wrangler dev`.
export const QUIZ_API_URL = (import.meta.env.PUBLIC_QUIZ_API_URL || 'https://neonkey-quiz.mr-mream.workers.dev/plan').trim();
