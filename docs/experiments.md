# Experiments: how NeonKey tests prices, offers and pages

Set up Nov 12 2026 (growth directive). The registry is `src/data/experiments.json`; the switch for page tests is
`src/data/ab-tests.ts`; `scripts/release-checks.mjs` (check 8) refuses a release that breaks these rules.

## Rules

1. **One registry entry per test**, before it goes live: hypothesis, primary metric, guardrails, baseline, minimum
   views per arm and when to read it. A live test without an entry fails the release.
2. **Baselines are measured numbers or "none yet".** Never estimate a baseline into the registry.
3. **Price and offer tests need Michael's written OK** in `ownerOk` (his words and the date). Changing a price is his
   call (repo CLAUDE.md). The check blocks a live `price` or `offer` test without it.
4. **Every visitor pays exactly the price they were shown.** A price arm gets its own Stripe Payment Link at that
   price. The page never shows one price and charges another, and nobody is told a price is "going up" unless it
   really is, on a real date.
5. **One test per page at a time**, and at most one test that touches checkout across the whole site.
6. **No winner before the minimum.** Read results only after `minPerArm` views in each arm. Below that, the
   scoreboard says "too early". A presentation test needs at least 100 views per arm; anything judged on purchases
   needs far more (see below).
7. **Guardrails beat the metric.** If a guardrail breaks (refunds up, signups down, page slower), stop the test even
   if the primary metric looks better.
8. **Log the outcome** in `/mnt/project-files/site-tests/ab-log.md`, then remove the loser's markup and the entry's
   `ab-tests.ts` line, and set the registry entry to `ended` with the result.

## How much traffic a test needs (rough guide)

To tell a 1% purchase rate from a 2% one with reasonable confidence, each arm needs roughly 2,300 visitors
(rule of thumb n ≈ 16·p(1−p)/δ², with p ≈ 1.5% and δ = 1 point). Measured traffic is far below that today: GA showed
about 757 visits in the 30 days to Nov 7 2026, most from paid ads. So:

- **Run now:** page and wording tests judged on clicks or signups, where 100 views per arm can show a large gap.
- **Queue, don't run:** price tests and anything judged on purchases. They stay `draft` until a page has the traffic
  in its `readOn` line. Until then, change one thing at a time on purpose and compare week over week, labeled as
  "before/after, not a controlled test".

## Measuring

- Views and clicks: Umami `ab-view` plus the event on the button (`buy-click`, `newsletter-signup`, and so on). Umami
  submit counts run high, so confirm signups in Kit and purchases in Stripe.
- Purchases: Stripe, by Payment Link (each arm has its own link, so the split is exact).
- Refunds: Stripe refunds by Payment Link.

## Currently registered

See `src/data/experiments.json`. As of Nov 12 2026: `nl` and `motion` are live (presentation only).
`desk-plan-order` (presentation) and `lockdown-price` (price, needs Michael's OK and far more traffic) are drafts.
