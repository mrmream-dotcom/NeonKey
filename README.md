# NeonKey

> **Unlock tech, whatever your level.**
> Static site built with [Astro](https://astro.build). One codebase builds a **demo** version (noindex, demo banner) or a **live** version (indexable, no banner), on any base path.

Going live? Follow **[LAUNCH.md](LAUNCH.md)**. It lists what is done and what still needs you.

## Build modes and environment variables

All settings are environment variables read at build time. Nothing needs editing in code.

| Variable | Default | What it does |
|---|---|---|
| `SITE_URL` | `https://neonkey.tech` | Origin used for canonical URLs, OG tags, sitemap and robots.txt |
| `BASE_PATH` | `/` | Sub-path the site is served from, e.g. `/NeonKey/` for GitHub Pages. Every internal link and asset follows it |
| `PUBLIC_SITE_MODE` | `demo` | `demo` = `noindex, nofollow` on every page, demo banner, robots.txt blocks crawling. `live` = indexable, no banner, robots.txt allows crawling and lists the sitemap |
| `PUBLIC_UMAMI_WEBSITE_ID` | *(unset)* | Umami website ID. The analytics script is only added when this is set |
| `PUBLIC_UMAMI_SRC` | `https://cloud.umami.is/script.js` | Umami script URL (change for self-hosted Umami) |
| `PUBLIC_UMAMI_DOMAINS` | *(unset)* | Optional comma-separated `data-domains`, e.g. `neonkey.tech`, so previews and localhost aren't counted |
| `PUBLIC_NEWSLETTER_PROVIDER` | *(unset)* | Set to `beehiiv` to turn on newsletter signups |
| `PUBLIC_BEEHIIV_EMBED_ID` | *(unset)* | beehiiv subscribe-form ID (embeds the beehiiv form) |
| `PUBLIC_BEEHIIV_FORM_URL` | *(unset)* | Alternative to the embed: your beehiiv subscribe page URL; the site's own form sends visitors there |
| `PUBLIC_CONTACT_EMAIL` | `hello@neonkey.tech` | Public contact address (placeholder until the inbox exists) |

Examples:

```bash
npm install
npm run build                                                     # demo, https://neonkey.tech, base /
PUBLIC_SITE_MODE=live npm run build                               # live build for neonkey.tech
BASE_PATH=/NeonKey/ SITE_URL=https://mrmream-dotcom.github.io npm run build   # GitHub Pages demo
npm run dev                                                       # dev server at http://localhost:4321
npx astro preview --port 4322 --host 127.0.0.1                    # serve ./dist
npm run assets                                                    # regenerate OG image + PNG icons (sharp)
```

Requires Node 22.23.4+ (developed on Node 24). `.env` files work too (see Astro's env docs); don't commit real IDs if you'd rather keep them out of git.

## Analytics: Umami

Umami is cookieless and doesn't collect personal data, so it needs no cookie banner. The privacy page switches its wording automatically when an ID is set.

**Set up**
1. Create a free account at [cloud.umami.is](https://cloud.umami.is).
2. **Settings → Websites → Add website.** Name: NeonKey. Domain: `neonkey.tech` (or the Pages preview domain while testing).
3. Open the website's settings and copy the **Website ID** (a UUID).
4. Set `PUBLIC_UMAMI_WEBSITE_ID=<that id>` in Cloudflare Pages (**Settings → Environment variables**) or locally, then rebuild. Optionally set `PUBLIC_UMAMI_DOMAINS=neonkey.tech`.

**Test it**
1. Build and serve with the ID set: `PUBLIC_UMAMI_WEBSITE_ID=<id> npm run build && npx astro preview --port 4322 --host 127.0.0.1` (leave `PUBLIC_UMAMI_DOMAINS` unset for local tests, or localhost won't be counted).
2. Open the site in a normal browser window and open devtools → **Network**:
   - `script.js` from `cloud.umami.is` loads with status **200**.
   - A request to **`/api/send`** (Umami Cloud's collection endpoint) returns **200** on each page view and on tracked clicks.
3. In Umami, open the website's **Realtime** view: you should appear as a current visitor within a few seconds.
4. Click a tracked button (e.g. Services "Ask about this"); the event shows under **Events**.
5. Ad-blockers and privacy extensions (uBlock Origin, Brave Shields and others) often block Umami. If nothing shows up, test in a clean profile with extensions off.

**Tracked events** (via `data-umami-event` attributes, no extra JS):

| Event | Where | Extra data |
|---|---|---|
| `newsletter-cta` | Header "Newsletter" button, home hero | `location` |
| `newsletter-signup` | Signup submit (link mode) | `form`, `provider` |
| `newsletter-form-focus` | First interaction with an embedded beehiiv form (embed mode; real signups are counted in beehiiv) | `form`, `provider` |
| `services-cta` | Service "Ask about this" / "See what's included" buttons, home and Lab CTAs | `offer`, `location` |
| `contact-click` / `contact-submit` | Contact links, email links, contact form | `location`, `offer` |
| `lab-cta` | "See the builds" / "All builds" links | `location` |
| `lab-filter` | Lab tag filter chips | `tag` |
| `affiliate-click` | Review "where to buy" buttons | `item`, `retailer` |
| `outbound-click` | Selected outbound links | `item` |

## Newsletter: Unlock the Week (beehiiv)

With no newsletter variables set, every signup form shows a clear **Coming soon** state: the field and button are disabled and nothing is collected. To turn it on:

- **Embed (recommended):** in beehiiv, **Subscribers → Subscribe forms → create a form → Get embed code**. The code contains `https://subscribe-forms.beehiiv.com/<FORM-ID>`. Set `PUBLIC_NEWSLETTER_PROVIDER=beehiiv` and `PUBLIC_BEEHIIV_EMBED_ID=<FORM-ID>`.
- **Link:** set `PUBLIC_NEWSLETTER_PROVIDER=beehiiv` and `PUBLIC_BEEHIIV_FORM_URL=https://<your-publication>.beehiiv.com/subscribe`. The site's form opens that page in a new tab (the email is passed as `?email=`; check whether beehiiv pre-fills it).

beehiiv docs: [Creating an embedded subscribe form](https://www.beehiiv.com/support/article/12977090590487-creating-an-embedded-subscribe-form). `public/_headers` already allows beehiiv's form script and iframe.

## Hosting files

- `public/_headers`: Cloudflare Pages security headers (CSP allowing Umami Cloud and beehiiv forms, nosniff, Referrer-Policy, Permissions-Policy, `frame-ancestors 'none'`) and long caching for `/_astro/*`.
- `public/_redirects`: a few short URLs (`/portfolio`, `/weekly`, `/subscribe`, `/it`).
- Both are ignored by GitHub Pages and `astro preview`.
- The build emits no inline scripts or stylesheets (`build.inlineStylesheets: 'never'`, `assetsInlineLimit: 0`), so the strict `script-src` works. Inline `style=""` attributes are used, so `style-src` includes `'unsafe-inline'`.
- `robots.txt` and `site.webmanifest` are generated per mode and base (`src/pages/robots.txt.ts`, `src/pages/site.webmanifest.ts`). The sitemap comes from `@astrojs/sitemap` (`/sitemap-index.xml`).

## Pages

| Route | Page |
|---|---|
| `/` | Home: hero, four Unlock pillars, tutorials, From the Lab strip, featured review, newsletter, services teaser |
| `/learn/`, `/learn/self-host-n8n-old-pc/` | Learn index and a sample tutorial |
| `/lab/` + 3 case studies | Lab portfolio with tag filters (sample write-ups) |
| `/reviews/`, `/reviews/example-mini-pc-homelab/` | Reviews index and a sample review |
| `/notes/`, `/notes/what-unlock-means/` | Notes index and a sample article |
| `/newsletter/` | Unlock the Week: what you get, cadence, privacy, sample issue format |
| `/services/` | Featured Remote Small-Office IT Setup plus three automation services |
| `/services/remote-it/` | Remote Small-Office IT Setup & the monthly remote support plan: scope, exclusions, pricing |
| `/about/`, `/disclosure/`, `/privacy/`, `/contact/` | Footer pages (privacy is a draft; the contact form isn't connected) |
| `/404` | Not found |

## Project structure

```
public/            favicon.svg + generated PNG icons, og-default.png, _headers, _redirects
scripts/           generate-assets.mjs (sharp: OG image and icons)
src/config.ts      env-driven settings and the base-aware url() helper
src/components/    Logo, DemoBadge, Card, NewsletterForm
src/data/          lab.ts (Lab projects), services.ts (service offers and prices)
src/layouts/       Base.astro (head/meta, nav, footer, Umami), LabProject.astro
src/pages/         one file per route, plus robots.txt.ts and site.webmanifest.ts
docs/              pages.yml.example (GitHub Pages workflow copy), pricing-research.md
screenshots/       reference screenshots
```

Internal links must use `url('/path/')` from `src/config.ts` so they respect `BASE_PATH`.

## Deploying

- **Cloudflare Pages (production):** see [LAUNCH.md](LAUNCH.md).
- **GitHub Pages (demo preview):** `.github/workflows/pages.yml` builds with `BASE_PATH=/NeonKey/` and deploys with `actions/deploy-pages` once **Settings → Pages → Source** is set to **GitHub Actions**. A copy lives at `docs/pages.yml.example`. The `gh-pages` branch currently holds a manual demo build.
