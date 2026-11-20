// Funnel events (Michael's Nov 19 2026 conversion directive, phase 8). Umami custom events with the directive's names,
// sent alongside the older events (nothing existing is renamed, so past reports still line up). No form field values,
// names or emails are ever sent. Runs regardless of reduced motion.
//   hero_cta_click      - data-umami-event="hero_cta_click" on the homepage hero buttons (no JS needed)
//   demo_started / demo_completed - the homepage Desk demo (DeskDemo.astro) and the Lab demo form
//   pricing_viewed      - once per page view, when an element with data-track-view="pricing" is half on screen
//   quote_form_started  - first interaction with the contact form (redirect to /contact/thanks/)
//   quote_form_submitted- /js/conv-contact.js, only after Web3Forms accepted the message
//   checkout_completed  - /js/checkout-return.js, only on a real Stripe return (cs_live_/cs_test_ session id)
type Props = Record<string, string>;
export function track(name: string, props: Props = {}) {
  let tries = 0;
  const send = () => {
    const u = (window as any).umami;
    if (u?.track) return u.track(name, props);
    if (++tries < 20) setTimeout(send, 250);
  };
  send();
}

const page = location.pathname;

// pricing_viewed
const pricing = document.querySelectorAll<HTMLElement>('[data-track-view="pricing"]');
if (pricing.length && 'IntersectionObserver' in window) {
  let seen = false;
  const io = new IntersectionObserver((entries) => {
    if (seen || !entries.some((e) => e.isIntersecting)) return;
    seen = true; io.disconnect();
    track('pricing_viewed', { page });
  }, { threshold: 0.35 });
  pricing.forEach((el) => io.observe(el));
}

// quote_form_started
document.querySelectorAll<HTMLFormElement>('form').forEach((form) => {
  const redirect = form.querySelector<HTMLInputElement>('input[name="redirect"]')?.value || '';
  if (!/\/contact\/thanks\/?$/.test(redirect)) return;
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    const topic = form.querySelector<HTMLSelectElement>('[name="topic"]')?.value || '';
    track('quote_form_started', { page, topic: topic.slice(0, 60) });
  };
  form.addEventListener('focusin', start, { once: true });
  form.addEventListener('input', start, { once: true });
});

// Lab Follow-Up Desk demo (its own page): count runs as demo_started too.
document.querySelector('[data-fud-form]')?.addEventListener('submit', () => track('demo_started', { demo: 'follow-up-desk', location: 'lab' }));
document.querySelector('[data-fud-reply]')?.addEventListener('click', () => track('demo_completed', { demo: 'follow-up-desk', location: 'lab' }));
