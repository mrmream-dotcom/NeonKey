// Site-wide motion (Nov 2026 premium pass). GSAP + ScrollTrigger + SplitText (free, standard GSAP license) and Lenis
// (MIT) smooth scrolling, all bundled and self-hosted, so the CSP stays script-src 'self'.
// Rules: content is fully visible without JavaScript; nothing runs when the visitor asks for reduced motion;
// no motion on form fields; touch devices keep native scrolling.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Header gets denser once the page scrolls (works with or without the rest).
const header = document.querySelector<HTMLElement>('.site-header');
const onScrollHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScrollHeader, { passive: true }); onScrollHeader();

// Light that follows the pointer across glass cards (CSS reads --mx / --my).
if (finePointer) {
  document.addEventListener('pointermove', (e) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>('.lane-door, .ds-card, .price-col, .price-box, .card, .nl-box');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });
}

if (!reduce) {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  document.documentElement.classList.add('has-motion');

  // Smooth scroll on mouse and trackpad only.
  if (finePointer) {
    const lenis = new Lenis({ duration: 1.1, anchors: { offset: -84 }, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // Page headline: lines rise out of a mask, word by word.
  const h1 = document.querySelector<HTMLElement>('main h1, .home-hero h1, .product-hero h1');
  const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
  if (!h1) document.documentElement.classList.remove('motion-pending');
  if (h1) {
    document.fonts?.ready.then(() => {
      const split = SplitText.create(h1, { type: 'lines,words', mask: 'lines', wordsClass: 'sw', linesClass: 'sl', aria: 'auto' });
      h1.classList.add('is-split');
      document.documentElement.classList.remove('motion-pending');
      intro.from(split.words, { yPercent: 110, opacity: 0, duration: 1.2, stagger: 0.045 }, 0);
    });
  }
  intro.from('.home-kicker, .home-lede, .product-lede, .home-stage', { y: 18, opacity: 0, filter: 'blur(8px)', duration: 1.1, stagger: 0.08 }, 0.25);

  // Everything else reveals as it scrolls in: rise, unblur, fade; siblings in a soft stagger.
  const targets = gsap.utils.toArray<HTMLElement>(
    '.lane-door, .ds-section-head, .price-col, .how-grid li, .ds-card, .nl-box, .ds-steps > li, .ds-faq-item, .price-box, main .card, .ds-checklist li, .footer-grid > *',
  ).filter((el) => !el.closest('form') || el.matches('.nl-box'));
  gsap.set(targets, { opacity: 0, y: 28, filter: 'blur(6px)' });
  ScrollTrigger.batch(targets, {
    start: 'top 90%', once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, ease: 'expo.out', stagger: 0.08, clearProps: 'filter,transform' }),
  });

  // Big section titles drift slightly as they pass (depth).
  gsap.utils.toArray<HTMLElement>('.ds-section-head h2').forEach((el) => {
    gsap.fromTo(el, { yPercent: 18 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Primary buttons lean toward the pointer a few pixels.
  if (finePointer) {
    document.querySelectorAll<HTMLElement>('.btn-primary').forEach((b) => {
      const x = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3' });
      const y = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3' });
      b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * 0.18); y((e.clientY - r.top - r.height / 2) * 0.3); });
      b.addEventListener('pointerleave', () => { x(0); y(0); });
    });
  }
}
