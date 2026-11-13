# Founder Watchdog: demand test and bounded MVP design

Written Nov 13 2026 for the Product Ecosystem Master Plan (B2F lane). Status: **waitlist test only.** No Stripe
product, no beta, no promise to build. Michael parked a $20-30 "Email Watch" on Nov 7 2026; that decision stands.
Showing the planned $9/$90 on the live site, and adding waitlist links, are open owner decisions (master plan section L).

Labels used below: **Observed** (checked, with source and date), **Assumption**, **Target** (the plan's number),
**Recommendation**.

## 1. What the two $29 offers include today (observed Nov 13 2026)

| | Email Authentication Setup | The Founder Stack |
|---|---|---|
| Stripe link | `plink_1UajXgCRxS1tvAi2TjNiqT0y`, active, $29.00 one-time, price `nk_email_lockdown`, metadata `offer=nk_email_lockdown` | `plink_1UajXgCRxS1tvAi2Esh56b8q`, active, $29.00 one-time, product `prod_Va3I5SUB9Z3mRb`, metadata `offer=nk_founder_stack_guide`, `track=founders` |
| Checkout asks | Domain (required), business name (optional), Terms checkbox | Domain for the included Lockdown (optional), business name (optional), Terms checkbox |
| Line item text | "Email Authentication Setup (SPF, DKIM and DMARC checked and fixed)" | "The Founder Stack (guide for founders, PDF)" |
| Delivered by | `workers/lockdown`: automatic DNS audit, branded report email + PDF/HTML, usually minutes; a person within 1 business day if it can't write a safe record | `workers/payments` (`deliver.js`): PDF emailed automatically from private KV |
| Rechecks | Day 2 (quiet unless all pass), day 5 (one reminder), day 10 (internal ACTION NEEDED, then closed). Page promises day 2 and day 5. | **None automatic.** The Lockdown Worker only fulfills the Lockdown link, so the included Lockdown is run by hand "within one business day" (buyer email text in `deliver.js`). |
| Who adds records | Buyer adds them, or invites NeonKey as a DNS collaborator (`/services/email-lockdown/`) | Same, once the included Lockdown is run |
| Terms | Final once the report is delivered; fix or refund if it can't be delivered or is wrong | Final once the guide is sent; fix or refund if it doesn't arrive, won't open or has a mistake |
| Credit | "What you pay for it comes off any larger package or setup" (`lockdownCredit`) | Not stated |

Gaps found (reported, not changed in this PR, since they touch live offer copy or a live Worker):

1. **Founder Stack included Lockdown has no trigger.** The payments Worker emails the buyer but sends hello@ no
   "run the Lockdown" notice. The only signal is the BCC copy to Michael and Stripe's own sale email. If BCC is
   dropped (memory note, Nov 9), an included Lockdown could be missed. Fix: a hello@ ACTION notice from `deliver.js`,
   or add the Founder Stack link to the Lockdown Worker's `LOCKDOWN_PAYMENT_LINK` with guide-aware copy.
2. **"Fixed" vs "you add them".** The Stripe line item and `emailLockdown.items` ("Missing or broken records fixed")
   say fixed; the page and the Worker deliver the exact records for the buyer to add (or NeonKey adds them as a
   collaborator). Recommendation: line item "checked, with the exact records to fix them".

## 2. The demand test (this PR)

Entry points (all hidden unless `PUBLIC_WATCHDOG_WAITLIST` is `preview` or `live`):

| Touchpoint | `from` value | Where |
|---|---|---|
| Launch Preflight results | `preflight` | `/founders/preflight/` "What to do next" (link carries the checked domain) |
| Free check on the $29 page | `lockdown-check` | `/services/email-lockdown/#free-check` (carries the domain) |
| After a Lockdown purchase | `lockdown-thanks` | `/pay/thanks/` |
| Founder Stack page | `guide` | `/founders/guide/` |
| After a Founder Stack purchase | `guide-thanks` | `/founders/guide/thanks/` |
| Founders hub | `founders-hub` | `/founders/` card |

Page: `/founders/watchdog/` ("Watch it for me"). Asks email, domain, who can add a DNS record, number of domains,
what matters most, and whether they'd pay the planned price. States plainly that it isn't built, nothing is
charged, and nothing is monitored.

**Qualified signup** (`qualifyWd` in `src/data/watchdog.ts`, shared by page and Worker): own domain (not gmail.com
etc.), a route to adding DNS (self or their DNS person), and would pay monthly or yearly at the planned price.
"Not sure" or "only if free" is kept but not counted.

Measurement:

- Umami (track=founders): `watchdog-cta` (with `from`), `watchdog-view` (from, prefilled), `watchdog-signup`
  (from, qualified, dns, plan, domains), `watchdog-error`; `watchdog-preview-submit` in preview builds.
- Source of truth for the gate: KV entries `wd:entry:*` in the quiz Worker's namespace, one per email, with metadata
  `q` (1 = qualified), `from`, `plan`, `dns`. Count with
  `npx wrangler kv key list --binding QUIZ_RL --prefix wd:entry:` (Umami submit counts run high).
- First-touch source (landing page, UTM, referrer) rides along from the existing `nk_src` and is in each lead copy.
- Funnel for the scoreboard, per touchpoint: CTA clicks / touchpoint views, page views, signups, qualified signups,
  yearly vs monthly preference. Denominators are Umami views for the touchpoint page in the same week.

**Gate (target, master plan section J, Dec 13 2026): 25+ qualified waitlist signups, or 3 paid beta.** The paid-beta
branch needs a Stripe product, which is out of scope until Michael decides. Recommendation: judge Dec 13 on
qualified signups only, and also report the share choosing yearly (annual adoption changes the model).

Honest limit: traffic is thin (GA ~757 visits in 30 days to Nov 7; founders pages mostly paid ad traffic that is now
paused). 25 qualified signups is unlikely from organic site traffic alone in 4 weeks, so the waitlist needs a
founder-facing channel (newsletter issue, own social posts; no Reddit/IH promo posts) to give the test a fair read.

### Going live (needs Michael)

1. Michael OKs showing the waitlist and planned prices on the site (section L), in words, with a date.
2. Deploy the quiz Worker (`workers/quiz`, adds `POST /watchdog`; no new secrets, KV or CSP hosts).
3. Build with `PUBLIC_WATCHDOG_WAITLIST=live` (add it to the build env in the deploy steps), then the usual
   regression checks.
4. Set the `watchdog-waitlist` entry in `src/data/experiments.json` to live with his OK.

Rollback: rebuild without the variable (default `off`): every link disappears and the page becomes a redirect.
Entries already collected stay in KV until their 365-day TTL; delete with `wrangler kv key delete` on request.

## 3. Reusing the Lockdown rechecks (observed in code, `6b46bc4`)

- `workers/lockdown/src/audit.js` `audit(domain, { resolve })` is pure and has an injectable resolver: reusable as-is
  for a **baseline** (provider, DNS host, DKIM selectors, SPF/DMARC state, extras).
- `index.js` `recheckAll` is order-shaped, not subscription-shaped: it lists all `order:` keys in KV, rechecks on
  fixed days (2/5/10) and then closes. Watchdog needs a daily schedule per subscription, change detection against a
  reference state, and deduplicated alerts. Reuse the pattern (cron + KV + idempotent Resend), not the function.
- Cost of a full audit: **55 DNS lookups** for a synthetic Google domain, **51 for neonkey.tech** (observed Nov 13,
  prototype counter). Cloudflare Workers allow 50 subrequests per invocation on the free plan, so the audit cannot
  run daily for many domains in one invocation.
- Prototype finding: a daily snapshot that checks only the selectors found at baseline needs **10 lookups**, about
  a fifth.

## 4. Bounded MVP design (recommendation; build only after the gate and Michael's yes)

**In scope (v1, basic tier, one domain):** SPF (present, single, ending, lookups, sender list), DMARC (present,
single, policy, reports), DKIM (selectors found at baseline), MX and NS changes, domain-control TXT proof,
email alerts, a monthly "all still good" email.

**Planned but not v1:** HTTPS certificate expiry (a Worker's fetch doesn't expose the certificate, so this needs CT
logs or an outside check, to be costed), domain registration expiry (RDAP, fetchable from a Worker), homepage
uptime (`fetch` with a timeout from the daily cron; it's daily, not minute-level, and should say so). Pro features
(10 domains, website change watch) stay out.

**Architecture (one new Worker, `workers/watchdog`, sharing nothing):**

1. Signup: Stripe Payment Link (monthly + yearly) -> webhook -> account in D1 (`accounts`, `domains`,
   `snapshots`, `alerts`). Entitlement = an active subscription; a refund or cancel stops checks at period end.
2. Domain added -> `ownershipRecord()` gives the TXT to add at `_neonkey-watchdog.<domain>`. Nothing is checked
   until `verifyOwnership()` passes. Re-verified weekly; if the record is removed, checks pause with one email.
3. Baseline with the vendored Lockdown `audit()` (one domain per invocation, from a Queue).
4. Daily cron enqueues one message per verified domain. Consumer runs `snapshot()` (about 10 lookups), then `step()`
   against the stored state. A warning or critical change is rechecked 15 minutes later and only alerted if
   `confirmed()` (anti-flap).
5. Alerts via Resend from `NeonKey 🔑 <hello@neonkey.tech>`, idempotency key per domain + alert id + day. Each alert
   has "I meant to do this", which calls `acknowledge()`.

**Abuse and privacy:** only TXT-verified domains, a per-account domain cap, public DNS only, no logins, no customer
credentials. Stored: email, domain, snapshots (public data), alert history. Retention: 30 days after cancellation.
Privacy and Terms sections are required before launch.

**Costs and capacity (assumptions to verify before build):** Workers Paid plan ($5/mo base) for Queues, D1 and Cron
headroom; DoH lookups are free but rate-limited by Cloudflare (unpublished; keep about 10 per domain per day).
Resend: current plan limits must be checked before launch, since Desk, quiz, welcome and Lockdown already share it.
Support: the alert text carries the fix, so the target is under 5 minutes of founder time per account per month;
measure in the beta.

**Tests before launch:** fixture tests for every alert rule (in place, `prototypes/watchdog`), webhook signature
tests, an ownership test, a "two snapshots disagree" flap test (in place), and an end-to-end shadow run on NeonKey's
own six domains for 14 days with alerts going to hello@ only.

## 5. The prototype (`prototypes/watchdog/`)

Not a Worker and not deployed. `npm test` (12 tests, synthetic `.test` domains), `npm run demo` (7-day drift
timeline with the alert each day), `npm run own -- neonkey.tech` (live public DNS, refuses any domain that isn't
NeonKey's own). It imports the Lockdown engine in place to prove reuse; a real Worker vendors a copy.
