// Central site config. Values come from env vars at build time (see astro.config.mjs and README).
export type SiteMode = 'demo' | 'live';

export const SITE_MODE: SiteMode = import.meta.env.PUBLIC_SITE_MODE === 'live' ? 'live' : 'demo';
export const IS_LIVE = SITE_MODE === 'live';
export const IS_DEMO = !IS_LIVE;

export const SITE_NAME = 'NeonKey';
export const DEFAULT_DESCRIPTION =
  'NeonKey: unlock tech, whatever your level. AI automation, honest tech picks, hands-on learning and a weekly newsletter.';

// Umami analytics: the script is only added when PUBLIC_UMAMI_WEBSITE_ID is set.
export const UMAMI = {
  websiteId: (import.meta.env.PUBLIC_UMAMI_WEBSITE_ID || '').trim(),
  src: (import.meta.env.PUBLIC_UMAMI_SRC || 'https://cloud.umami.is/script.js').trim(),
  domains: (import.meta.env.PUBLIC_UMAMI_DOMAINS || '').trim(),
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

// Newsletter: "Unlock the Week" on beehiiv. When nothing is configured the form shows a "coming soon" state.
//   PUBLIC_NEWSLETTER_PROVIDER = "beehiiv" (only supported provider for now)
//   PUBLIC_BEEHIIV_EMBED_ID    = form ID from beehiiv > Subscribers > Subscribe forms > Get embed code
//                                (the part after https://subscribe-forms.beehiiv.com/)
//   PUBLIC_BEEHIIV_FORM_URL    = alternative: your publication's hosted subscribe page URL
//                                (e.g. https://unlock-the-week.beehiiv.com/subscribe). The site form sends people there.
const nlProvider = (import.meta.env.PUBLIC_NEWSLETTER_PROVIDER || '').trim().toLowerCase();
const beehiivEmbedId = (import.meta.env.PUBLIC_BEEHIIV_EMBED_ID || '').trim();
const beehiivFormUrl = (import.meta.env.PUBLIC_BEEHIIV_FORM_URL || '').trim();
export const NEWSLETTER = {
  name: 'Unlock the Week',
  provider: nlProvider,
  mode: (nlProvider === 'beehiiv' && beehiivEmbedId ? 'embed' : nlProvider === 'beehiiv' && beehiivFormUrl ? 'link' : 'off') as 'embed' | 'link' | 'off',
  beehiivEmbedId,
  beehiivFormUrl,
};

// Public contact address. Placeholder until the domain and a business inbox exist (see LAUNCH.md).
export const CONTACT_EMAIL = (import.meta.env.PUBLIC_CONTACT_EMAIL || 'hello@neonkey.tech').trim();
