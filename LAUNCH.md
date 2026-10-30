# NeonKey launch checklist

Status as of 2026-10-29. **The site is live-ready in code, but nothing has been launched.** No domain has been bought, no DNS has been changed and no Cloudflare project exists yet. Everything below marked "You" needs Michael.

## Already done (in this repo)

- [x] Build modes: `PUBLIC_SITE_MODE=demo|live`, `SITE_URL`, `BASE_PATH` (see README). Demo = noindex + banner; live = indexable, no banner.
- [x] Base-aware links and assets, so the same code works at `/` and at `/NeonKey/`.
- [x] `@astrojs/sitemap` (`/sitemap-index.xml`), robots.txt per mode, canonical URLs.
- [x] Open Graph + Twitter card meta with a generated 1200×630 image (`public/og-default.png`, from `npm run assets`).
- [x] Favicon set (SVG, 32px PNG, Apple touch icon), web manifest with 192/512/maskable icons.
- [x] Meta descriptions on every page; a proper 404 page (noindex).
- [x] Accessibility basics: skip link, visible focus styles, `aria-current` on nav, Escape closes the mobile menu, color contrast checked (all text pairs at least 6.3:1, WCAG AA needs 4.5:1).
- [x] No `<img>` tags in use (art is inline SVG); the beehiiv iframe is `loading="lazy"`.
- [x] `public/_headers` (CSP allowing Umami Cloud and beehiiv, nosniff, Referrer-Policy, Permissions-Policy, `frame-ancestors 'none'`) and `public/_redirects`.
- [x] Umami wired in, off until `PUBLIC_UMAMI_WEBSITE_ID` is set; custom events on key buttons.
- [x] Newsletter "Unlock the Week" wired for beehiiv, with an honest "Coming soon" state until configured.
- [x] Services: Remote Small-Office IT Setup (featured) + monthly support plan, plus the three automation services. Pricing basis in `docs/pricing-research.md`.

## 1. Domain (You)

- [ ] Buy `neonkey.tech` (or your pick). If you use Cloudflare Registrar, DNS is on Cloudflare automatically, which Email Routing needs.
- [ ] If you pick a different domain, update `SITE_URL`, `PUBLIC_CONTACT_EMAIL` and the `neonkey.tech` text in `scripts/generate-assets.mjs` (then `npm run assets`).

## 2. Cloudflare Pages project (You)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick `mrmream-dotcom/NeonKey`, branch `main`.
2. Build settings: Framework preset **Astro**, build command **`npm run build`**, output directory **`dist`**.
3. Environment variables (Production):
   - `PUBLIC_SITE_MODE=live`
   - `SITE_URL=https://neonkey.tech`
   - `NODE_VERSION=24` (Astro 7 needs Node 22.23.4+)
   - `PUBLIC_UMAMI_WEBSITE_ID=<id>` and `PUBLIC_UMAMI_DOMAINS=neonkey.tech` (step 6)
   - `PUBLIC_NEWSLETTER_PROVIDER=beehiiv` + `PUBLIC_BEEHIIV_EMBED_ID=<form id>` (step 5)
   - Leave `BASE_PATH` unset.
4. Tip: keep **Preview** deployments on `PUBLIC_SITE_MODE=demo` so `*.pages.dev` previews stay noindex.
5. First deploy to `<project>.pages.dev`, check it, then add the custom domain.

## 3. DNS (You)

- [ ] Pages project → **Custom domains → Set up a domain** → `neonkey.tech` (and `www.neonkey.tech`, redirected to the apex with a Redirect Rule or Bulk Redirect).
- [ ] Email records (MX, SPF, DKIM, DMARC) come from steps 4–5. Only one SPF TXT record is allowed per name, so merge them if two services need SPF.

## 4. Business inbox and contact method (You)

The site shows **`hello@neonkey.tech`** as a placeholder (`PUBLIC_CONTACT_EMAIL`, on the Contact page and footer). It doesn't work until you set one of these up. No personal email appears anywhere on the site.

| Option | Cost | Notes | Sources |
|---|---|---|---|
| **Cloudflare Email Routing** | Free | Forwarding only: mail to `hello@neonkey.tech` is forwarded to an inbox you already have. It doesn't send mail. Needs Cloudflare as the domain's DNS; it adds MX/SPF/DKIM records for you. Each destination address has to be verified. | [Email Routing docs](https://developers.cloudflare.com/email-routing/llms-full.txt), [Route emails](https://developers.cloudflare.com/email-service/get-started/route-emails/) |
| **Zoho Mail Forever Free** | Free | A real mailbox that can send and receive as `hello@neonkey.tech`. Up to 5 users, 1 domain, 5 GB per user. Web and mobile apps only (no IMAP/POP/ActiveSync), and offered only in some data-center regions (US, EU, India). | [Zoho subscription help](https://www.zoho.com/mail/help/adminconsole/subscription.html), [Zoho plan comparison](https://www.zoho.com/mail/compare/overview.html) |

Recommendation: **Zoho Mail Forever Free** if you want to reply *from* `hello@`; Cloudflare Email Routing if forwarding is enough for now. Either way:

- [ ] Set up the inbox and send yourself a test.
- [ ] Wire or remove the contact form. It's a placeholder (`src/pages/contact.astro`, handled in `Base.astro`), so either connect a form backend or delete the form and keep the email link.
- [ ] Remove the "(Placeholder address…)" note. It only shows in demo mode, so live mode hides it, but confirm the address really works first.

## 5. Newsletter setup: "Unlock the Week by NeonKey" (You)

1. Create a beehiiv account and a publication named **Unlock the Week by NeonKey**. Use a dedicated sender identity, **not your personal Gmail**.
2. **Sending address on the free plan:** without a custom domain, beehiiv sends from a beehiiv-managed address (e.g. `<publication>@mail.beehiiv.com`). That's fine to start.
3. **Free plan:** up to 2,500 subscribers with unlimited sends ([beehiiv pricing](https://www.beehiiv.com/pricing), [beehiiv 2026 pricing overview](https://www.beehiiv.com/blog/beehiiv-pricing-2026), which says the new plans took effect Oct 1, 2026).
4. **Custom sending domain later** (e.g. `newsletter@neonkey.tech`, or `hello@`): beehiiv's help center lists custom domains, including the email/sending domain, under **all paid plans** ([How to use a custom domain](https://www.beehiiv.com/support/article/14492990172823-how-to-use-a-custom-domain-for-your-publication)). The pricing material we found showed Lite around $49/mo (yearly billing) and Pro around $95/mo. One older pricing page listed "Custom Domains" under the old free Launch plan, which conflicts with the help article, so treat the help article as current and **confirm on the pricing page before paying**.
   - beehiiv recommends a **subdomain** for sending (e.g. `mail.neonkey.tech` or `email.neonkey.tech`). It gives you the SPF/DKIM records to add in Cloudflare DNS.
   - Add a DMARC record for the domain (start with `v=DMARC1; p=none; rua=mailto:<your inbox>` and tighten later).
5. Make a subscribe form: **Subscribers → Subscribe forms → Get embed code** ([guide](https://www.beehiiv.com/support/article/12977090590487-creating-an-embedded-subscribe-form)). Copy the form ID from `https://subscribe-forms.beehiiv.com/<FORM-ID>`.
6. In Cloudflare Pages, set `PUBLIC_NEWSLETTER_PROVIDER=beehiiv` and `PUBLIC_BEEHIIV_EMBED_ID=<FORM-ID>`, then redeploy. The "Coming soon" state disappears and the beehiiv form shows on Home and `/newsletter/`.
7. Add a postal address to the publication's email footer. The US CAN-SPAM Act requires a valid physical postal address in commercial email ([FTC CAN-SPAM guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)). A PO box or virtual mailbox keeps your home address private.
8. Send a test issue to yourself, then remove "No issues have been sent yet" wording if needed. The newsletter page shows a sample *format* labeled as a sample, not a fake issue.

## 6. Umami (You)

- [ ] Create the website in Umami Cloud and copy the Website ID (README → "Analytics: Umami").
- [ ] Set `PUBLIC_UMAMI_WEBSITE_ID` and `PUBLIC_UMAMI_DOMAINS=neonkey.tech` in Cloudflare Pages, then redeploy.
- [ ] Test: devtools shows `script.js` 200 and `/api/send` 200; you appear in **Realtime**. Ad-blockers may hide it.

## 7. Switch to live mode (You)

- [ ] `PUBLIC_SITE_MODE=live` in the Production environment. This removes the demo banner and noindex, makes robots.txt allow crawling and lists the sitemap.
- [ ] After DNS is live: submit `https://neonkey.tech/sitemap-index.xml` in Google Search Console (optional).

## 8. Replace or remove demo content (You)

Each of these is placeholder content. Replace it with real content, or delete the file and its links/cards before going live:

| File | What it is |
|---|---|
| `src/pages/learn/self-host-n8n-old-pc.astro` | Sample tutorial (linked from Home, Learn, Newsletter) |
| `src/pages/reviews/example-mini-pc-homelab.astro` | Sample review of a fictional product; **its "Check price" buttons point to `#`** |
| `src/pages/notes/what-unlock-means.astro` | Sample notes article |
| `src/pages/lab/n8n-lead-intake-automation.astro` | Sample Lab case study |
| `src/pages/lab/homelab-network-segmentation.astro` | Sample Lab case study (linked from the Remote IT page) |
| `src/pages/lab/ai-faq-assistant-small-business.astro` | Sample Lab case study (fictional business) |
| `src/data/lab.ts` | Lab card list: update when the above change |
| `src/pages/index.astro` | "Coming soon" card slot, featured-review placeholder art, sample cards |
| `src/pages/learn/index.astro`, `reviews/index.astro`, `notes/index.astro` | Index cards for the samples, "coming soon" slots |
| `src/pages/newsletter.astro` | Sample issue *format* (labeled as a sample; fine to keep) |
| `src/pages/contact.astro` | Placeholder form (see step 4) |
| `src/pages/privacy.astro` | **Draft** policy: finish it (hosting logs, data requests, privacy contact). It already covers Umami (cookieless) and beehiiv |
| `src/pages/disclosure.astro` | Affiliate disclosure placeholder: review the wording |

Tip: `grep -rn "DemoBadge\|Demo content\|placeholder" src` finds the rest.

## 9. Affiliate disclosure (You)

- [ ] Join the affiliate programs you'll use and replace every `#` affiliate link with a real link (keep `rel="sponsored nofollow"`).
- [ ] Keep the disclosure near the top of each review and in the newsletter next to affiliate picks ([FTC Endorsement Guides](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)). Some programs (e.g. Amazon Associates) need specific wording.

## 10. Content to check for accuracy before going live (You)

- **About page:** "a CIS student". Confirm it's accurate and that you're comfortable publishing it.
- **Prices** on `/services/` and `/services/remote-it/` are starter prices based on thin public data (`docs/pricing-research.md`). Confirm them, or switch to "Quote on request".
- **Remote IT scope:** make sure you're comfortable supporting everything listed (Google Workspace, Microsoft 365, SPF/DKIM/DMARC, routers, backups, password managers). Remove anything you're not.
- **Monthly support plan:** decide the actual response window and the number of requests, and put them in writing for each client.
- **Lab samples** describe builds that aren't documented yet. They're labeled as demos, but replace them with real builds before you point people at the Lab.
- **"No issues have been sent yet"** on the newsletter page stops being true after issue #1.
- The site makes **no certification claims**, and there's no cert-study content. Keep it that way until a cert is actually earned.

## 11. Off-duty employment approval (You)

- [ ] Reminder: get any off-duty / outside-employment approval you need before you take paid work or turn on affiliate income. You're handling this yourself; nothing on the site depends on it.

## 12. Business admin to consider (You, optional)

- Simple service terms or a scope-of-work template (payment, what's in and out of scope, no guarantees).
- How you'll take payments (e.g. invoices through Stripe, PayPal or Wave).
- Local business registration or tax rules for freelance income.

## GitHub Pages demo

The demo preview at `https://mrmream-dotcom.github.io/NeonKey/` comes from a clean build with `BASE_PATH=/NeonKey/`. See README → Deploying.
