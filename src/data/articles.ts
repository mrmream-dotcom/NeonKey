// Article registry: the "frontmatter" for every published article.
// Each article page lives in src/pages/articles/<slug>.astro and reads its entry from here,
// so the index, the category pages (/articles/news/, /articles/insights/, /articles/reviews/) and the badges stay in sync.
// Reviews also appear on /reviews/.
//
// To publish an article: add the page file, then add an entry below (newest first).
//   category   'news' | 'insights' | 'reviews' (defaults to 'insights' when omitted)
//   author     Byline name (defaults to "NeonKey")
//   sourceUrl  News posts: link to the original story. Rendered as "Source: <sourceName>" on the article page.
//   sourceName News posts: publication name shown in that link (falls back to the URL's hostname).

export const ARTICLE_CATEGORIES = ['news', 'insights', 'reviews'] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];
export const DEFAULT_CATEGORY: ArticleCategory = 'insights';

export const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  news: 'News',
  insights: 'Insights',
  reviews: 'Reviews',
};

export interface ArticleInput {
  slug: string;
  title: string;
  description: string;
  /** Topic tag shown on the card, e.g. "Automation". */
  topic?: string;
  category?: ArticleCategory;
  /** Byline name; defaults to "NeonKey". */
  author?: string;
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
    slug: 'lenovo-legion-pro-7i-review',
    title: 'Lenovo Legion Pro 7i Gen 10 Review: A Gaming Laptop I Use for Work',
    description: "Six months with the Legion Pro 7i Gen 10 (RTX 5080, 32GB) as a work machine. It's good for virtualization, multitasking and two external monitors, but it's heavy.",
    topic: 'Laptops',
    category: 'reviews',
    author: 'Michael Ream',
    date: '2026-10-30',
  }),
  defineArticle({
    slug: 'budget-work-laptops',
    title: 'Four Budget Work Machines for Everyday Work',
    description: 'Smaller-tier alternatives to a gaming-laptop workstation: Mac mini M6, MacBook Air 13-inch M5, ThinkPad E14 Gen 7 and HP ProBook 4 G1i, plus what to look for in a secure, reliable work machine.',
    topic: 'Laptops',
    category: 'reviews',
    author: 'Michael Ream',
    date: '2026-10-30',
  }),
  defineArticle({
    slug: 'ai-hacking-defender',
    title: "Everyone's Worried About AI Hacking. It's Also Becoming a Defender.",
    description: "AI is speeding up cyberattacks, but it's also helping defenders catch intrusions, find weak spots and decide what to fix first. Here's what that means.",
    topic: 'Security',
    category: 'news',
    date: '2026-10-30',
    sourceUrl: 'https://presswire.com/release/ai-startup-avalonx-emerges-from-stealth-with-10-million-in-funding-from-ridown-capital/',
    sourceName: 'AvalonX launch announcement (Presswire, Oct 28, 2026)',
  }),
  defineArticle({
    slug: 'why-outsource-automations',
    title: "You Could Automate It Yourself. Here's Why You Might Not Want To.",
    description: "An honest look at DIY automations vs. getting help: what's doable on your own, what tends to go wrong, and how to decide.",
    topic: 'Automation',
    category: 'insights',
  }),
  defineArticle({
    slug: 'what-is-neonkey',
    title: 'What Is NeonKey? The Vision and What We Do',
    description: "A plain-English introduction to NeonKey: a new tech help brand for individuals and small businesses, what it covers, the idea behind it, and how to share feedback.",
    topic: 'About',
    category: 'insights',
    date: '2026-10-29',
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
