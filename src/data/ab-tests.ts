// Live A/B tests. The site is static (GitHub Pages), so the split happens in the visitor's browser:
// a tiny inline script in Base.astro puts each visitor in variant "a" or "b" per test (50/50, kept in
// localStorage so they always see the same version) and sets <html data-ab-<id>="a|b">.
// Markup for each variant carries data-ab="<id>:a" or data-ab="<id>:b"; CSS in global.css hides the
// other one. Without JavaScript, everyone sees "a" (the control).
//
// Measuring (Umami): on any page that shows a test, Umami gets one `ab-view` event with the variants
// shown (e.g. { hero: "b" }). Once a visitor has seen a test, every tracked click on any page (including
// `contact-submit` on /contact/) gets an `ab-<id>` property. Compare clicks and submits per `ab-view`. Submit events count only real submits (data-umami-submit, see Base.astro). Preview a variant with ?ab=hero:b (not saved).
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
  // `hero` restarted Nov 6 2026 with two outcome headlines; the old "Office IT and practical AI" control was retired.
  {
    id: 'hero',
    a: 'Home hero: pain-first ("Stop losing leads to slow replies and forgotten follow-ups.")',
    b: 'Home hero: question-first ("How many inquiries went unanswered last month?")',
    started: 'on ship (restarted Nov 2026)',
  },
  {
    id: 'nl',
    a: '/newsletter/: original page ("Unlock the Week" title, long intro, pills, subscribe card)',
    b: '/newsletter/: calmer page ("One small tech fix, every Wednesday.", visible email label, form on the first phone screen, fix topics, form again)',
    started: 'on ship (Nov 2026)',
  },
];
