#!/usr/bin/env node
// Ping IndexNow (Bing, Yandex, Seznam, Naver...) about new or changed pages on neonkey.tech.
//
// Usage (after deploying to gh-pages and the live site has updated):
//   node scripts/indexnow.mjs                 # every URL in dist/sitemap-*.xml (the build you just deployed)
//   node scripts/indexnow.mjs --live          # every URL in the live https://neonkey.tech/sitemap-index.xml
//   node scripts/indexnow.mjs /articles/x/ https://neonkey.tech/y/   # only these URLs
//   add --dry-run to print what would be sent without POSTing
//
// The key is public by design: it lives in public/<key>.txt (32 hex chars, file content = key),
// so it serves at https://neonkey.tech/<key>.txt. This script finds it there automatically.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const HOST = 'neonkey.tech';
const ORIGIN = `https://${HOST}`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const root = new URL('..', import.meta.url).pathname;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const live = args.includes('--live');
const explicit = args.filter((a) => !a.startsWith('--'));

function findKey() {
  const dir = join(root, 'public');
  for (const f of readdirSync(dir)) {
    const m = f.match(/^([a-f0-9]{32})\.txt$/);
    if (m && readFileSync(join(dir, f), 'utf8').trim() === m[1]) return m[1];
  }
  throw new Error('No IndexNow key file found in public/ (expected <32-hex>.txt containing the key).');
}

const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);

async function sitemapUrls() {
  if (live) {
    const idx = await (await fetch(`${ORIGIN}/sitemap-index.xml`)).text();
    const out = [];
    for (const sm of locs(idx)) out.push(...locs(await (await fetch(sm)).text()));
    return out;
  }
  const dist = join(root, 'dist');
  if (!existsSync(dist)) throw new Error('dist/ not found. Build first, or use --live.');
  return readdirSync(dist)
    .filter((f) => /^sitemap-\d+\.xml$/.test(f))
    .flatMap((f) => locs(readFileSync(join(dist, f), 'utf8')));
}

const key = findKey();
let urls = explicit.length
  ? explicit.map((u) => new URL(u, ORIGIN).href)
  : await sitemapUrls();
urls = [...new Set(urls)].filter((u) => new URL(u).host === HOST);
if (!urls.length) throw new Error('No URLs to submit.');

const body = { host: HOST, key, keyLocation: `${ORIGIN}/${key}.txt`, urlList: urls.slice(0, 10000) };
console.log(`IndexNow: ${body.urlList.length} URL(s) for ${HOST}${dryRun ? ' (dry run)' : ''}`);
if (dryRun) { body.urlList.forEach((u) => console.log('  ' + u)); process.exit(0); }

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
const text = await res.text();
console.log(`HTTP ${res.status} ${res.statusText}${text ? ': ' + text.slice(0, 300) : ''}`);
// 200 = OK, 202 = accepted (key validation pending). 400/403/422/429 = problem.
process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
