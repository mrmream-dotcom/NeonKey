// Generates the social image and PNG icons from SVG sources using sharp.
// Run: npm run assets   (outputs are committed in public/)
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';

const out = (f) => new URL(`../public/${f}`, import.meta.url);
const favicon = await readFile(out('favicon.svg'));

const key = (x, y, s) => `
  <g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="40" cy="60" r="40"/><path d="M80 60h104M152 60v30M180 60v20"/>
  </g>
  <circle cx="${x + 40 * s}" cy="${y + 60 * s}" r="${12 * s}" fill="#f472b6"/>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".55" stop-color="#a78bfa"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
    <linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
    <radialGradient id="glowA" cx="0.15" cy="0.1" r="0.6"><stop offset="0" stop-color="#22d3ee" stop-opacity=".22"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
    <radialGradient id="glowB" cx="0.9" cy="0.95" r="0.6"><stop offset="0" stop-color="#f472b6" stop-opacity=".2"/><stop offset="1" stop-color="#f472b6" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#1c2147" stroke-width="1"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="#0b0d1f"/>
  <rect width="1200" height="630" fill="url(#grid)" opacity=".7"/>
  <rect width="1200" height="630" fill="url(#glowA)"/>
  <rect width="1200" height="630" fill="url(#glowB)"/>
  <rect x="24" y="24" width="1152" height="582" rx="28" fill="none" stroke="url(#t)" stroke-opacity=".55" stroke-width="2"/>
  ${key(880, 300, 1.3)}
  <text x="90" y="250" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="104" font-weight="700" fill="#ffffff">Neon<tspan fill="url(#t)">Key</tspan></text>
  <text x="94" y="330" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="42" fill="#c7cbe8">Unlock tech, whatever your level.</text>
  <text x="94" y="420" font-family="DejaVu Sans, Noto Sans, sans-serif" font-size="28" fill="#22d3ee" letter-spacing="3">AI · DEALS · SKILLS · WEEKLY</text>
  <text x="94" y="540" font-family="DejaVu Sans Mono, Noto Sans Mono, monospace" font-size="26" fill="#8b90b8">neonkey.tech</text>
</svg>`;

await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(out('og-default.png').pathname);

const icon = (size) => sharp(favicon, { density: Math.max(72, (size / 64) * 72 * 2) }).resize(size, size).png({ compressionLevel: 9 });
await icon(32).toFile(out('favicon-32x32.png').pathname);
await icon(180).toFile(out('apple-touch-icon.png').pathname);
await icon(192).toFile(out('icon-192.png').pathname);
await icon(512).toFile(out('icon-512.png').pathname);

// Maskable: full-bleed background with the mark inside the 80% safe zone.
const inner = await sharp(favicon, { density: 600 }).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0b0d17' } })
  .composite([{ input: inner, top: 76, left: 76 }]).png({ compressionLevel: 9 })
  .toFile(out('icon-512-maskable.png').pathname);

console.log('Generated og-default.png, favicon-32x32.png, apple-touch-icon.png, icon-192/512(.maskable).png');
