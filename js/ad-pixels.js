// Meta (Facebook/Instagram) and Reddit ad pixels for the newsletter ad test.
// Loaded only on /newsletter/ (PageView) and /newsletter/thanks/ (PageView + Lead = a newsletter signup),
// so Meta and Reddit can optimize ads for signups instead of clicks.
// Pixel IDs are public identifiers, not secrets. An empty ID turns that pixel off.
(function () {
  var META_PIXEL_ID = '1627095555828891';
  var REDDIT_PIXEL_ID = 'a2_jz9e1v2lgz8e';
  if (window.__nkAdPixels) return;
  window.__nkAdPixels = true;
  var isSignup = /\/newsletter\/thanks\/?$/.test(location.pathname);

  if (META_PIXEL_ID) {
    var f = window, b = document, n;
    if (!f.fbq) {
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      var s = b.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
      b.head.appendChild(s);
    }
    f.fbq('init', META_PIXEL_ID);
    f.fbq('track', 'PageView');
    if (isSignup) f.fbq('track', 'Lead', { content_name: 'Unlock the Week' });
  }

  if (REDDIT_PIXEL_ID) {
    var w = window, d = document;
    if (!w.rdt) {
      var p = w.rdt = function () { p.sendEvent ? p.sendEvent.apply(p, arguments) : p.callQueue.push(arguments); };
      p.callQueue = [];
      var t = d.createElement('script'); t.async = true; t.src = 'https://www.redditstatic.com/ads/pixel.js';
      d.head.appendChild(t);
    }
    w.rdt('init', REDDIT_PIXEL_ID);
    w.rdt('track', 'PageVisit');
    if (isSignup) w.rdt('track', 'SignUp');
  }
})();
