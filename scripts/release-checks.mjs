#!/usr/bin/env node
// Pre-publish regression checks for a fresh build, compared with what is live on gh-pages.
// Mirrors docs/deploy-checklist.md step 6, but runs on dist/ BEFORE publishing so a failure never reaches visitors.
//
// Usage: node scripts/release-checks.mjs <new-dist-dir> <current-gh-pages-dir>
// Exits 1 and prints every failure if any check fails.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

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
const approvedPath = new URL('./approved-form-changes.json', import.meta.url);
const approvedForms = existsSync(approvedPath) ? JSON.parse(read(approvedPath)) : {};
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const forms = (dir, page) => { const p = join(dir, page, 'index.html'); return existsSync(p) ? (read(p).match(/<form[\s\S]*?<\/form>/g) || []).join('\n') : null; };
for (const page of ['contact', 'newsletter', 'services/quiz', 'free-it-kit']) {
  const a = forms(distDir, page), b = forms(liveDir, page);
  if (a === null) fail(`/${page}/ missing from the build`);
  else if (b !== null && a !== b) {
    // An intended change passes only if this exact new markup was approved (sha256 pinned in approved-form-changes.json).
    if (approvedForms[page] && approvedForms[page] === sha256(a)) console.log(`approved form change on /${page}/ (${approvedForms[page].slice(0, 12)})`);
    else fail(`form markup changed on /${page}/ (new sha256 ${sha256(a)})`);
  }
}

// 6. /newsletter/thanks/ still loads its conversion script.
const thanks = join(distDir, 'newsletter', 'thanks', 'index.html');
if (!existsSync(thanks) || !read(thanks).includes('conv-newsletter.js')) fail('/newsletter/thanks/ no longer loads conv-newsletter.js');
// 6b. /contact/thanks/ still loads its confirmed-inquiry script (audit Nov 7 2026, A5).
const contactThanks = join(distDir, 'contact', 'thanks', 'index.html');
if (!existsSync(contactThanks) || !read(contactThanks).includes('conv-contact.js')) fail('/contact/thanks/ no longer loads conv-contact.js');

// 7. Paid products never ship on the site. The Founder Stack PDF is delivered only by email from private KV.
for (const f of walk(distDir)) if (/founder-stack.*\.pdf$|the-founder-stack/i.test(relative(distDir, f))) fail(`paid product file in the build: ${relative(distDir, f)}`);

// 8. Experiments (growth directive, Nov 12 2026): every live A/B test has a registry entry with a hypothesis, metric,
// guardrails and a minimum sample, and no price or offer test goes live without Michael's written OK. docs/experiments.md.
{
  const reg = JSON.parse(read(new URL('../src/data/experiments.json', import.meta.url))).experiments;
  const abIds = [...read(new URL('../src/data/ab-tests.ts', import.meta.url)).matchAll(/^\s*id: '([\w-]+)'/gm)].map((m) => m[1]);
  for (const id of abIds) {
    const e = reg.find((x) => x.id === id);
    if (!e) { fail(`A/B test "${id}" has no entry in src/data/experiments.json`); continue; }
    if (e.status !== 'live') fail(`A/B test "${id}" is running but experiments.json says ${e.status}`);
  }
  for (const e of reg) {
    for (const k of ['hypothesis', 'primaryMetric', 'baseline', 'readOn']) if (!e[k]) fail(`experiment "${e.id}" is missing ${k}`);
    if (!Array.isArray(e.guardrails) || !e.guardrails.length) fail(`experiment "${e.id}" has no guardrails`);
    if (!(e.minPerArm >= 100)) fail(`experiment "${e.id}" needs minPerArm of at least 100`);
    if (e.status === 'live' && !abIds.includes(e.id)) fail(`experiment "${e.id}" is marked live but not in ab-tests.ts`);
    if (e.status === 'live' && ['price', 'offer'].includes(e.kind) && !e.ownerOk) fail(`price/offer experiment "${e.id}" is live without Michael's OK`);
  }
}

// 9. Checkout integrity (B2B workstream, Nov 13 2026): every Stripe checkout link in the build is one listed in
// src/data/services.ts, and the Follow-Up Desk page carries exactly the Desk links (regular, plus founding monthly
// and yearly while the sale is on). Catches a typo'd, stale or swapped Payment Link before visitors can click it.
{
  const src = read(new URL('../src/data/services.ts', import.meta.url));
  const known = new Set([...src.matchAll(/https:\/\/buy\.stripe\.com\/[\w]+/g)].map((m) => m[0]));
  const pick = (block, key) => (src.slice(src.indexOf(block)).match(new RegExp(`${key}: '(https://buy\\.stripe\\.com/\\w+)'`)) || [])[1];
  const deskRegular = pick('export const followUpDesk: Offer', 'buyUrl');
  const saleMonthly = pick('export const followUpDeskSale', 'monthlyUrl');
  const saleAnnual = pick('export const followUpDeskSale', 'annualUrl');
  const endsAt = (src.slice(src.indexOf('export const followUpDeskSale')).match(/endsAt: '([^']+)'/) || [])[1];
  for (const f of pages) {
    for (const [, h] of read(f).matchAll(/href="(https:\/\/buy\.stripe\.com\/[^"]*)"/g)) {
      if (!known.has(h)) fail(`unknown Stripe checkout link ${h} on ${relative(distDir, f)}`);
    }
  }
  const deskPage = join(distDir, 'follow-up-desk', 'index.html');
  if (!existsSync(deskPage)) fail('follow-up-desk/index.html missing');
  else {
    const html = read(deskPage);
    const onPage = new Set([...html.matchAll(/href="(https:\/\/buy\.stripe\.com\/[^"]*)"/g)].map((m) => m[1]));
    const saleOn = endsAt && Date.now() < Date.parse(endsAt);
    const want = new Set([deskRegular, ...(saleOn ? [saleMonthly, saleAnnual] : [])].filter(Boolean));
    if (!deskRegular) fail('could not read followUpDesk.buyUrl from services.ts');
    for (const u of want) if (!onPage.has(u)) fail(`Follow-Up Desk page is missing its checkout link ${u}`);
    for (const u of onPage) if (!want.has(u)) fail(`Follow-Up Desk page links to a checkout that isn't a current Desk link: ${u}`);
    if (saleOn && !html.includes(`data-sale-ends="${endsAt}"`)) fail('Follow-Up Desk page countdown does not use followUpDeskSale.endsAt');
  }
}

console.log(`release checks: ${pages.length} pages, ${links} internal links, ${failures.length} failure(s)`);
if (failures.length) { for (const m of failures) console.log(`::error::${m}`); process.exit(1); }
