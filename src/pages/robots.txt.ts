import type { APIRoute } from 'astro';
import { IS_LIVE, absoluteUrl } from '../config';

// Demo mode: block all crawling. Live mode: allow crawling and point to the sitemap.
export const GET: APIRoute = ({ site }) => {
  const body = IS_LIVE
    ? `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap-index.xml', site)}\n`
    : `# Pre-launch build: not for indexing.\nUser-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
