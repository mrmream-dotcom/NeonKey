// Google Ads conversion: "Submit lead form" (ID 7883745794) = newsletter signup.
// Loaded only on /newsletter/thanks/, where Kit form 10118914 redirects after a signup.
// Runs after gtag-init.js (loaded in <head>), so gtag() and the AW config already exist.
(function () {
  if (window.__nkNewsletterConv) return;
  window.__nkNewsletterConv = true;
  if (typeof gtag === 'function') {
    gtag('event', 'conversion', { send_to: 'AW-18547389944/37MFCILUoa8dEPjrioxF' });
  }
})();
