// Live A/B tests. The site is static (GitHub Pages), so the split happens in the visitor's browser:
// a tiny inline script in Base.astro puts each visitor in variant "a" or "b" per test (50/50, kept in
// localStorage so they always see the same version) and sets <html data-ab-<id>="a|b">.
// Markup for each variant carries data-ab="<id>:a" or data-ab="<id>:b"; CSS in global.css hides the
// other one. Without JavaScript, everyone sees "a" (the control).
//
// Measuring (Umami): on any page that shows a test, Umami gets one `ab-view` event with the variants
// shown (e.g. { hero: "b" }). Once a visitor has seen a test, every tracked click on any page (including
// `contact-submit` on /contact/) gets an `ab-<id>` property. Compare clicks and submits per `ab-view`. Submit events count only real submits (data-umami-submit, see Base.astro). Preview a variant with ?ab=nl:b (not saved).
//
// Every test here needs a 'live' entry in src/data/experiments.json (hypothesis, metric, guardrails, minimum sample);
// release-checks fails otherwise. Rules for price tests: docs/experiments.md.
//
// To end a test: keep the winner's markup, delete the loser's and the data-ab attributes, remove the
// id here and its CSS rule. Results and dates live in /mnt/project-files/site-tests/ab-log.md.
export interface AbTest {
  id: string;
  /** What "a" (control) and "b" show. */
  a: string;
  b: string;
  started: string;
}

export const abTests: AbTest[] = [
  // `cards` ended Nov 6 2026: outcome headlines kept everywhere (lost-revenue repositioning, Michael's call).
  // `hero` ended Nov 7 2026: Michael wanted one broader headline that covers all services (not lead follow-up only).
  {
    id: 'nl',
    a: '/newsletter/: original page ("Unlock the Week" title, long intro, pills, subscribe card)',
    b: '/newsletter/: calmer page ("One small tech fix, every Wednesday.", visible email label, form on the first phone screen, fix topics, form again)',
    started: 'on ship (Nov 2026)',
  },
  {
    id: 'motion',
    a: 'home hero: still background (faint key art, soft glow)',
    b: 'home hero: same content plus a slow neon motion background (drifting glows and a moving grid floor, CSS only, off for reduced motion)',
    started: 'on ship (Nov 2026)',
  },
];
