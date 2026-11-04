# Deploy checklist (used by the site-shipper agent and by hand)

Preconditions: PR merged to `main`; Michael said "ship" (or the PR is covered by a standing approval recorded in the Decisions tab).

1. `git checkout main && git pull --ff-only origin main`
2. `rm -rf dist && SITE_URL=https://neonkey.tech BASE_PATH=/ PUBLIC_SITE_MODE=live npx astro build`
3. Confirm `dist/CNAME` says `neonkey.tech` and create `dist/.nojekyll`.
4. Publish `dist/` to `gh-pages` (orphan commit or worktree; keep CNAME and .nojekyll).
5. Wait for GitHub Pages, then `npm run indexnow`.
6. Regression checks against https://neonkey.tech:
   - crawl all internal links from the sitemap: expect 0 failures
   - every page contains the Umami script once
   - every page loads the Google tag exactly once (`AW-18547389944`); GA `G-425106TVS2` via the same loader
   - Impact meta tag present and unchanged
   - forms: /contact/ (Web3Forms), /newsletter/ (Kit form 10118914), /services/quiz/ and /free-it-kit/ (neonkey-quiz Worker) markup unchanged
   - /newsletter/thanks/ still fires the newsletter conversion
7. Record: commit SHAs for `main` and `gh-pages`, check results, date and time (AKST) in the PR or the Decisions/Scoreboard tab as appropriate.

If any check fails: do not re-run blindly. Report the failing check, the page, and the diff. Roll back by republishing the previous `gh-pages` commit only if the live site is broken for visitors.
