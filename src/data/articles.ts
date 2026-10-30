// Article registry: the "frontmatter" for every published article.
// Each article page lives in src/pages/articles/<slug>.astro and reads its entry from here,
// so the index, the category pages (/articles/news/, /articles/insights/) and the badges stay in sync.
//
// To publish an article: add the page file, then add an entry below (newest first).
//   category   'news' | 'insights' (defaults to 'insights' when omitted)
//   sourceUrl  News posts: link to the original story. Rendered as "Source: <sourceName>" on the article page.
//   sourceName News posts: publication name shown in that link (falls back to the URL's hostname).

export const ARTICLE_CATEGORIES = ['news', 'insights'] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];
export const DEFAULT_CATEGORY: ArticleCategory = 'insights';

export const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  news: 'News',
  insights: 'Insights',
};

export interface ArticleInput {
  slug: string;
  title: string;
  description: string;
  /** Topic tag shown on the card, e.g. "Automation". */
  topic?: string;
  category?: ArticleCategory;
  /** ISO date, optional. */
  date?: string;
  sourceUrl?: string;
  sourceName?: string;
}

export interface Article extends ArticleInput {
  category: ArticleCategory;
  href: string;
}

function defineArticle(input: ArticleInput): Article {
  const category = input.category ?? DEFAULT_CATEGORY;
  if (!ARTICLE_CATEGORIES.includes(category)) {
    throw new Error(`Article "${input.slug}": unknown category "${category}" (use ${ARTICLE_CATEGORIES.join(' | ')})`);
  }
  if (input.sourceUrl && !/^https?:\/\//.test(input.sourceUrl)) {
    throw new Error(`Article "${input.slug}": sourceUrl must be an absolute http(s) URL`);
  }
  return { ...input, category, href: `/articles/${input.slug}/` };
}

export const articles: Article[] = [
  defineArticle({
    slug: 'why-outsource-automations',
    title: "You Could Automate It Yourself. Here's Why You Might Not Want To.",
    description: "An honest look at DIY automations vs. getting help: what's doable on your own, what tends to go wrong, and how to decide.",
    topic: 'Automation',
    category: 'insights',
  }),
];

export function getArticle(slug: string): Article {
  const a = articles.find((x) => x.slug === slug);
  if (!a) throw new Error(`No entry for article "${slug}" in src/data/articles.ts`);
  return a;
}

export function articlesIn(category?: ArticleCategory): Article[] {
  return category ? articles.filter((a) => a.category === category) : articles;
}

/** Display name for a news source: sourceName, else the URL's hostname. */
export function sourceLabel(a: Pick<Article, 'sourceUrl' | 'sourceName'>): string | undefined {
  if (!a.sourceUrl) return undefined;
  if (a.sourceName) return a.sourceName;
  try { return new URL(a.sourceUrl).hostname.replace(/^www\./, ''); } catch { return a.sourceUrl; }
}
