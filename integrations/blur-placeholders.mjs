// Build-time blurred image placeholders (no client JS). After `astro build`, every local raster <img>
// (jpg/png/webp under our own site) gets a tiny blurred copy of itself inlined as its CSS background,
// so readers see a soft preview of the photo instead of an empty box while the real image loads.
// The real image paints over the background once it arrives. Opt out per image with data-no-blur.
// Placeholders are ~300-600 bytes each and cached per image, so a photo used on many pages costs one resize.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

async function* htmlFiles(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

export default function blurPlaceholders({ base = '/' } = {}) {
  return {
    name: 'neonkey-blur-placeholders',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const cache = new Map();
        const placeholder = async (src) => {
          if (cache.has(src)) return cache.get(src);
          let uri = '';
          try {
            const rel = decodeURI(src.split(/[?#]/)[0]).slice(base.length);
            const buf = await sharp(join(root, rel)).resize(24).blur(1.2).webp({ quality: 40 }).toBuffer();
            uri = `data:image/webp;base64,${buf.toString('base64')}`;
          } catch { uri = ''; }
          cache.set(src, uri);
          return uri;
        };
        let files = 0, imgs = 0;
        for await (const f of htmlFiles(root)) {
          const html = await readFile(f, 'utf8');
          const tags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
          if (!tags.length) continue;
          let out = html, changed = 0;
          for (const tag of new Set(tags)) {
            if (/\sdata-no-blur\b|\sstyle\s*=/i.test(tag)) continue;
            const m = tag.match(/\ssrc\s*=\s*"([^"]+)"/i);
            if (!m || !m[1].startsWith(base) || m[1].startsWith('//') || !/\.(jpe?g|png|webp)(?:[?#]|$)/i.test(m[1])) continue;
            const uri = await placeholder(m[1]);
            if (!uri) continue;
            const withBg = tag.replace(/^<img\b/i, `<img style="background:url(${uri}) center/cover no-repeat"`);
            out = out.split(tag).join(withBg);
            changed++;
          }
          if (changed) { await writeFile(f, out); files++; imgs += changed; }
        }
        logger.info(`blur placeholders: ${imgs} images in ${files} pages (${cache.size} unique)`);
      },
    },
  };
}
