// Generates a branded 1200x630 link-preview image (Open Graph) for every page that has no image of its own.
// Run after a production build that includes every timed guide:
//   rm -rf dist && SITE_URL=https://neonkey.tech BASE_PATH=/ PUBLIC_SITE_MODE=live PUBLISH_DATE=2099-01-01 npx astro build && npm run og   (outputs are committed in public/og/, like npm run assets)
// Base.astro uses public/og/<slug>.jpg when it exists, else /og-default.png. Pages that pass their own
// `image` (articles, the Founder Stack guide) keep it. Re-run after adding a page or changing a title.
import sharp from 'sharp';
import { readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const outDir = join(root, 'public', 'og');

// Must match ogSlug() in src/layouts/Base.astro.
export const ogSlug = (path) => path.replace(/^\/|\/$/g, '').replace(/\//g, '--') || 'home';

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;|&#160;/g, ' ');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const sections = {
  learn: 'Free guide', lab: 'Lab demo', services: 'Services', newsletter: 'Newsletter', contact: 'Contact',
  founders: 'For founders', 'follow-up-desk': 'Follow-Up Desk', pay: 'Pay', reviews: 'Reviews', notes: 'Notes',
  about: 'About', refer: 'Refer a business', local: 'Fairbanks and North Pole', 'free-it-kit': 'Free kit',
  articles: 'Articles', privacy: 'Legal', terms: 'Legal', disclosure: 'Legal',
};

// Greedy word wrap; returns null if it needs more than maxLines.
function wrap(str, maxChars, maxLines) {
  const lines = [''];
  for (const w of str.split(' ')) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = w;
    else if ((cur + ' ' + w).length <= maxChars) lines[lines.length - 1] = cur + ' ' + w;
    else lines.push(w);
  }
  return lines.length <= maxLines ? lines : null;
}
function fit(title) {
  // DejaVu Sans Bold averages about 0.64 em per character; the text column is about 1000px wide.
  for (const size of [84, 76, 68, 60, 54, 48]) {
    const lines = wrap(title, Math.floor(1000 / (size * 0.64)), 3);
    if (lines) return { size, lines };
  }
  const size = 48, max = Math.floor(1000 / (size * 0.64));
  const lines = wrap(title.slice(0, max * 3 - 3).replace(/\s+\S*$/, '') + '...', max, 3) || [title.slice(0, max)];
  return { size, lines };
}

function svg({ kicker, title }) {
  const { size, lines } = fit(title);
  const lh = Math.round(size * 1.14);
  const top = 300 - ((lines.length - 1) * lh) / 2 + size * 0.35;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".55" stop-color="#a78bfa"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
    <linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
    <radialGradient id="a" cx="0.1" cy="0" r="0.7"><stop offset="0" stop-color="#22d3ee" stop-opacity=".2"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="0.95" cy="1" r="0.7"><stop offset="0" stop-color="#a78bfa" stop-opacity=".24"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#1a1f44" stroke-width="1"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="#0b0d17"/>
  <rect width="1200" height="630" fill="url(#grid)" opacity=".6"/>
  <rect width="1200" height="630" fill="url(#a)"/>
  <rect width="1200" height="630" fill="url(#b)"/>
  <rect x="0" y="0" width="1200" height="6" fill="url(#t)"/>
  <g transform="translate(980 470) scale(.62)" fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity=".9">
    <circle cx="40" cy="60" r="40"/><path d="M80 60h104M152 60v30M180 60v20"/>
  </g>
  <circle cx="1004.8" cy="507.2" r="7.4" fill="#f472b6"/>
  <text x="90" y="118" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="26" font-weight="700" fill="#22d3ee" letter-spacing="4">${esc(kicker.toUpperCase())}</text>
  <text font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="${size}" font-weight="700" fill="#ffffff">${lines.map((l, i) => `<tspan x="88" y="${Math.round(top + i * lh)}">${esc(l)}</tspan>`).join('')}</text>
  <text x="90" y="540" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="34" font-weight="700" fill="#ffffff">Neon<tspan fill="url(#t)">Key</tspan></text>
  <text x="300" y="540" font-family="DejaVu Sans Mono, Noto Sans Mono, monospace" font-size="24" fill="#8b90b8">neonkey.tech</text>
</svg>`;
}

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}

const files = await htmlFiles(dist).catch(() => { throw new Error('dist/ not found: run the production build first'); });
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
let made = 0;
for (const f of files.sort()) {
  const html = await readFile(f, 'utf8');
  if (/<meta name="robots" content="noindex/.test(html)) continue; // thank-you pages, redirects, 404
  const img = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || '';
  if (!/\/og-default\.png$|\/og\/[^/]+\.jpg$/.test(img)) continue; // page has its own image
  const rel = relative(dist, dirname(f)).split(sep).join('/');
  const path = rel ? `/${rel}/` : '/';
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1];
  const title = (h1 && text(h1)) || text(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').replace(/ \| NeonKey$/, '');
  const seg = path.split('/')[1];
  const kicker = path === '/' ? 'Small-business tech' : path.startsWith('/learn/security-plus/') ? 'Security+ study guide' : sections[seg] || 'NeonKey';
  await sharp(Buffer.from(svg({ kicker, title }))).jpeg({ quality: 82, mozjpeg: true }).toFile(join(outDir, ogSlug(path) + '.jpg'));
  made++;
}
console.log(`Generated ${made} link-preview images in public/og/`);
