# NeonKey launch checklist

Status as of 2026-10-30. **The site is live:** since Oct 30, 2026 `neonkey.tech` serves a `PUBLIC_SITE_MODE=live` build (indexable, robots.txt allows crawling and lists the sitemap) from GitHub Pages. `neonkey.tech` was bought on Oct 29, 2026 (Porkbun). No Cloudflare project exists yet. Everything below marked "You" needs Michael.

## Already done (in this repo)

- [x] Build modes: `PUBLIC_SITE_MODE=demo|live`, `SITE_URL`, `BASE_PATH` (see README). Demo = noindex + robots Disallow; live = indexable. No visible demo banner in either mode.
- [x] Base-aware links and assets, so the same code works at `/` and at `/NeonKey/`.
- [x] `@astrojs/sitemap` (`/sitemap-index.xml`), robots.txt per mode, canonical URLs.
- [x] Open Graph + Twitter card meta with a generated 1200×630 image (`public/og-default.png`, from `npm run assets`).
- [x] Favicon set (SVG, 32px PNG, Apple touch icon), web manifest with 192/512/maskable icons.
- [x] Meta descriptions on every page; a proper 404 page (noindex).
- [x] Accessibility basics: skip link, visible focus styles, `aria-current` on nav, Escape closes the mobile menu, color contrast checked (all text pairs at least 6.3:1, WCAG AA needs 4.5:1).
- [x] No `<img>` tags in use (art is inline SVG). The newsletter form is the site's own HTML by default, so no third-party script loads.
- [x] `public/_headers` (CSP allowing Umami Cloud and Kit, nosniff, Referrer-Policy, Permissions-Policy, `frame-ancestors 'none'`) and `public/_redirects`.
- [x] Umami wired in with NeonKey's website ID as the default (`2c6a467e-…`). It only reports from `neonkey.tech`/`www.neonkey.tech` (`data-domains`), with custom events on key buttons.
- [x] Newsletter "Unlock the Week" wired for Kit (formerly ConvertKit), with an honest "Coming soon" state until configured.
- [x] Services: Remote Small-Office IT Setup (featured) + monthly support plan, plus the three automation services. Pricing basis in `docs/pricing-research.md`.

## 1. Domain (done)

- [x] **`neonkey.tech` bought at Porkbun on Oct 29, 2026.** It renews Oct 30, 2027 at **$50.98/yr**, with auto-renew on. Keep the card on file current, and put a reminder in your calendar before renewal.
- [x] **DNS today (at Porkbun) points at GitHub Pages for the demo:** GitHub Pages' apex `A`/`AAAA` records for `neonkey.tech`, plus a `www` `CNAME` to `mrmream-dotcom.github.io`. The gh-pages branch carries a `CNAME` file containing `neonkey.tech` (from `public/CNAME`) so GitHub keeps the custom domain on every push.
- [ ] In GitHub **Settings → Pages**, confirm the custom domain shows `neonkey.tech` with a passing DNS check, then tick **Enforce HTTPS** once the certificate is issued.
- [ ] Optional hardening: **verify the domain** for your GitHub account (Settings → Pages → Verified domains), so no other repo can claim it.
- Since Oct 30, 2026 the gh-pages build uses `PUBLIC_SITE_MODE=live`. Every manual deploy must pass `PUBLIC_SITE_MODE=live` (the code default is `demo`), or `noindex` comes back on every page.

### Hosting for the real launch: recommendation

**Move to Cloudflare Pages for launch; keep GitHub Pages only for the demo until then.** Reasons:
- GitHub Pages **ignores `public/_headers` and `public/_redirects`**. On GitHub Pages the CSP, `nosniff`, Referrer-Policy, Permissions-Policy, `frame-ancestors` and the short-URL redirects don't apply. Cloudflare Pages applies all of them.
- Cloudflare Email Routing (the free `hello@`/`newsletter@` forwarding used in steps 4–5) needs the domain's **nameservers on Cloudflare**. Moving DNS to Cloudflare gets you Email Routing too.
- Per-branch preview deploys that stay in demo mode (noindex), separate from production.

Migration outline (when ready, no downtime needed):
1. Add `neonkey.tech` to a free Cloudflare account. Cloudflare imports the existing records; check that the GitHub Pages `A`/`AAAA`/`www` records came across.
2. At Porkbun, switch the nameservers to the two Cloudflare gives you. The registration stays at Porkbun, and renewal is unchanged.
3. Create the Pages project (step 2), then attach `neonkey.tech` and `www` to it. Cloudflare replaces the GitHub Pages records.
4. Afterwards, remove the custom domain in GitHub Pages settings and delete `public/CNAME`. Optionally keep the gh-pages demo at the `github.io` URL.

**Staying on GitHub Pages instead** works if you accept no custom security headers and no `_redirects`. You'd then set up the inbox with Porkbun's own email forwarding (check current terms in the Porkbun dashboard) or Zoho, and add Kit's DNS records at Porkbun.

## 2. Cloudflare Pages project (You)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick `mrmream-dotcom/NeonKey`, branch `main`.
2. Build settings: Framework preset **Astro**, build command **`npm run build`**, output directory **`dist`**.
3. Environment variables (Production):
   - `PUBLIC_SITE_MODE=live`
   - `SITE_URL=https://neonkey.tech`
   - `NODE_VERSION=24` (Astro 7 needs Node 22.23.4+)
   - Umami needs nothing: the website ID and `data-domains` are built-in defaults (step 6)
   - `PUBLIC_NEWSLETTER_PROVIDER=kit` + `PUBLIC_KIT_FORM_ID=<numeric form id>` (step 5)
   - Leave `BASE_PATH` unset.
4. Tip: keep **Preview** deployments on `PUBLIC_SITE_MODE=demo` so `*.pages.dev` previews stay noindex.
5. First deploy to `<project>.pages.dev`, check it, then add the custom domain.

## 3. DNS (You)

- [x] Demo: Porkbun DNS → GitHub Pages (`A`/`AAAA` apex + `www` CNAME), see step 1.
- [ ] Launch: after moving nameservers to Cloudflare, Pages project → **Custom domains → Set up a domain** → `neonkey.tech` (and `www.neonkey.tech`, redirected to the apex with a Redirect Rule or Bulk Redirect).
- [ ] Add mail and Kit records wherever DNS is hosted at the time (Cloudflare after the move, Porkbun before). On Cloudflare, Kit's CNAMEs must be **DNS only** (grey cloud).
- [ ] Email records come from steps 4–5: MX/SPF/DKIM for the inbox (step 4), and Kit's two CNAMEs plus one DMARC TXT (step 5). Kit uses CNAMEs, not an SPF TXT, so it doesn't clash with Email Routing's SPF record. Only one SPF TXT and **one** `_dmarc` TXT are allowed per name, so merge rather than add a second.

## 4. Business inbox and contact method (You)

The site shows **`hello@neonkey.tech`** as a placeholder (`PUBLIC_CONTACT_EMAIL`, on the Contact page and footer). It doesn't work until you set one of these up. No personal email appears anywhere on the site.

| Option | Cost | Notes | Sources |
|---|---|---|---|
| **Cloudflare Email Routing** | Free | Forwarding only: mail to `hello@neonkey.tech` is forwarded to an inbox you already have. It doesn't send mail. Needs Cloudflare as the domain's DNS; it adds MX/SPF/DKIM records for you. Each destination address has to be verified. | [Email Routing docs](https://developers.cloudflare.com/email-routing/llms-full.txt), [Route emails](https://developers.cloudflare.com/email-service/get-started/route-emails/) |
| **Zoho Mail Forever Free** | Free | A real mailbox that can send and receive as `hello@neonkey.tech`. Up to 5 users, 1 domain, 5 GB per user. Web and mobile apps only (no IMAP/POP/ActiveSync), and offered only in some data-center regions (US, EU, India). | [Zoho subscription help](https://www.zoho.com/mail/help/adminconsole/subscription.html), [Zoho plan comparison](https://www.zoho.com/mail/compare/overview.html) |

Recommendation: **Zoho Mail Forever Free** if you want to reply *from* `hello@`; Cloudflare Email Routing if forwarding is enough for now. Either way:

- [ ] Set up the inbox and send yourself a test.
- [ ] Wire or remove the contact form. It's a placeholder (`src/pages/contact.astro`, handled in `Base.astro`), so either connect a form backend or delete the form and keep the email link.
- [ ] Remove the "(This inbox is still being set up.)" note. It only shows in demo mode, so live mode hides it, but confirm the address really works first.

## 5. Newsletter setup: "Unlock the Week by NeonKey" on Kit (You)

**Why Kit Free:** up to 10,000 subscribers, unlimited forms and landing pages, and unlimited broadcasts for $0/month. Visual automations, email sequences, RSS campaigns and paid apps need a paid plan ([The Kit Free plan](https://help.kit.com/en/articles/16627071-the-kit-free-plan), updated Sep 23, 2026). The pricing page lists **removing Kit branding** and a **custom link-tracking domain** as paid features, so expect a small Kit badge or footer link on the free plan ([kit.com/pricing](https://kit.com/pricing)). Neither source lists verified sending domains as paid. Confirm in the app when you sign up, before you rely on it.

**A. Account and form (can be done now)**
1. Create a free account from [kit.com/pricing](https://kit.com/pricing) (pick **Free**), using the name **Michael Ream**. Use a dedicated sign-in, not your personal Gmail as the public sender.
2. **Grow → Landing Pages & Forms → Create new → Form**. Name it **Unlock the Week by NeonKey** and pick an **Inline** format. (Kit forms can be embedded; landing pages can't, [Form embedding basics](https://help.kit.com/en/articles/4009572-form-embedding-basics).) Optionally, also make a Kit landing page with the same name to use as a shareable link.
3. In the form's settings, keep the **confirmation (double opt-in) email** on. The site's form tells people "You'll get an email to confirm", so change that wording in `src/components/NewsletterForm.astro` if you turn it off. Optionally, set the after-subscribe action to redirect to `https://neonkey.tech/newsletter/`. Leave **reCAPTCHA off**, or add Google's domains to the CSP in `public/_headers`.
4. Get the form ID: **Embed → HTML** and copy the number in `<form action="https://app.kit.com/forms/<FORM_ID>/subscriptions" …>`. The email input there is named `email_address`, and the site's form uses the same name.
5. In Cloudflare Pages, set `PUBLIC_NEWSLETTER_PROVIDER=kit` and `PUBLIC_KIT_FORM_ID=<FORM_ID>`, then redeploy. The "Coming soon" state is replaced by a working form on Home and `/newsletter/`, and submits go straight to Kit.
   - Alternative: Kit's **Embed → JavaScript** code is `<script async data-uid="<uid>" src="https://<account>.kit.com/<uid>/index.js"></script>`. Kit recommends it because changes made in Kit show up automatically. To use it, set `PUBLIC_KIT_EMBED_SRC=<that src>` instead of `PUBLIC_KIT_FORM_ID`. It loads Kit's script, which the CSP already allows.
6. Test: submit your own address in live mode, confirm it, and check it shows under **Subscribers**. If Umami is on, a `newsletter-signup` event appears.

**B. Sending from your own domain (after buying `neonkey.tech`)**

Without a verified domain, Kit puts its own address in the hidden return-path. A verified sending domain gives you SPF, DKIM and DMARC alignment on your domain ([Verify your domain](https://help.kit.com/en/articles/2502558-verify-your-domain-to-optimize-your-deliverability)).
1. Set up the From inbox first (step 4). Use **Cloudflare Email Routing** (needs the domain's DNS on Cloudflare, see step 1; until then, Porkbun's email forwarding can do the same job) to forward `newsletter@neonkey.tech` (or `hello@neonkey.tech`) to your own inbox, so Kit's verification email and subscriber replies reach you.
2. Kit → **Settings → Email → Verified Sending Domains → Set up your Verified Sending Domain**, enter `neonkey.tech`, then **Next**. A subdomain isn't required, and Kit says its records don't interfere with the top-level domain.
3. Pick **Set this up for me** (Entri logs in to Cloudflare for you) or copy the records manually. The records are two **CNAME** records with hosts like `ckespa` and `cka._domainkey`, with the values Kit shows. In Cloudflare, set both to **DNS only** (grey cloud, not proxied). If Cloudflare rejects the full host name, use the short form (`ckespa` instead of `ckespa.neonkey.tech`). Then click **Validate**.
4. DMARC: Kit shows a default record (`v=DMARC1; p=none`) under Verified Sending Domain. Add it as a **TXT** record on `_dmarc.neonkey.tech`, unless you already have one; there can only be one `_dmarc` record. Kit says DMARC can take 24–48 hours to take effect, and **don't remove** the record or the verified domain afterwards ([Add a DMARC record](https://help.kit.com/en/articles/8540237-how-to-add-a-dmarc-record-to-your-verified-sending-domain)). Tighten `p=` later, once reports look clean.
5. **Settings → Email → Add from address**: name "Unlock the Week by NeonKey" or "Michael at NeonKey", address `newsletter@neonkey.tech` or `hello@neonkey.tech`. Click the link in Kit's verification email, which Email Routing forwards to you ([new account checklist](https://help.kit.com/en/articles/14005977-how-to-set-up-your-new-kit-account-a-complete-checklist)).

**C. Mailing address (required before you can send anything)**

Kit won't send until **Settings → Email → Mailing Address** is filled in ([checklist](https://help.kit.com/en/articles/14005977-how-to-set-up-your-new-kit-account-a-complete-checklist)). CAN-SPAM requires a valid physical postal address in every commercial email ([FTC CAN-SPAM guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)). Options, from [Kit: Alternatives for your physical address](https://help.kit.com/en/articles/2502494-alternatives-for-your-physical-address):
- A **UPS Store mailbox** or a PO box: you get a real address that receives mail, without exposing your home.
- **Kit's shared address** (600 1st Ave, Ste 330 PMB 92768, Seattle, WA 98104-2246): free and for compliance only. Kit doesn't forward any mail sent there. Fine to start with; switch to your own box if you want to receive mail.
- Kit's email templates add the address through `{{ address }}` along with the required unsubscribe link.

**D. Later**
- Send a test issue to yourself first. Then update the newsletter page's "No issues have been sent yet" line.
- **Upgrade path:** move to a paid Kit plan (Creator, then Creator Pro) when you need welcome sequences, automations or RSS-to-email, want to remove Kit branding, or pass 10,000 subscribers. Kit says everything you built stays in place when you upgrade ([The Kit Free plan](https://help.kit.com/en/articles/16627071-the-kit-free-plan)). Check current prices on [kit.com/pricing](https://kit.com/pricing).
- Alternative considered: beehiiv. Its free plan caps at 2,500 subscribers, and its help center lists custom sending domains under paid plans, which is why Kit was chosen.

## 6. Umami

- [x] Website created in Umami Cloud; ID `2c6a467e-392a-4226-b068-fdfc908a48da` is the default in `src/config.ts`. Override it with `PUBLIC_UMAMI_WEBSITE_ID`, or set it to `off` to disable.
- [x] `data-domains="neonkey.tech,www.neonkey.tech"`: only the real domain is counted, not localhost, previews or `github.io` (`PUBLIC_UMAMI_DOMAINS` overrides).
- [x] CSP allows `cloud.umami.is` (script) and `gateway.umami.is` (the `/api/send` endpoint the script posts to).
- [ ] Note: the **demo on neonkey.tech is counted too**, because it's the real domain. That's fine for testing. Exclude your own visits with `localStorage.setItem('umami.disabled', 1)` in devtools.
- [ ] Check **Realtime** in Umami after visiting the site; ad-blockers may hide your visit.

## 7. Switch to live mode

- [x] Oct 30, 2026: gh-pages rebuilt with `PUBLIC_SITE_MODE=live`. noindex is gone (it stays only on 404, thank-you/welcome pages and the old /notes/ redirects), and robots.txt allows crawling and lists `https://neonkey.tech/sitemap-index.xml`.
- [x] Deploy command for GitHub Pages: `rm -rf dist && SITE_URL=https://neonkey.tech BASE_PATH=/ PUBLIC_SITE_MODE=live npx astro build`, then push `dist/` + `CNAME` + `.nojekyll` to `gh-pages`. On Cloudflare Pages, set `PUBLIC_SITE_MODE=live` in Production.
- [ ] You: submit `https://neonkey.tech/sitemap-index.xml` in Google Search Console and Bing Webmaster Tools (each needs your sign-in and a domain verification, e.g. a DNS TXT record at Porkbun).
- [ ] You: have someone review `/privacy/` (the draft banner was removed at launch; it isn't legal advice). Check the newsletter section against Kit's current privacy policy and data processing terms.

## 8. Hidden drafts: sample content (You)

On Oct 29, 2026 the visible demo labels were removed (no demo banner in any mode, no "Demo content" badges) and every sample page was **hidden**: not built, not linked anywhere, not in the sitemap. `PUBLIC_SITE_MODE=demo` still means `noindex, nofollow` + robots.txt `Disallow: /`.

Hidden pages live in `src/_drafts/`, which Astro doesn't route (only `src/pages/` becomes URLs). The folder mirrors `src/pages/`, so relative imports keep working:

| Draft file | Would publish at | What it is |
|---|---|---|
| `src/_drafts/learn/self-host-n8n-old-pc.astro` | `/learn/self-host-n8n-old-pc/` | Sample tutorial |
| `src/_drafts/reviews/example-mini-pc-homelab.astro` | `/reviews/example-mini-pc-homelab/` | Sample review of a fictional product (its "Check price" buttons point to `#`) |
| `src/_drafts/articles/what-unlock-means.astro` | `/articles/what-unlock-means/` | Sample article |
| `src/_drafts/lab/n8n-lead-intake-automation.astro` | `/lab/n8n-lead-intake-automation/` | Sample Lab case study |
| `src/_drafts/lab/homelab-network-segmentation.astro` | `/lab/homelab-network-segmentation/` | Sample Lab case study |
| `src/_drafts/lab/ai-faq-assistant-small-business.astro` | `/lab/ai-faq-assistant-small-business/` | Sample Lab case study (fictional business) |

The drafts still contain their old demo badges and "sample" wording, on purpose: rewrite them as real content before publishing.

**To publish (restore) a page**
1. Rewrite it with the real build/review/tutorial, and remove the `DemoBadge` / "sample" / "Demo content" bits (in Lab pages these come from `src/layouts/LabProject.astro`: the badge, the "Sample write-up" line, the warning callout and the "Demo Lab write-up:" description prefix).
2. Move it back: `git mv src/_drafts/lab/<slug>.astro src/pages/lab/` (same for `learn/`, `reviews/`, `articles/`).
3. **Lab:** in `src/data/lab.ts` delete `draft: true` (or set `false`) on that project. It then shows on `/lab/` (with tag filters) and in the home page "From the Lab" section automatically. Only list real projects: the Lab page's "Related" links use every project in `lab.ts`.
4. **Learn / Reviews:** add a list item linking to it in `src/pages/<section>/index.astro` in place of the `<EmptyState />` (the old list markup is in git history, commit before Oct 29, 2026).
   **Articles:** add an entry to `src/data/articles.ts` (`category: 'news'` or `'insights'`, default insights; news posts can set `sourceUrl` and `sourceName`, shown as "Source: <name>") and use `<ArticleMeta article={getArticle('<slug>')} />` on the page, like `why-outsource-automations.astro`. The All / News / Insights tabs, card badges and sitemap update automatically.
5. Optional: link it from the home page again, and from `/services/remote-it/` (the old Lab callout there linked the network-segmentation write-up).
6. Build and check: `grep -rni "demo content\|placeholder slot" dist` should be empty.

Empty sections (`/lab/`, `/reviews/`; `/learn/` now has the Security+ track) show `src/components/EmptyState.astro` ("First … are on the way — get them in Unlock the Week"). The home page shows one teaser line above the newsletter box instead of the old tutorial/Lab/review grids.

Still to finish separately: the contact form (not connected, see step 4), `src/pages/privacy.astro` (draft policy), and `src/pages/disclosure.astro` (review the wording; its demo callout was removed).

## 9. Affiliate disclosure (You)

- [ ] Join the affiliate programs you'll use and replace every `#` affiliate link with a real link (keep `rel="sponsored nofollow"`).
- [ ] Keep the disclosure near the top of each review and in the newsletter next to affiliate picks ([FTC Endorsement Guides](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)). Some programs (e.g. Amazon Associates) need specific wording.

## 10. Content to check for accuracy before going live (You)

- **About page:** "a CIS student". Confirm it's accurate and that you're comfortable publishing it.
- **Prices** on `/services/` and `/services/remote-it/` are starter prices based on thin public data (`docs/pricing-research.md`). Confirm them, or switch to "Quote on request".
- **Remote IT scope:** make sure you're comfortable supporting everything listed (Google Workspace, Microsoft 365, SPF/DKIM/DMARC, routers, backups, password managers). Remove anything you're not.
- **Monthly support plan:** decide the actual response window and the number of requests, and put them in writing for each client.
- **Lab samples** describe builds that aren't documented yet. They're hidden drafts (step 8); publish only real, documented builds.
- **"No issues have been sent yet"** on the newsletter page stops being true after issue #1.
- The site makes **no certification claims**, and there's no cert-study content. Keep it that way until a cert is actually earned.

## 11. Off-duty employment approval (You)

- [ ] Reminder: get any off-duty / outside-employment approval you need before you take paid work or turn on affiliate income. You're handling this yourself; nothing on the site depends on it.

## 12. Business admin to consider (You, optional)

- Simple service terms or a scope-of-work template (payment, what's in and out of scope, no guarantees).
- How you'll take payments (e.g. invoices through Stripe, PayPal or Wave).
- Local business registration or tax rules for freelance income.

## GitHub Pages (live)

The live site at **https://neonkey.tech/** (indexable since Oct 30, 2026) is a clean build pushed to the `gh-pages` branch with `BASE_PATH=/`, `SITE_URL=https://neonkey.tech`, `PUBLIC_SITE_MODE=live`, plus `.nojekyll` and `CNAME` (`neonkey.tech`). Always include `CNAME` when pushing gh-pages by hand, or GitHub drops the custom domain. The old `https://mrmream-dotcom.github.io/NeonKey/` URL redirects to the custom domain. See README → Deploying.
