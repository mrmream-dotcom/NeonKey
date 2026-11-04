# NeonKey site: rules for coding agents

Astro 7 static site for https://neonkey.tech, served by GitHub Pages from the `gh-pages` branch (custom domain via `public/CNAME`). Cloudflare Workers under `workers/` back the Lab demos, quiz, newsletter emails and phone relay.

## Build and check
- Build exactly as production does: `rm -rf dist && SITE_URL=https://neonkey.tech BASE_PATH=/ PUBLIC_SITE_MODE=live npx astro build`
- CI (`.github/workflows/ci.yml`) only confirms the build compiles. It does not deploy.
- Timed Learn releases (`.github/workflows/timed-release.yml`, approved by Michael Nov 4 2026): on each go-live date in `src/data/learn-schedule.json` it rebuilds and publishes to `gh-pages`, but only if main has no unshipped site changes. Running it by hand from the Actions tab is a full ship. Its pre-publish checks live in `scripts/release-checks.mjs`.
- Secrets scan: `security.yml` runs gitleaks on every push. `.gitleaks.toml` allowlists one false positive.

## Deploy (only after a PR is merged to `main` and Michael says ship)
1. Build as above from `main`.
2. Publish `dist/` to `gh-pages`, keeping `CNAME` and `.nojekyll`.
3. Run `npm run indexnow`.
4. Regression checks, all must pass or report and stop:
   - crawl every internal link: 0 failures
   - Umami script present on every page
   - Google tag (`AW-18547389944`, GA `G-425106TVS2`) loads exactly once per page
   - Impact meta tag unchanged
   - contact, newsletter, quiz and free-kit form markup unchanged
   - `/newsletter/thanks/` still fires its conversion
See `docs/deploy-checklist.md` for the full list and commands.

## Content Security Policy
`public/_headers` is the single source for the CSP. `integrations/csp-meta.mjs` copies it into a `<meta>` tag on every page at build time and hashes inline scripts. Any new external script, image, form or fetch host must be added to `public/_headers` first, with a comment saying what it is for, or the browser silently blocks it.

## Workers
One folder per Worker in `workers/`, each with its own README, `package.json` and wrangler config. They share nothing. Every outbound email is From `NeonKey 🔑 <hello@neonkey.tech>` with BCC to the `BCC_ADDRESS` var. Secrets are never in the repo or in chat: Michael sets them in the Cloudflare dashboard or with `wrangler secret put`.

## Copy rules (anything a visitor can read)
- "NeonKey" is one word. Public byline is "Michael Ream", never "Mike".
- American spelling. Never the phrase "plain English". Beginner-friendly, apolitical.
- No guarantees, no invented numbers, quotes, reviews or clients.
- Credential wording: "Computer Installation and Repair Technician certificate from the California Institute of Applied Technology (CIAT)". Never claim Security+ or Network+.
- Never position NeonKey as a marketing agency. Never mention military service. No headshots.
- Prices live in `src/pages/` and `src/data/`; changing one needs Michael's explicit OK in the PR.

## Agents
Recurring jobs are defined in `.claude/agents/` (site-shipper, pipeline-clerk, scoreboard). They mirror scheduled tasks in the NeonKey Claude Project; business rules live in that project's memory, this file holds only code and site rules.

## Reporting: Founder Technical Brief
Add this to the final report of meaningful technical work only: a new system, an architecture or security choice, a new tool or integration, or a real incident. Skip it for routine runs, copy edits, cosmetic changes and repeated work.
- **Built:** what was implemented. **Why:** the key technical decision and its reasoning. **Concept:** one relevant engineering concept, explained simply. **Implication:** why it matters to NeonKey or to Michael's technical growth.
- 50-100 words, written from what you already know about the work. Do no extra research for it.
- Check the "Covered concepts" table in the project's `founder-learning/competence-log.md` first. If the concept is already covered, link it in one line.
- On security, customer data, auth, money or production, add **Gap:** when Michael needs to understand something to decide safely. Validate those systems properly; never rely on familiarity or an agent's confidence.
- Never treat a brief or an approval as evidence of competence.

## Never
- Print or commit a secret, token or API key.
- Push to `gh-pages` without the regression checks passing.
- Skip or disable a check to get green.
- Change `public/CNAME` or `.nojekyll`.
