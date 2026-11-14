// Checkout return (05-conversion-tracking-spec, section 3): on a thanks page that Stripe redirects to after payment,
// sends Umami "checkout-return" and GA4 "purchase" once per Checkout Session. Loaded only on /pay/thanks/,
// /founders/guide/thanks/ and /follow-up-desk/thanks/. External file: the CSP forbids inline scripts.
//
// Fires only when the URL has a known offer= and a real-looking Checkout Session id (cs_live_/cs_test_), like the
// Google Ads conversion scripts, so a plain visit never counts. The session id is GA4's transaction_id (GA4 drops a
// repeat), and a sessionStorage mark stops a reload from counting twice in Umami. The session id itself is never sent
// to Umami. Test-mode sessions (cs_test_) are sent to Umami with mode=test and never to GA4.
// The /follow-up-desk/thanks/ redirect has no offer or session id yet, so nothing fires there until the Desk Payment
// Links are changed in Stripe (spec 6.B2).
//
// Prices are not written here: the page passes the sku price list from src/lib/checkout-ref.ts in data-skus.
// Trial skus (nothing is charged at checkout) report a purchase value of 0.
(function () {
  if (window.__nkCheckoutReturn) return;
  window.__nkCheckoutReturn = true;

  var me = document.currentScript;
  var skus = {};
  try { skus = JSON.parse((me && me.getAttribute('data-skus')) || '{}') || {}; } catch (e) {}

  // offer= value on the redirect -> default lane and the skus that redirect can belong to.
  var OFFERS = {
    'email-lockdown': { lane: 'smb', skus: ['email-auth-29'] },
    'founder-stack': { lane: 'founders', skus: ['founder-stack-29'] },
    'follow-up-desk': { lane: 'smb', skus: ['desk-founding-99m', 'desk-founding-891y', 'desk-250m'] }
  };

  var p;
  try { p = new URLSearchParams(location.search); } catch (e) { return; }
  var offer = OFFERS[p.get('offer') || ''];
  var sid = p.get('session_id') || '';
  var m = /^cs_(live|test)_[A-Za-z0-9]+$/.exec(sid);
  if (!offer || !m) return;
  var mode = m[1];

  function clean(v, max) {
    v = String(v || '').toLowerCase().trim();
    if (!v || v.indexOf('@') !== -1 || /\d{7,}/.test(v.replace(/[\s().+-]/g, ''))) return '';
    return v.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);
  }

  // Once per session id in this tab.
  try {
    if (sessionStorage.getItem('nk_ck_return') === sid) return;
    sessionStorage.setItem('nk_ck_return', sid);
  } catch (e) {}

  // The buy click on our site (set by checkout-attr.js), if it was for this offer and within the last day.
  var last = null;
  // Written by checkout-attr.js in localStorage (the buy link opened this tab with noopener); read once, then removed.
  try { last = JSON.parse(localStorage.getItem('nk_ck_last') || 'null'); localStorage.removeItem('nk_ck_last'); } catch (e) {}
  if (!last || offer.skus.indexOf(last.sku) === -1 || !(Date.now() - last.t < 86400000)) last = null;

  var sku = last ? last.sku : offer.skus.length === 1 ? offer.skus[0] : '';
  var lane = last && last.lane ? last.lane : offer.lane;
  var ref = last && /^[A-Za-z0-9_-]{1,200}$/.test(last.ref || '') ? last.ref : '';
  var info = skus[sku] || null;
  var value = info ? (info.trial ? 0 : Number(info.price) || 0) : undefined;

  var props = { lane: lane, sku: sku || 'unknown', mode: mode };
  var us = clean(p.get('utm_source'), 50), uc = clean(p.get('utm_campaign'), 50);
  if (us) props.utm_source = us;
  if (uc) props.utm_campaign = uc;
  if (ref) props.ref = ref;
  if (info && info.trial) props.trial = 'yes';

  var tries = 0;
  (function send() {
    if (window.umami && window.umami.track) return window.umami.track('checkout-return', props);
    if (++tries < 20) setTimeout(send, 250);
  })();

  if (mode !== 'live') return;
  try {
    if (typeof window.gtag === 'function') {
      var ev = { send_to: 'G-425106TVS2', transaction_id: sid, currency: 'USD', lane: lane };
      if (value !== undefined) ev.value = value;
      if (sku) ev.items = [{ item_id: sku, price: value || 0, quantity: 1 }];
      window.gtag('event', 'purchase', ev);
    }
  } catch (e) {}
})();
