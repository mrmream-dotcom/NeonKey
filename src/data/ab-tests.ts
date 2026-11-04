// Live A/B tests. The site is static (GitHub Pages), so the split happens in the visitor's browser:
// a tiny inline script in Base.astro puts each visitor in variant "a" or "b" per test (50/50, kept in
// localStorage so they always see the same version) and sets <html data-ab-<id>="a|b">.
// Markup for each variant carries data-ab="<id>:a" or data-ab="<id>:b"; CSS in global.css hides the
// other one. Without JavaScript, everyone sees "a" (the control).
//
// Measuring (Umami): on any page that shows a test, Umami gets one `ab-view` event with the variants
// shown (e.g. { hero: "b" }). Once a visitor has seen a test, every tracked click on any page (including
// `contact-submit` on /contact/) gets an `ab-<id>` property. Compare clicks and submits per `ab-view`. Preview a variant with ?ab=hero:b,cards:b (not saved).
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
  {
    id: 'cards',
    a: 'Service cards titled with the service name',
    b: 'Service cards titled with the outcome, service name as a small label',
    started: 'on ship',
  },
  {
    id: 'hero',
    a: 'Home hero: "Office IT and practical AI for small businesses."',
    b: 'Home hero: outcome-first ("Catch every lead. Answer every customer.")',
    started: 'on ship',
  },
];
