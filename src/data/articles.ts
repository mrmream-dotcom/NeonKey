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
//   image      Optional hero image path (relative to the site base), shown on the Articles index cards.
//   imageAlt   Alt text for that image (required when image is set). Without an image, cards use a branded fallback.

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
  /** Hero image path relative to the site base, e.g. "/images/articles/<slug>/hero.jpg". */
  image?: string;
  /** Alt text for the hero image. */
  imageAlt?: string;
  /** Intrinsic size of the hero image (prevents layout shift). */
  imageWidth?: number;
  imageHeight?: number;
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
  if (input.image && !input.imageAlt) {
    throw new Error(`Article "${input.slug}": image needs imageAlt`);
  }
  if (input.sourceUrl && !/^https?:\/\//.test(input.sourceUrl)) {
    throw new Error(`Article "${input.slug}": sourceUrl must be an absolute http(s) URL`);
  }
  return { ...input, category, href: `/articles/${input.slug}/` };
}

export const articles: Article[] = [
  defineArticle({
    slug: 'update-week',
    title: "Chrome, Firefox and iPhone All Got Security Fixes This Week. Here's How to Update.",
    description: "Google, Mozilla and Apple all shipped security updates in the last week of October. Here's what that means in everyday terms and how to install them in a few minutes.",
    topic: 'Security',
    category: 'news',
    date: '2026-10-31',
    sourceUrl: 'https://chromereleases.googleblog.com/2026/10/stable-channel-update-for-desktop_0562499947.html',
    sourceName: 'Google Chrome Releases (Oct 27, 2026)',
    image: '/images/articles/update-week/hero.jpg',
    imageAlt: 'A person holds a smartphone while sitting at a desk in front of an open laptop.',
    imageWidth: 1400,
    imageHeight: 933,
  }),
  defineArticle({
    slug: 'lenovo-legion-pro-7i-review',
    title: 'Lenovo Legion Pro 7i Gen 10 Review: A Gaming Laptop I Use for Work',
    description: "Six months with the Legion Pro 7i Gen 10 (RTX 5080, 32GB) as a work machine. It's good for virtualization, multitasking and two external monitors, but it's heavy.",
    topic: 'Laptops',
    category: 'reviews',
    author: 'Michael Ream',
    date: '2026-10-30',
    image: '/images/articles/lenovo-legion-pro-7i-review/hero.jpg',
    imageAlt: 'A closed dark gray Lenovo Legion gaming laptop next to its power adapter and a wireless mouse on a blue surface.',
    imageWidth: 1400,
    imageHeight: 933,
  }),
  defineArticle({
    slug: 'budget-work-laptops',
    title: 'Four Budget Work Machines for Everyday Work',
    description: 'Smaller-tier alternatives to a gaming-laptop workstation: Mac mini M6, MacBook Air 13-inch M5, ThinkPad E14 Gen 7 and HP ProBook 4 G1i, plus what to look for in a secure, reliable work machine.',
    topic: 'Laptops',
    category: 'reviews',
    author: 'Michael Ream',
    date: '2026-10-30',
    image: '/images/articles/budget-work-laptops/hero.jpg',
    imageAlt: 'Three Lenovo ThinkPad laptops of different sizes set up side by side on an office desk.',
    imageWidth: 1400,
    imageHeight: 933,
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
    image: '/images/articles/ai-hacking-defender/hero.jpg',
    imageAlt: 'Rows of server racks glowing with blue lights in a dim data center.',
    imageWidth: 1400,
    imageHeight: 933,
  }),
  defineArticle({
    slug: 'why-outsource-automations',
    title: "You Could Automate It Yourself. Here's Why You Might Not Want To.",
    description: "An honest look at DIY automations vs. getting help: what's doable on your own, what tends to go wrong, and how to decide.",
    topic: 'Automation',
    category: 'insights',
    date: '2026-10-29',
    image: '/images/articles/why-outsource-automations/hero.jpg',
    imageAlt: 'A laptop on a glass table showing a business dashboard with charts and statistics.',
    imageWidth: 1400,
    imageHeight: 933,
  }),
  defineArticle({
    slug: 'what-is-neonkey',
    title: 'What Is NeonKey? The Vision and What We Do',
    description: "A short introduction to NeonKey: a new tech help brand for individuals and small businesses, what it covers, the idea behind it, and how to share feedback.",
    topic: 'About',
    category: 'insights',
    date: '2026-10-29',
    image: '/images/articles/what-is-neonkey/hero.jpg',
    imageAlt: 'Close-up of a backlit laptop keyboard glowing in a dark room.',
    imageWidth: 1400,
    imageHeight: 933,
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

/** Articles sorted newest first by date (stable, so same-day entries keep registry order). Undated entries go last. */
export function sortByDate(list: Article[]): Article[] {
  return list
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      if (x.a.date && y.a.date) return x.a.date === y.a.date ? x.i - y.i : x.a.date < y.a.date ? 1 : -1;
      if (x.a.date) return -1;
      if (y.a.date) return 1;
      return x.i - y.i;
    })
    .map(({ a }) => a);
}

/** Date parts for display, from an ISO date (YYYY-MM-DD). Parsed at noon UTC so the day never shifts. */
export function dateParts(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  const fmt = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-US', { ...o, timeZone: 'UTC' });
  return {
    month: fmt({ month: 'short' }),
    day: fmt({ day: 'numeric' }),
    year: fmt({ year: 'numeric' }),
    weekday: fmt({ weekday: 'long' }),
    long: fmt({ year: 'numeric', month: 'long', day: 'numeric' }),
    short: fmt({ year: 'numeric', month: 'short', day: 'numeric' }),
    monthYear: fmt({ year: 'numeric', month: 'long' }),
    monthKey: iso.slice(0, 7),
  };
}

/** Display name for a news source: sourceName, else the URL's hostname. */
export function sourceLabel(a: Pick<Article, 'sourceUrl' | 'sourceName'>): string | undefined {
  if (!a.sourceUrl) return undefined;
  if (a.sourceName) return a.sourceName;
  try { return new URL(a.sourceUrl).hostname.replace(/^www\./, ''); } catch { return a.sourceUrl; }
}
