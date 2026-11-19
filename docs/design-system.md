# NeonKey design system

The look is "Linear meets Vercel": dark, quiet, precise. Premium and technical, not hacker-themed. Motion is limited to short hover and focus transitions, and none at all under `prefers-reduced-motion`. System font stack only, with no web fonts and no new external hosts (the CSP in `public/_headers` would block them).

Files, loaded in this order by `src/layouts/Base.astro`:

| File | What lives there |
|---|---|
| `src/styles/tokens.css` | Every color, type size, space, radius, shadow and motion value. Change a value here, nowhere else. |
| `src/styles/global.css` | Reset, base type, header and nav, buttons (`.btn-*`), forms, legacy layout helpers. |
| `src/styles/editorial.css` | Learn guides and articles. |
| `src/styles/components.css` | Classes used by the components below (`.ds-*`, `.price-box`, `.product-hero`, `.lane-*`, `.offer-*`, footer). |

Old names (`--bg`, `--panel`, `--line`, `--muted`, `--cyan` …) are aliases of the tokens so older pages keep working. Use the `--color-*` names in new code.

## Tokens

### Color and contrast (WCAG 2.x, computed)

| Token | Value | Use | On `--color-bg` | On `--color-surface` |
|---|---|---|---|---|
| `--color-text` | #e8eaf6 | body and headings | 16.2:1 | 14.5:1 |
| `--color-text-muted` | #b3b8d6 | secondary copy | 9.9:1 | 8.9:1 |
| `--color-text-subtle` | #8d93b8 | captions and fine print only | 6.4:1 | 5.8:1 |
| `--color-primary` | #22d3ee | the one primary action, links | 10.7:1 | 9.6:1 |
| `--color-violet` | #a78bfa | kickers, Build Your Business accent | 7.1:1 | 6.4:1 |
| `--color-magenta` | #f472b6 | focus ring, Run Your Business accent | 7.3:1 | 6.6:1 |

Text on a primary button (`--color-on-primary` #04121a on cyan) is 10.5:1. Every text pair passes AA (4.5:1), and all but the subtle text pass AAA. The focus ring (2px magenta, 2px offset) is 7.3:1 against the page. `--color-border-strong` is 2.0:1, so it is only used for decoration, never as the only cue for a control.

### Lanes

Each entrance has one accent. Set `class="lane-family|lane-founders|lane-smb"` on a wrapper, and components inside it read `--lane`.

| Lane id (checkout ref) | Public name | Hub | Accent |
|---|---|---|---|
| `family` | Protect Yourself | `/protect/` (tool: `/scam-checker/`) | cyan |
| `founders` | Build Your Business | `/founders/` | violet |
| `smb` | Run Your Business | `/services/` | magenta |

The names live only in `src/lib/lanes.ts` (`LANE_NAMES`, `LANE_HUBS`, `LANE_AUDIENCE`). Import them instead of typing the name.

### Type, space, shape

- Type: `--text-xs` … `--text-3xl`, `--text-display` (clamped). Headings use `--leading-tight` and a slight negative tracking.
- Space: `--space-1` (4px) … `--space-20`. Section rhythm: `--section-y`, `--section-y-sm`. Side gutter: `--gutter` (20px).
- Radius: `--radius-sm|md|lg|xl|pill`. Shadows: `--shadow-inset` for cards. No glows.
- `--tap: 44px` is the minimum height of every button, link button, input and summary.
- Motion: `--dur` with `--ease`, for hover and focus only. `global.css` turns every transition and animation off under `prefers-reduced-motion`.

## Components (`src/components/ui/`)

| Component | Use |
|---|---|
| `Button` | `href` gives an `<a>` (internal paths go through `url()`), otherwise a `<button>`. `variant` primary, secondary or ghost; `size` sm, md or lg; `block`. Other attributes (Umami, `buyAttrs`) pass through. |
| `Card` | A surface with a border. `as`, `lane`, `pad`. |
| `Section` | Vertical rhythm plus an optional heading block (`eyebrow`, `title`, `intro`). `tone="raised"` alternates the band. Put anchors other pages link to in `id`. |
| `Steps` | A numbered list of `{h, p}`. |
| `FAQ` | `<details>/<summary>`, no script. Answers are trusted HTML from the page source, never user input. True facts only. |
| `TrustLine` | `src/components/TrustLine.astro`: who runs NeonKey, with the approved experience wording, and the refunds link. |
| `LaneHero` | Hub page hero: lane pill, h1, one-line lede, actions slot, an optional tool slot. |
| `ProductHero` | Product page hero: what it does, who it's for, and the `PriceBox` beside it (under it on phones). |
| `PriceBox` | The only place a product's price and primary action appear on its page. See below. |

### PriceBox

`<PriceBox product="follow-up-desk|email-auth|founder-stack|front-office|remote-it|support-plan" lane="…" location="…" />`

- Every number comes from `src/data/services.ts`. Never type a price into a page.
- Buy buttons go through `buyAttrs()` (`src/lib/checkout-ref.ts`), so each Stripe link carries an `nk1_` `client_reference_id` and the Umami lane, sku and location. Give each placement its own `location`.
- While the Follow-Up Desk founding sale is live it renders `DeskSale variant="price"`, which swaps to the regular price at `data-sale-ends`. The release checks require both sale links and the regular link on `/follow-up-desk/`.
- Custom work (Front Office, Remote IT, Support Plan) has no checkout. Its button is "Get a written quote" and goes to `/contact/?topic=…`. Never offer call booking.

## Page templates

- **Lane hub** (`/protect/`, `/founders/`, `/services/`): `LaneHero` with the free tool or primary product in the first screen, then offer cards, then free guides, then `TrustLine`.
- **Product page**: `src/layouts/ProductPage.astro`, in a fixed order:
  1. what it does and who it's for, with the `PriceBox` and one primary action
  2. the free try, demo or video (slot `try`)
  3. what you get (`includes`)
  4. product-specific sections (default slot), kept short
  5. what happens after you pay (`after`)
  6. FAQ, with refunds and terms links
  7. `TrustLine`

  Used by `/follow-up-desk/`, `/services/email-lockdown/`, `/founders/guide/`, `/founders/preflight/` and `/services/remote-it/`.

## Rules

- One primary (cyan) button per screen. Everything else is secondary, ghost or a text link.
- On a phone (390×844) the primary action is in the first screen: no horizontal scroll, tap targets of at least 44px, a visible focus ring.
- Don't edit inside forms pinned in `scripts/approved-form-changes.json`. Wrap them, don't change them.
- No inline scripts unless the CSP integration hashes them. No new external hosts without adding them to `public/_headers` first.
- Copy follows `CLAUDE.md`: no guarantees, no invented numbers, no testimonials, no scarcity.
