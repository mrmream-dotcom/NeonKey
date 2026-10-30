// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Build modes are driven by environment variables (see README "Build modes"):
//   SITE_URL          absolute origin used for canonical URLs, OG tags and the sitemap (default https://neonkey.tech)
//   BASE_PATH         path the site is served from, e.g. "/" or "/NeonKey/" for GitHub Pages (default "/")
//   PUBLIC_SITE_MODE  "demo" (noindex + robots Disallow, default) or "live" (indexable). No visible banner in either mode
const SITE_URL = (process.env.SITE_URL || 'https://neonkey.tech').replace(/\/+$/, '');
const rawBase = process.env.BASE_PATH || '/';
const BASE_PATH = ('/' + rawBase.replace(/^\/+|\/+$/g, '') + '/').replace(/\/+/g, '/');
const MODE = process.env.PUBLIC_SITE_MODE === 'live' ? 'live' : 'demo';

export default defineConfig({
  output: 'static',
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 } },
  // The sitemap is generated in both modes; in demo mode robots.txt still disallows crawling.
  integrations: [sitemap({ filter: (page) => !/\/(404|newsletter\/(thanks|welcome)|contact\/thanks)\/?$/.test(page) })],
});

console.log(`[neonkey] mode=${MODE} site=${SITE_URL} base=${BASE_PATH}`);
