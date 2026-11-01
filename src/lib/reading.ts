// Build-time reading-time estimates (~230 words per minute), computed from each page's own source text.
// Used by the Articles index, article bylines, the home page and Learn page headers.
const articleSources = import.meta.glob('../pages/articles/*.astro', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const learnSources = import.meta.glob('../pages/learn/**/*.mdx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function countMinutes(src: string): number {
  const body = src
    .replace(/^---[\s\S]*?---/, '')
    .replace(/^(import|export) .*$/gm, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^{}]*\}/g, ' ');
  const words = body.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
  return Math.max(1, Math.ceil(words / 230));
}

/** Reading time for an article page, by slug. */
export function articleMinutes(slug: string): number | undefined {
  const src = articleSources[`../pages/articles/${slug}.astro`];
  return src ? countMinutes(src) : undefined;
}

/** Reading time for a Learn MDX page, by its URL path (e.g. "/learn/wifi-network-checkup/"). */
export function learnMinutes(pathname: string): number | undefined {
  const clean = pathname.replace(/^.*?\/learn\//, '').replace(/\/$/, '');
  const src = learnSources[`../pages/learn/${clean}.mdx`] ?? learnSources[`../pages/learn/${clean}/index.mdx`] ?? (clean === '' ? learnSources['../pages/learn/index.mdx'] : undefined);
  return src ? countMinutes(src) : undefined;
}
