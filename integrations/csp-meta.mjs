// Build-time security meta tags for GitHub Pages.
//
// GitHub Pages ignores public/_headers, so the live site was served with no Content-Security-Policy
// or Referrer-Policy at all. After `astro build`, this pass adds to every HTML page, right after
// <meta charset>:
//   <meta http-equiv="Content-Security-Policy" content="...">   (policy read from public/_headers)
//   <meta name="referrer" content="strict-origin-when-cross-origin">
//
// public/_headers stays the single source of truth for the policy (it is still used as-is if the
// site ever moves to Cloudflare Pages). Directives a <meta> CSP cannot carry (frame-ancestors,
// report-uri, report-to, sandbox) are dropped here; browsers ignore them in meta and log warnings.
// Inline scripts (e.g. `is:inline define:vars` in the Lab pages) get a per-page sha256 hash
// added to script-src, so they keep working without 'unsafe-inline'. JSON-LD blocks are data,
// not scripts, and need no hash.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const META_UNSUPPORTED = new Set(['frame-ancestors', 'report-uri', 'report-to', 'sandbox']);
const REFERRER = '<meta name="referrer" content="strict-origin-when-cross-origin" />';

async function* htmlFiles(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

export function policyFromHeaders(text) {
  const line = text.split('\n').find((l) => /^\s*Content-Security-Policy:/i.test(l));
  if (!line) throw new Error('[csp-meta] no Content-Security-Policy line in public/_headers');
  return line
    .replace(/^\s*Content-Security-Policy:\s*/i, '')
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((d) => !META_UNSUPPORTED.has(d.split(/\s+/)[0].toLowerCase()));
}

const NON_JS_TYPE = /\stype\s*=\s*["']?(application\/(ld\+)?json|text\/plain|importmap)/i;

export function inlineScriptHashes(html) {
  const hashes = new Set();
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)) {
    const [, attrs, body] = m;
    if (/\ssrc\s*=/i.test(attrs) || NON_JS_TYPE.test(attrs) || body.length === 0) continue;
    hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
  return [...hashes];
}

export function addSecurityMeta(html, directives) {
  if (/http-equiv=["']Content-Security-Policy/i.test(html)) return { out: html, changed: false };
  const hashes = inlineScriptHashes(html);
  const policy = directives
    .map((d) => (hashes.length && /^script-src\s/i.test(d) ? `${d} ${hashes.join(' ')}` : d))
    .join('; ');
  const tags = `<meta http-equiv="Content-Security-Policy" content="${policy.replace(/"/g, '&quot;')}" />${REFERRER}`;
  const charset = html.match(/<meta\s+charset[^>]*>/i);
  let out;
  if (charset) out = html.replace(charset[0], `${charset[0]}${tags}`);
  else if (/<head[^>]*>/i.test(html)) out = html.replace(/<head[^>]*>/i, (h) => `${h}${tags}`);
  else return { out: html, changed: false };
  return { out, changed: true };
}

export default function cspMeta() {
  let publicDir;
  return {
    name: 'neonkey-csp-meta',
    hooks: {
      'astro:config:done': ({ config }) => { publicDir = fileURLToPath(config.publicDir); },
      'astro:build:done': async ({ dir, logger }) => {
        const directives = policyFromHeaders(await readFile(join(publicDir, '_headers'), 'utf8'));
        const root = fileURLToPath(dir);
        let pages = 0;
        for await (const file of htmlFiles(root)) {
          const html = await readFile(file, 'utf8');
          const { out, changed } = addSecurityMeta(html, directives);
          if (changed) { await writeFile(file, out); pages++; }
        }
        logger.info(`added CSP + referrer meta tags to ${pages} page(s)`);
      },
    },
  };
}
