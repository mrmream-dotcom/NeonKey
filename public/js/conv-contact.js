// Confirmed contact inquiry (audit Nov 7 2026, A5). Loaded only on /contact/thanks/.
// Web3Forms redirects there only after it accepts a contact message. This counts one accepted inquiry, and only
// when Base.astro's contact submit handler left a fresh "nk_contact_submit" mark in this tab's sessionStorage.
// The mark is removed right away, so a direct visit, a bookmark or a reload of the thanks page never counts.
// Kept separate from the "contact-submit" Umami event, which counts submit attempts (useful for spotting drop-off).
// Sends:
//   - Umami "contact-confirmed" (with the topic the visitor picked; no name, email or message)
//   - GA4 "generate_lead" via the Google tag already loaded by gtag-init.js. Mark generate_lead as a key event in
//     GA4 (Admin > Events) and, if wanted, import it into Google Ads as a conversion. Nothing here invents a
//     Google Ads conversion label; add one as SEND_TO below only after Michael creates the conversion action.
// The mark's id goes along as transaction_id so a duplicate is dropped.
(function () {
  var SEND_TO = ''; // Optional Google Ads conversion label, e.g. 'AW-18547389944/xxxx'. Empty = not sent.
  var MAX_AGE_MS = 30 * 60 * 1000;
  if (window.__nkContactConv) return;
  window.__nkContactConv = true;
  var mark = null;
  try {
    mark = JSON.parse(sessionStorage.getItem('nk_contact_submit') || 'null');
    sessionStorage.removeItem('nk_contact_submit');
  } catch (e) { return; }
  if (!mark || typeof mark.id !== 'string' || typeof mark.t !== 'number') return;
  var age = Date.now() - mark.t;
  if (age < 0 || age > MAX_AGE_MS) return;
  var id = mark.id.slice(0, 64);
  var topic = typeof mark.topic === 'string' ? mark.topic.slice(0, 60) : '';
  if (typeof gtag === 'function') {
    gtag('event', 'generate_lead', { lead_source: 'contact_form', topic: topic, transaction_id: id });
    if (SEND_TO) gtag('event', 'conversion', { send_to: SEND_TO, transaction_id: id });
  }
  // Umami's script loads async, so wait briefly for it (up to ~5 seconds).
  var tries = 0;
  (function umamiTrack() {
    if (window.umami && typeof window.umami.track === 'function') { window.umami.track('contact-confirmed', { topic: topic }); return; }
    if (++tries < 20) setTimeout(umamiTrack, 250);
  })();
})();
