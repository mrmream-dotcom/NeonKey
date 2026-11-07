// Google Ads conversion: "Founder guide purchase" (The Founder Stack, $97, Category Purchase, Count = Every).
// Loaded only on /founders/guide/thanks/. The Founder Stack Stripe Payment Link redirects there after payment as
//   /founders/guide/thanks/?offer=founder-stack&session_id={CHECKOUT_SESSION_ID}
// It fires only when that offer and a real-looking Checkout Session id (cs_live_/cs_test_) are in the URL,
// so a plain visit to the page never counts as a sale. The session id is sent as transaction_id, so a
// reload of the same page is de-duplicated by Google Ads.
// Runs after gtag-init.js (loaded in <head>), so gtag() and the AW config already exist.
(function () {
  // Filled in from Google Ads: Goals > Conversions > Founder guide purchase > Tag setup > Use Google tag.
  var SEND_TO = 'AW-18547389944/TclFCLWH4bMdEPjrioxF';
  if (!SEND_TO || window.__nkFounderConv) return;
  var p = new URLSearchParams(window.location.search);
  var sid = p.get('session_id') || '';
  if (p.get('offer') !== 'founder-stack' || !/^cs_(live|test)_[A-Za-z0-9]+$/.test(sid)) return;
  window.__nkFounderConv = true;
  if (typeof gtag === 'function') {
    gtag('event', 'conversion', { send_to: SEND_TO, value: 97.0, currency: 'USD', transaction_id: sid });
  }
})();
