# NeonKey brand guide

One page that keeps the site, link previews, reels, PDFs and decks looking like the same company.
The code is the source of truth for the values below (`src/styles/global.css` `:root`, `src/components/Logo.astro`).
If a value changes there, change it here in the same PR.

## Feel
Calm and confident first, neon second. Dark navy does the work, and the neon is the accent that says "this is NeonKey."
A visitor should think "these people have their tech together," not "gaming site." When in doubt, take glow away.

## Colors

| Token | Hex | Use it for |
| --- | --- | --- |
| `--bg` | `#0b0d17` | Page background, link-preview background |
| `--bg-2` | `#11142a` | Alternate section background |
| `--panel` | `#151935` | Cards, form fields, pills |
| `--line` | `#262b52` | Borders and dividers |
| `--text` | `#e8eaf6` | Body text and headings |
| `--muted` | `#b3b8d6` | Secondary text, captions |
| `--cyan` | `#22d3ee` | Primary buttons, links, highlighted words, kicker on link previews |
| `--violet` | `#a78bfa` | Kickers (small caps labels above headings), ghost button borders |
| `--magenta` | `#f472b6` | Focus rings, the key's dot, sparing accents |

Rules
- One cyan action per screen. The primary button is cyan with dark text (`#04121a`); everything else is a ghost (outlined) button.
- The brand gradient runs cyan → violet → magenta, top-left to bottom-right. Use it on the logo mark, thin rules and the "Key" in the wordmark. Never on body text or full backgrounds.
- Glow (box-shadow or drop-shadow in a brand color) appears only on hover, on the logo, and in the homepage hero. Not on cards at rest.
- Keep text contrast at 4.5:1 or better. `--muted` on `--bg` passes; `--muted` on `--panel` passes; violet text is for short labels only.

## Type
- Site: the system font stack (`--font`): fast, no font files to load, and looks native on every phone.
- Code, step numbers and data: `--mono`.
- Headings: bold, tight letter spacing (`-0.01em` to `-0.02em`), `text-wrap: balance`. The homepage h1 tops out at 3.75rem.
- Kickers: 0.78rem, bold, uppercase, `0.1em` letter spacing, violet. One per section at most.
- Images made outside the browser (link previews, `scripts/generate-og.mjs` and `generate-assets.mjs`): DejaVu Sans Bold, so they render the same on any build machine.

## Logo
- The mark is a key: a ring with a magenta dot, and a shaft with two teeth, stroked in the brand gradient.
- The wordmark is "Neon" in `--text` and "Key" in the gradient (or cyan where a gradient can't render). Always one word: NeonKey.
- Minimum size: 24px for the mark. Leave clear space equal to the ring's width on every side.
- Don't recolor it, outline it, rotate it, or set it on a light background without checking contrast.

## Link previews (Open Graph images)
- Every page gets a 1200×630 card from `npm run og`: navy grid background, a gradient rule along the top, a cyan kicker naming the section, the page's headline in white, and the NeonKey wordmark plus key at the bottom.
- Articles and the Founder Stack guide use their own hero image instead.
- After adding a page or changing a headline, build with `PUBLISH_DATE=2099-01-01` (so timed guides are included) and run `npm run og`, then commit `public/og/`.

## Motion
- Motion is for one place at a time (today: the homepage hero, while the `motion` A/B test runs).
- Animate only `transform` and `opacity`. No scroll-jacking, no autoplaying sound, no video backgrounds, no 3D libraries.
- `prefers-reduced-motion` turns every animation off (global rule in `global.css`). The still frame must look finished on its own.
- Durations: hover 150-200ms; ambient background loops 20-30s so the motion is felt, not watched.

## Voice (anything a visitor reads)
Short, warm, and practical. Sell the outcome (fewer lost customers, follow-ups that happen), not the tool.
The full copy rules live in `CLAUDE.md` under "Copy rules." The ones that come up most:
- "NeonKey" is one word. The public byline is "Michael Ream."
- American spelling. Beginner-friendly and apolitical. No guarantees, no invented numbers, quotes, reviews or clients.
- Never call NeonKey a marketing agency. No headshots.

## Photos and illustrations
- Prefer real screenshots of real NeonKey work (the Lab demos, the Follow-Up Desk) over stock photos.
- No stock photos of people. No AI images that pretend to be real customers, offices or results.
- Illustrations stay in the palette above, on a navy background.
