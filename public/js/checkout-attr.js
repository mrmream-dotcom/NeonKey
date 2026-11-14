// Checkout attribution (05-conversion-tracking-spec, sections 3-4). Loaded on every page from Base.astro, after
// gtag-init.js. External file because the CSP forbids inline scripts; it needs no new CSP host (it only rewrites links
// to buy.stripe.com, which are plain navigations, and calls the gtag() that gtag-init.js already defines).
//
// 1. First touch: on the first page of a visit, keeps the UTM tags from the URL in sessionStorage (this tab only).
// 2. Buy links: every Stripe buy button already carries client_reference_id=nk1_<lane>_<sku>_<location> from the build
//    (src/lib/checkout-ref.ts), so it works with JavaScript off. Here we add "_<src>" (the first-touch utm_source, or
//    "direct") and pass the UTM tags to Stripe, which hands them back on the after-payment redirect.
// 3. On a buy click: sends GA4 begin_checkout, and remembers lane/sku/ref for /js/checkout-return.js on the thanks page.
//
// Privacy: UTM values are cleaned to [a-z0-9._-]; anything that looks like an email or a phone number is dropped, so no
// personal data goes into the ref or the UTMs passed to Stripe. Every sessionStorage access is wrapped in try/catch;
// if storage is blocked the buttons still work, they just keep the build-time ref.
(function () {
  if (window.__nkCheckoutAttr) return;
  window.__nkCheckoutAttr = true;

  var GA4 = 'G-425106TVS2';
  var REF_OK = /^[A-Za-z0-9_-]{1,200}$/;
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  var KEY_FIRST = 'nk_ck_first';
  var KEY_LAST = 'nk_ck_last';

  function clean(v, max) {
    v = String(v || '').toLowerCase().trim();
    if (!v || v.indexOf('@') !== -1 || /\d{7,}/.test(v.replace(/[\s().+-]/g, ''))) return '';
    return v.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);
  }
  function load(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function save(key, val) {
    try { sessionStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  // The last buy click goes in localStorage: buy links open a new tab with noopener, and sessionStorage is per tab,
  // so the thanks page (in that new tab) could not read it otherwise. It holds no personal data and is removed
  // by checkout-return.js once read (and ignored after a day).
  function saveShared(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  // 1. First touch (only the first page of this tab's visit sets it).
  var first = load(KEY_FIRST);
  if (!first || typeof first !== 'object') {
    first = {};
    try {
      var q = new URLSearchParams(location.search);
      UTM.forEach(function (k) { var c = clean(q.get(k), 100); if (c) first[k] = c; });
    } catch (e) {}
    save(KEY_FIRST, first);
  }
  var src = (first.utm_source || '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'direct';

  // 2. Add src to the ref and the UTMs to each buy link (href and the Umami ref prop stay in step).
  function tagLinks() {
    var links = document.querySelectorAll('a[data-umami-event-ref][href^="https://buy.stripe.com/"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute('data-nk-ck') === '1') continue;
      try {
        var base = a.getAttribute('data-umami-event-ref') || '';
        if (!REF_OK.test(base)) continue;
        var ref = base + '_' + src;
        if (!REF_OK.test(ref)) ref = base;
        var u = new URL(a.href);
        u.searchParams.set('client_reference_id', ref);
        UTM.forEach(function (k) { if (first[k] && !u.searchParams.has(k)) u.searchParams.set(k, first[k]); });
        a.href = u.toString();
        a.setAttribute('data-umami-event-ref', ref);
        a.setAttribute('data-umami-event-src', src);
        a.setAttribute('data-nk-ck', '1');
      } catch (e) {}
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tagLinks);
  else tagLinks();

  // 3. Buy click: GA4 begin_checkout (GA4 only, not the Ads tag) and a note for the thanks page.
  function onBuy(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-umami-event-ref][href^="https://buy.stripe.com/"]') : null;
    if (!a) return;
    if (e.type === 'auxclick' && e.button !== 1) return; // middle click opens the link; right click does not
    var sku = a.getAttribute('data-umami-event-sku') || '';
    var lane = a.getAttribute('data-umami-event-lane') || '';
    var ref = a.getAttribute('data-umami-event-ref') || '';
    var price = Number(a.getAttribute('data-umami-event-price')) || 0;
    saveShared(KEY_LAST, { lane: lane, sku: sku, ref: ref, t: Date.now() });
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'begin_checkout', {
          send_to: GA4,
          currency: 'USD',
          value: price,
          items: [{ item_id: sku, item_name: a.getAttribute('data-umami-event-offer') || sku, price: price, quantity: 1 }],
          lane: lane,
          checkout_location: a.getAttribute('data-umami-event-location') || '',
          checkout_ref: ref,
          transport_type: 'beacon'
        });
      }
    } catch (err) {}
  }
  document.addEventListener('click', onBuy, true);
  document.addEventListener('auxclick', onBuy, true);
})();
