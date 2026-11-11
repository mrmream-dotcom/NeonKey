// Google Ads conversion: "Lockdown purchase" ($29 Email Lockdown, Category Purchase, Count = One).
// Loaded only on /pay/thanks/. The Email Lockdown Stripe Payment Link redirects there after payment as
//   /pay/thanks/?offer=email-lockdown&session_id={CHECKOUT_SESSION_ID}
// It fires only when that offer and a real-looking Checkout Session id (cs_live_/cs_test_) are in the URL,
// so a plain visit to the page never counts as a sale. The session id is sent as transaction_id, so a
// reload of the same page is de-duplicated by Google Ads.
// Runs after gtag-init.js (loaded in <head>), so gtag() and the AW config already exist.
(function () {
  // Filled in from Google Ads: Goals > Conversions > Lockdown purchase > Tag setup > Use Google tag.
  var SEND_TO = 'AW-18547389944/0tWyCJHetbIdEPjrioxF';
  if (!SEND_TO || window.__nkLockdownConv) return;
  var p = new URLSearchParams(window.location.search);
  var sid = p.get('session_id') || '';
  if (p.get('offer') !== 'email-lockdown' || !/^cs_(live|test)_[A-Za-z0-9]+$/.test(sid)) return;
  window.__nkLockdownConv = true;
  if (typeof gtag === 'function') {
    gtag('event', 'conversion', { send_to: SEND_TO, value: 29.0, currency: 'USD', transaction_id: sid });
  }
})();
