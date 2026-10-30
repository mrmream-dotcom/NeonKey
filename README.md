# NeonKey: demo site

> **Unlock tech, whatever your level.**
> This is a **demo build** and is not live. Every page has `noindex, nofollow`. All articles, reviews and numbers are placeholder content and are marked with a "Demo content" badge.

Static site built with [Astro](https://astro.build) (static output, no client framework, one small inline script for the mobile menu and demo forms).

## Pages

| Route | Page |
|---|---|
| `/` | Home: hero, four Unlock pillars, latest tutorials, featured review, newsletter signup, services teaser, learning-in-public note |
| `/learn/` | Learn index |
| `/learn/self-host-n8n-old-pc/` | Sample tutorial |
| `/reviews/` | Reviews index |
| `/reviews/example-mini-pc-homelab/` | Sample review: FTC disclosure, pros/cons, verdict, where-to-buy |
| `/notes/` | Notes index |
| `/notes/what-unlock-means/` | Sample article |
| `/newsletter/` | NeonKey Weekly signup (demo form) and sample archive issue |
| `/services/` | Unlock AI Module 1 offers and a "Coming later" strip |
| `/about/`, `/disclosure/`, `/privacy/`, `/contact/` | Footer pages (privacy is a placeholder; the contact form isn't connected) |
| `/404` | Not found |

## Run locally

Requires Node 18.20+ (developed on Node 24).

```bash
npm install
npm run dev       # dev server at http://localhost:4321
npm run build     # static files written to ./dist
npm run preview   # serve ./dist at http://localhost:4321
```

## Project structure

```
public/            favicon.svg (neon key mark)
src/components/    Logo, DemoBadge, Card, NewsletterForm
src/layouts/       Base.astro (head + noindex, header/nav, footer)
src/pages/         one .astro file per route
src/styles/        global.css (design tokens, layout, components)
screenshots/       reference screenshots of the demo
```

## Before going live (checklist)

- [ ] Buy the domain (preferred: `neonkey.tech`) and set `site` in `astro.config.mjs`.
- [ ] Remove `<meta name="robots" content="noindex, nofollow">` from `src/layouts/Base.astro`, and remove the demo strip.
- [ ] Replace demo content and remove the `DemoBadge` components.
- [ ] Wire the newsletter form to your email provider and the contact form to a form backend.
- [ ] Replace affiliate `#` links with real tracked links (keep `rel="sponsored nofollow"`).
- [ ] Write a real privacy policy and have the disclosure reviewed.
- [ ] Add analytics only if it's disclosed in the privacy policy.

## Deploy later

### Cloudflare Pages
1. Push this repo to GitHub.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and pick the repo.
3. Framework preset: **Astro**. Build command: `npm run build`. Output directory: `dist`.
4. Add the custom domain under the project's **Custom domains** tab.

### GitHub Pages
1. In the repo, go to **Settings → Pages → Source: GitHub Actions**.
2. Add `.github/workflows/deploy.yml` using Astro's official action (see https://docs.astro.build/en/guides/deploy/github/):

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: withastro/action@v3
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

3. If you deploy to `https://<user>.github.io/<repo>/` without a custom domain, set `base: '/<repo>'` in `astro.config.mjs` and update the internal links to match.

The workflow isn't included on purpose, so pushing the repo won't publish the demo by accident.
