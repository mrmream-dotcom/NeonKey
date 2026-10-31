// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import externalLinks from './integrations/external-links.mjs';
import { articles, ARTICLE_CATEGORIES } from './src/data/articles.ts';

// Build modes are driven by environment variables (see README "Build modes"):
//   SITE_URL          absolute origin used for canonical URLs, OG tags and the sitemap (default https://neonkey.tech)
//   BASE_PATH         path the site is served from, e.g. "/" or "/NeonKey/" for GitHub Pages (default "/")
//   PUBLIC_SITE_MODE  "demo" (noindex + robots Disallow, default) or "live" (indexable). No visible banner in either mode
const SITE_URL = (process.env.SITE_URL || 'https://neonkey.tech').replace(/\/+$/, '');
const rawBase = process.env.BASE_PATH || '/';
const BASE_PATH = ('/' + rawBase.replace(/^\/+|\/+$/g, '') + '/').replace(/\/+/g, '/');
// Article category pages with no posts yet are noindex (see ArticleIndex.astro), so keep them out of the sitemap too.
const EMPTY_ARTICLE_CATEGORIES = ARTICLE_CATEGORIES.filter((c) => !articles.some((a) => a.category === c));
const emptyCategoryRe = EMPTY_ARTICLE_CATEGORIES.length ? new RegExp(`/articles/(${EMPTY_ARTICLE_CATEGORIES.join('|')})/?$`) : null;
// Draft pages built for review that must stay out of the sitemap (they also set noindex and are hidden from lists).
const DRAFT_PAGES = ['/lab/receipt-sorter'];
const isDraftPage = (page) => { const p = new URL(page).pathname.replace(/\/$/, ''); return DRAFT_PAGES.some((d) => p.endsWith(d)); };
const MODE = process.env.PUBLIC_SITE_MODE === 'live' ? 'live' : 'demo';

export default defineConfig({
  output: 'static',
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'never' },
  vite: { build: { assetsInlineLimit: 0 } },
  // The sitemap is generated in both modes; in demo mode robots.txt still disallows crawling.
  integrations: [mdx(), externalLinks({ hosts: ['neonkey.tech', 'www.neonkey.tech', new URL(SITE_URL).hostname] }), sitemap({ filter: (page) => !/\/(404|newsletter\/(thanks|welcome)|contact\/thanks)\/?$/.test(page) && !/\/notes(\/|$)/.test(page) && !(emptyCategoryRe && emptyCategoryRe.test(page)) && !isDraftPage(page) })],
});

console.log(`[neonkey] mode=${MODE} site=${SITE_URL} base=${BASE_PATH}`);
