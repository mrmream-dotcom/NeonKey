#!/usr/bin/env node
// Pre-publish regression checks for a fresh build, compared with what is live on gh-pages.
// Mirrors docs/deploy-checklist.md step 6, but runs on dist/ BEFORE publishing so a failure never reaches visitors.
//
// Usage: node scripts/release-checks.mjs <new-dist-dir> <current-gh-pages-dir>
// Exits 1 and prints every failure if any check fails.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const [distDir = 'dist', liveDir] = process.argv.slice(2);
if (!liveDir) { console.error('usage: release-checks.mjs <dist> <gh-pages checkout>'); process.exit(2); }

const failures = [];
const fail = (m) => failures.push(m);
const read = (p) => readFileSync(p, 'utf8');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name === '.git' ? [] : e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const pages = walk(distDir).filter((f) => f.endsWith('.html'));
const isRedirect = (html) => /http-equiv="refresh"/.test(html);
const count = (s, needle) => s.split(needle).length - 1;

// 0. CNAME and .nojekyll
if (!existsSync(join(distDir, 'CNAME')) || read(join(distDir, 'CNAME')).trim() !== 'neonkey.tech') fail('dist/CNAME missing or not neonkey.tech');
if (!existsSync(join(distDir, '.nojekyll'))) fail('dist/.nojekyll missing');

// 1. Internal links: every href/src to a local path resolves to a file in dist.
let links = 0;
for (const f of pages) {
  for (const [, h] of read(f).matchAll(/(?:href|src)="([^"#?]*)/g)) {
    if (!h || /^(https?:|mailto:|tel:|data:|\/\/|javascript:)/.test(h)) continue;
    if (!h.startsWith('/')) continue;
    links++;
    const p = join(distDir, h);
    const ok = (existsSync(p) && statSync(p).isFile()) || existsSync(join(p, 'index.html'));
    if (!ok) fail(`broken internal link ${h} on ${relative(distDir, f)}`);
  }
}

// 2-3. Umami script once and the Google tag loader once on every real page (redirect stubs excluded).
for (const f of pages) {
  const html = read(f);
  if (isRedirect(html)) continue;
  const rel = relative(distDir, f);
  if (count(html, 'cloud.umami.is/script.js') !== 1) fail(`Umami script not exactly once on ${rel}`);
  if (count(html, 'googletagmanager.com/gtag/js') !== 1) fail(`Google tag loader not exactly once on ${rel}`);
  if (!html.includes('AW-18547389944')) fail(`Google Ads id AW-18547389944 missing on ${rel}`);
}

// 4. Impact meta tag unchanged on the home page.
const impact = (dir) => (read(join(dir, 'index.html')).match(/<meta name="impact-site-verification"[^>]*>/) || [''])[0];
if (!impact(distDir) || impact(distDir) !== impact(liveDir)) fail('Impact meta tag missing or changed on the home page');

// 5. Form markup unchanged on contact, newsletter, quiz and free-kit pages.
const forms = (dir, page) => { const p = join(dir, page, 'index.html'); return existsSync(p) ? (read(p).match(/<form[\s\S]*?<\/form>/g) || []).join('\n') : null; };
for (const page of ['contact', 'newsletter', 'services/quiz', 'free-it-kit']) {
  const a = forms(distDir, page), b = forms(liveDir, page);
  if (a === null) fail(`/${page}/ missing from the build`);
  else if (b !== null && a !== b) fail(`form markup changed on /${page}/`);
}

// 6. /newsletter/thanks/ still loads its conversion script.
const thanks = join(distDir, 'newsletter', 'thanks', 'index.html');
if (!existsSync(thanks) || !read(thanks).includes('conv-newsletter.js')) fail('/newsletter/thanks/ no longer loads conv-newsletter.js');

console.log(`release checks: ${pages.length} pages, ${links} internal links, ${failures.length} failure(s)`);
if (failures.length) { for (const m of failures) console.log(`::error::${m}`); process.exit(1); }
