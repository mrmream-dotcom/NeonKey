// Build-time external-link pass (no client JS). After `astro build`, every <a href="http(s)://..."> whose host
// isn't one of ours (from .astro pages/components *and* MDX/markdown content) gets target="_blank",
// rel="noopener noreferrer" (merged with any existing rel such as "sponsored") and a visually hidden
// "(opens in new tab)" label. Internal, relative, mailto:, tel: and #anchor links are left alone.
// Opt out per link with data-same-tab.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = '<span class="sr-only"> (opens in new tab)</span>';

async function* htmlFiles(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

export function rewriteExternalLinks(html, internalHosts) {
  let changed = 0;
  const out = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (whole, attrs, inner) => {
    const m = attrs.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (!m || /\sdata-same-tab\b/i.test(attrs)) return whole;
    const href = (m[1] ?? m[2]).trim();
    if (!/^https?:\/\//i.test(href)) return whole;
    let host;
    try { host = new URL(href).hostname.toLowerCase(); } catch { return whole; }
    if (internalHosts.has(host)) return whole;
    const relM = attrs.match(/\srel\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const rel = new Set(((relM && (relM[1] ?? relM[2])) || '').split(/\s+/).filter(Boolean));
    rel.add('noopener'); rel.add('noreferrer');
    let a = attrs.replace(/\s(?:target|rel)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
    a += ` target="_blank" rel="${[...rel].join(' ')}"`;
    changed++;
    return `<a${a}>${inner}${inner.includes('opens in new tab') ? '' : SR}</a>`;
  });
  return { out, changed };
}

export default function externalLinks({ hosts = [] } = {}) {
  return {
    name: 'neonkey-external-links',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const internal = new Set(hosts.map((h) => h.toLowerCase()));
        let files = 0, links = 0;
        for await (const f of htmlFiles(fileURLToPath(dir))) {
          const html = await readFile(f, 'utf8');
          const { out, changed } = rewriteExternalLinks(html, internal);
          if (changed) { await writeFile(f, out); files++; links += changed; }
        }
        logger.info(`external links: ${links} links in ${files} pages set to open in a new tab`);
      },
    },
  };
}
