// Holds back timed Learn guides until their go-live date (src/data/learn-schedule.json).
// After the build: deletes each unpublished guide's folder from dist/ and turns links to it on other pages into
// plain text, so the internal link crawl stays at 0 failures. The hub card and sitemap entry are filtered at
// build time via src/lib/schedule.mjs.
import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unpublishedLearnSlugs, buildDate } from '../src/lib/schedule.mjs';

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

export default function scheduledPages({ base = '/' } = {}) {
  return {
    name: 'neonkey-scheduled-pages',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const slugs = unpublishedLearnSlugs();
        if (!slugs.length) { logger.info(`scheduled pages: none held back (build date ${buildDate()})`); return; }
        const root = fileURLToPath(dir);
        for (const s of slugs) await rm(join(root, 'learn', s), { recursive: true, force: true });
        const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefix = esc(base.replace(/\/?$/, '/'));
        const re = new RegExp(`<a\\b[^>]*href="(?:https://neonkey\\.tech)?${prefix}learn/(?:${slugs.map(esc).join('|')})/?(?:#[^"]*)?"[^>]*>([\\s\\S]*?)</a>`, 'g');
        let changed = 0;
        for (const f of await htmlFiles(root)) {
          const src = await readFile(f, 'utf8');
          const next = src.replace(re, '$1');
          if (next !== src) { await writeFile(f, next); changed++; }
        }
        logger.info(`scheduled pages: held back ${slugs.join(', ')} (build date ${buildDate()}); unlinked them on ${changed} page(s)`);
      },
    },
  };
}
