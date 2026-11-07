// Google Ads conversion: "Sign-up" (newsletter signup for Unlock the Week, value $1).
// Loaded only on /newsletter/thanks/, where Kit form 10118914 redirects after it accepts an email.
// Every newsletter form on the site (both sides of the /newsletter/ A/B test, home, Learn) posts to that
// same Kit form, so all real signups land here.
// It fires only when Base.astro's newsletter submit handler left a fresh "nk_nl_submit" mark in this tab's
// sessionStorage (set at the same moment as the Umami "newsletter-signup" event). The mark is removed
// right away, so a direct visit, a bookmark or a reload of the thanks page never counts. The mark's id is
// sent as transaction_id so Google Ads also drops any duplicate.
// Runs after gtag-init.js (loaded in <head>), so gtag() and the AW config already exist.
(function () {
  // From Google Ads: Goals > Conversions > Sign-up > Tag setup > Use Google tag.
  var SEND_TO = 'AW-18547389944/HptaCPexjbQdEPjrioxF';
  var MAX_AGE_MS = 30 * 60 * 1000;
  if (!SEND_TO || window.__nkNewsletterConv) return;
  window.__nkNewsletterConv = true;
  var mark = null;
  try {
    mark = JSON.parse(sessionStorage.getItem('nk_nl_submit') || 'null');
    sessionStorage.removeItem('nk_nl_submit');
  } catch (e) { return; }
  if (!mark || typeof mark.id !== 'string' || typeof mark.t !== 'number') return;
  var age = Date.now() - mark.t;
  if (age < 0 || age > MAX_AGE_MS) return;
  if (typeof gtag === 'function') {
    gtag('event', 'conversion', { send_to: SEND_TO, value: 1.0, currency: 'USD', transaction_id: mark.id.slice(0, 64) });
  }
})();
