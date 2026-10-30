# NeonKey

> **Unlock tech, whatever your level.**
> Static site built with [Astro](https://astro.build). One codebase builds a **demo** (pre-launch) version (noindex, robots.txt Disallow) or a **live** version (indexable), on any base path. Neither shows a visible demo banner.

Going live? Follow **[LAUNCH.md](LAUNCH.md)**. It lists what is done and what still needs you.

## Build modes and environment variables

All settings are environment variables read at build time. Nothing needs editing in code.

| Variable | Default | What it does |
|---|---|---|
| `SITE_URL` | `https://neonkey.tech` | Origin used for canonical URLs, OG tags, sitemap and robots.txt |
| `BASE_PATH` | `/` | Sub-path the site is served from (e.g. `/NeonKey/` for a project-pages URL without a custom domain). Every internal link and asset follows it. The neonkey.tech demo uses `/` |
| `PUBLIC_SITE_MODE` | `demo` | `demo` = `noindex, nofollow` on every page, robots.txt blocks crawling (no visible banner). `live` = indexable, robots.txt allows crawling and lists the sitemap |
| `PUBLIC_UMAMI_WEBSITE_ID` | `2c6a467e-392a-4226-b068-fdfc908a48da` (NeonKey) | Umami website ID, public by design. Built in as the default, so every build includes tracking. Set to `off` to build without analytics |
| `PUBLIC_UMAMI_SRC` | `https://cloud.umami.is/script.js` | Umami script URL (change for self-hosted Umami) |
| `PUBLIC_UMAMI_DOMAINS` | `neonkey.tech,www.neonkey.tech` | Umami `data-domains`: the script only reports from these hostnames, so localhost, `*.pages.dev` and `github.io` previews load it but send nothing |
| `PUBLIC_NEWSLETTER_PROVIDER` | *(unset)* | Set to `kit` to turn on newsletter signups (Kit, formerly ConvertKit) |
| `PUBLIC_KIT_FORM_ID` | *(unset)* | Numeric Kit form ID. The site's own form posts `email_address` to `https://app.kit.com/forms/<ID>/subscriptions` (recommended) |
| `PUBLIC_KIT_EMBED_SRC` | *(unset)* | Alternative: Kit's JavaScript embed `src`, e.g. `https://<account>.kit.com/<uid>/index.js`. Used only when `PUBLIC_KIT_FORM_ID` is unset |
| `PUBLIC_KIT_FORM_URL` | *(unset)* | Optional override for the full form action URL (`https://app.kit.com/forms/<ID>/subscriptions`) |
| `PUBLIC_CONTACT_EMAIL` | `hello@neonkey.tech` | Public contact address (placeholder until the inbox exists) |

Examples:

```bash
npm install
npm run build                                                     # demo, https://neonkey.tech, base /
PUBLIC_SITE_MODE=live npm run build                               # live build for neonkey.tech
SITE_URL=https://neonkey.tech npm run build   # GitHub Pages demo at neonkey.tech (demo mode is the default)
npm run dev                                                       # dev server at http://localhost:4321
npx astro preview --port 4322 --host 127.0.0.1                    # serve ./dist
npm run assets                                                    # regenerate OG image + PNG icons (sharp)
```

Requires Node 22.23.4+ (developed on Node 24). `.env` files work too (see Astro's env docs); don't commit real IDs if you'd rather keep them out of git.

## Analytics: Umami

Umami is cookieless and doesn't collect personal data, so it needs no cookie banner. The privacy page switches its wording automatically when an ID is set.

**Set up (done):** the NeonKey website exists in Umami Cloud, and its ID `2c6a467e-392a-4226-b068-fdfc908a48da` is the default in `src/config.ts`. No env var is needed. The script is `https://cloud.umami.is/script.js`, which sends to `https://gateway.umami.is/api/send`, as checked in the live script in Oct 2026. Both hosts are in the CSP in `public/_headers`.

**Stats only come from the real domain.** `data-domains="neonkey.tech,www.neonkey.tech"` means visits on localhost, `astro preview`, `*.pages.dev` previews or `github.io` aren't counted. To test locally, either:
- build with `PUBLIC_UMAMI_DOMAINS=localhost,127.0.0.1` (this adds test visits to the real stats), or
- open the deployed site.

To turn tracking off on your own browser, run `localStorage.setItem('umami.disabled', 1)` in the devtools console on neonkey.tech.

**Test it**
1. Open https://neonkey.tech/ in a normal browser window with extensions off, and open devtools → **Network**:
   - `script.js` from `cloud.umami.is` loads with status **200**.
   - A POST to **`gateway.umami.is/api/send`** returns **200** on each page view and on tracked clicks.
2. In Umami, open the website's **Realtime** view: you should appear as a current visitor within a few seconds.
3. Click a tracked button (e.g. Services "Ask about this"); the event shows under **Events**.
4. Ad-blockers and privacy extensions (uBlock Origin, Brave Shields and others) often block Umami. If nothing shows up, test in a clean profile.

**Tracked events** (via `data-umami-event` attributes; `newsletter-signup` is sent by a small submit listener in `Base.astro`):

| Event | Where | Extra data |
|---|---|---|
| `newsletter-cta` | Header "Newsletter" button, home hero | `location` |
| `newsletter-signup` | A valid signup form submit (form and embed modes; confirmed subscribers are counted in Kit) | `form`, `provider` (`kit`) |
| `services-cta` | Service "Ask about this" / "See what's included" buttons, home and Lab CTAs | `offer`, `location` |
| `contact-click` / `contact-submit` | Contact links, email links, contact form | `location`, `offer` |
| `lab-cta` | "See the builds" / "All builds" links | `location` |
| `lab-filter` | Lab tag filter chips | `tag` |
| `affiliate-click` | Review "where to buy" buttons | `item`, `retailer` |
| `outbound-click` | Selected outbound links | `item` |

## Newsletter: Unlock the Week (Kit)

With no newsletter variables set, every signup form shows a clear **Coming soon** state: the field and button are disabled and nothing is collected. To turn it on (full steps in [LAUNCH.md](LAUNCH.md), section 5):

- **Site form (recommended):** in Kit, **Grow → Landing Pages & Forms → your form → Embed → HTML**. The code's `<form action="https://app.kit.com/forms/<FORM_ID>/subscriptions">` contains the numeric ID. Set `PUBLIC_NEWSLETTER_PROVIDER=kit` and `PUBLIC_KIT_FORM_ID=<FORM_ID>`. The site renders its own styled form (email field named `email_address`, as Kit expects) and the visitor lands on Kit's confirmation, or your redirect URL if you set one in the form settings. No third-party script runs on the site.
- **Kit JavaScript embed:** **Embed → JavaScript** gives `<script async data-uid="<uid>" src="https://<account>.kit.com/<uid>/index.js"></script>`. Set `PUBLIC_NEWSLETTER_PROVIDER=kit` and `PUBLIC_KIT_EMBED_SRC=<that src>`. Kit draws its own form, and changes made in Kit show up automatically. Use an **Inline** form.

Kit docs: [Form embedding basics](https://help.kit.com/en/articles/4009572-form-embedding-basics). `public/_headers` already allows the Kit domains both modes need.

## Hosting files

- `public/_headers`: Cloudflare Pages security headers (CSP allowing Umami Cloud and Kit forms, nosniff, Referrer-Policy, Permissions-Policy, `frame-ancestors 'none'`) and long caching for `/_astro/*`.
- `public/_redirects`: a few short URLs (`/portfolio`, `/weekly`, `/subscribe`, `/it`).
- Both are ignored by GitHub Pages and `astro preview`.
- The build emits no inline scripts or stylesheets (`build.inlineStylesheets: 'never'`, `assetsInlineLimit: 0`), so the strict `script-src` works. Inline `style=""` attributes are used, so `style-src` includes `'unsafe-inline'`.
- `robots.txt` and `site.webmanifest` are generated per mode and base (`src/pages/robots.txt.ts`, `src/pages/site.webmanifest.ts`). The sitemap comes from `@astrojs/sitemap` (`/sitemap-index.xml`).

## Pages

| Route | Page |
|---|---|
| `/` | Home: hero, four Unlock pillars, tutorials, From the Lab strip, featured review, newsletter, services teaser |
| `/learn/` | Learn hub (`src/pages/learn/index.mdx`): tracks + "Tutorials — coming soon"; drafts in `src/_drafts/learn/` |
| `/learn/security-plus/` | Security+ study guide: intro, 5 domain pages, acronyms (MDX in `src/pages/learn/security-plus/`, components in `src/components/learn/`, data in `src/data/security-plus/`). To swap in an affiliate link, set `officialLink.affiliateUrl` + `isAffiliate: true` in `track.json`. Re-check price/exam-version notes (SY0-801 launches ~Nov 17, 2026) and bump `lastReviewed`. |
| `/lab/` | Lab portfolio with tag filters for published projects (empty state for now; 3 sample case studies are drafts in `src/_drafts/lab/`) |
| `/reviews/` | Reviews index (empty state; sample review is a draft in `src/_drafts/reviews/`) |
| `/articles/` | Articles index with All / News / Insights tabs (static pages `/articles/news/`, `/articles/insights/`; entries and categories in `src/data/articles.ts`; empty categories are noindex and left out of the sitemap; the old `/notes/` URL redirects here; sample draft in `src/_drafts/articles/`) |
| `/newsletter/` | Unlock the Week: what you get, cadence, privacy, issue format |
| `/services/` | Featured Remote Small-Office IT Setup plus three automation services |
| `/services/remote-it/` | Remote Small-Office IT Setup & the monthly remote support plan: scope, exclusions, pricing |
| `/about/`, `/disclosure/`, `/privacy/`, `/contact/` | Footer pages (privacy is a draft; the contact form isn't connected) |
| `/404` | Not found |

## Project structure

```
public/            favicon.svg + generated PNG icons, og-default.png, _headers, _redirects
scripts/           generate-assets.mjs (sharp: OG image and icons)
src/config.ts      env-driven settings and the base-aware url() helper
src/components/    Logo, Card, EmptyState, NewsletterForm, Redirect (static redirect pages), DemoBadge (drafts only)
src/_drafts/       hidden sample pages (not built; see LAUNCH.md step 8)
src/data/          lab.ts (Lab projects), services.ts (service offers and prices)
src/layouts/       Base.astro (head/meta, nav, footer, Umami), LabProject.astro
src/pages/         one file per route, plus robots.txt.ts and site.webmanifest.ts
docs/              pages.yml.example (GitHub Pages workflow copy), pricing-research.md
screenshots/       reference screenshots
```

Internal links must use `url('/path/')` from `src/config.ts` so they respect `BASE_PATH`.

## Deploying

- **Cloudflare Pages (production):** see [LAUNCH.md](LAUNCH.md).
- **Domain:** `neonkey.tech`, registered at Porkbun on Oct 29, 2026. It renews Oct 30, 2027 at $50.98/yr, with auto-renew on. DNS is at Porkbun and points at GitHub Pages (apex `A`/`AAAA` + `www` CNAME) for the demo.
- **GitHub Pages (live, https://neonkey.tech/):** the site went live on Oct 30, 2026. The `gh-pages` branch holds a clean **live** build with `.nojekyll` and `CNAME`. `public/CNAME` puts `CNAME` into every build automatically. **Always build with `PUBLIC_SITE_MODE=live`.** The code default is still `demo` (so local and preview builds stay noindex), and a deploy without it would put `noindex` back on every page:
  ```sh
  rm -rf dist && SITE_URL=https://neonkey.tech BASE_PATH=/ PUBLIC_SITE_MODE=live npx astro build
  # then push dist/ (plus CNAME + .nojekyll) to the gh-pages branch
  ```
  `.github/workflows/pages.yml` (manual-only, copy in `docs/pages.yml.example`) builds the same live build once **Settings → Pages → Source** is set to **GitHub Actions**. GitHub Pages ignores `_headers`/`_redirects`.
- **Launch plan:** move DNS to Cloudflare and deploy on Cloudflare Pages in live mode, so headers, redirects and Email Routing work. See LAUNCH.md, step 1.


## External links

`integrations/external-links.mjs` runs after `astro build` and rewrites every `<a href="http(s)://…">` whose host isn't neonkey.tech (from .astro and MDX alike) to `target="_blank" rel="noopener noreferrer"` (merged with existing rel, e.g. `sponsored`) plus a visually hidden "(opens in new tab)". Internal, relative, mailto:, tel: and #anchor links are untouched. Add `data-same-tab` to an `<a>` to opt out. It only runs on build, not `astro dev`.
