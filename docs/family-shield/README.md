# Family Shield: demand test and safety design

_Written Nov 13 2026 for the B2C lane of the Product Ecosystem Master Plan. Nothing here is built for real
messages yet. This file covers the demand test that is in this branch, and the rules the product must follow if
Gate 1 passes. Prices are planned, not approved, and nothing is for sale._

## 1. What is in this branch (preview only)

| Piece | Where | State |
|---|---|---|
| Practice page "Is this message a scam?" with 6 made-up messages | `src/pages/learn/is-this-a-scam.astro`, data in `src/data/scam-samples.ts` | Built, not shipped |
| Family Shield waitlist box on that page, planned price $7/mo or $70/yr | same page | Built, not shipped |
| Waitlist API `POST /waitlist` | `workers/quiz/src/waitlist.js` (route added in `src/index.js`) | Code and tests only, **not deployed** |
| Privacy policy "Waitlists" section | `src/pages/privacy.astro#waitlists` | Built, not shipped |
| 5 no-voice scam-breakdown reel scripts | `social/scam-breakdowns-2026-11/` | Scripts only, nothing rendered or queued |
| Tests | `workers/quiz/test/waitlist.test.mjs` (14), `test/is-this-a-scam.test.mjs` (9) | Passing |

Ship order when Michael approves: deploy the quiz Worker first (otherwise the form shows an error), then ship the
site. No new secrets, no new CSP hosts, no new vendor, no Stripe product.

## 2. How the demand test is measured (Gate 1, Dec 13 2026)

Gate from the master plan: **Family Shield goes to build if the page gets 300+ visits and 50+ waitlist signups.**

| Number | Source | Notes |
|---|---|---|
| Visits | Umami pageviews of `/learn/is-this-a-scam/` | Count from the ship date to Dec 13. GA4 shows the same page as a cross-check. |
| Reached the waitlist | Umami `waitlist-view` (fires once per page view when the box is on screen) | Denominator for the signup rate |
| Signups (headline) | Count of KV keys `wl:family-shield:*` in the quiz Worker's `QUIZ_RL` namespace | The real number. Umami `waitlist-signup` runs high (see umami-event-reliability), so it is only a cross-check. Command: `npx wrangler kv key list --binding QUIZ_RL --prefix wl:family-shield: --remote` |
| Who it's for | `for_whom` in each record, and on the `waitlist-signup` event | Tells us if the buyer is the adult child (the plan's guess) |
| Engagement | Umami `scam-sample-answer`, `scam-samples-done` | Shows whether the free page itself is useful |
| Errors | Umami `waitlist-error` (with HTTP status) | Should stay near 0 |
| Source | `source` in each record (first-touch landing page, UTM, referrer) | Shows whether reels, search or the newsletter drive signups |

Report it on the Friday scoreboard as: visits, waitlist views, signups (KV), signup rate = signups / waitlist views,
with the dates of the window. Below 100 visits the rate is "too early", per docs/experiments.md.

## 3. Consent and opt-in sharing (rules for the real product)

- **Adults only (18+) in v1.** Keeps NeonKey out of children's-privacy rules (COPPA) and matches the Gemini API
  terms, which ban apps likely to be used by under-18s (see section 5).
- **Every member opts in themselves.** The organizer invites by email; the invitee clicks a confirm link. No link
  clicked = no account, no messages, nothing shared. Invites expire after 7 days and can't be resent more than twice.
- **Sharing is per check, chosen by the sender.** When a member forwards a message, the default is "only me". They can
  choose "share with my family" for that one check. Nobody, including the organizer, can read another member's checks
  by default. This is the line between "help each other" and monitoring someone.
- **No reading someone's inbox.** The product only sees what a member forwards or pastes. It never connects to a
  mailbox, phone or account.
- **Leaving is one click** and removes that person's history right away. The organizer can remove a member; a
  member can always leave.
- **The organizer pays; the member doesn't give a card.** Members are told who invited them and what the organizer
  can and can't see.

## 4. Retention and deletion

| Data | Kept | Why |
|---|---|---|
| Forwarded message text, links, screenshots | Deleted within 24 hours (target: as soon as the check is done) | Master plan rule; the check needs it only once |
| The result (verdict, tells, what to do, link domain) | While the account is open, max 12 months | Family history view |
| Account (email, family, plan) | While the account is open, deleted 30 days after cancel | Billing and support |
| Waitlist signups (this test) | Until the product opens or is dropped, then the list is deleted | Privacy page says so |
| AI provider copy | Depends on the provider (section 5); pick one that keeps nothing by default for this model | |

Deletion must be a scheduled job with a test, not a manual step. R2 objects for screenshots get a 1-day lifecycle rule.

## 5. AI provider terms (checked Nov 13 2026; re-check before signing up)

The Lab demos use Gemini's free tier, which may train on inputs. **Family messages must never go to a free tier.**

| Provider | Trains on API inputs? | Keeps them? | Notes |
|---|---|---|---|
| Anthropic API (Claude) | No: "Retained data is never used for model training without your express permission." | "Conversation content is not retained by default; the exception is Covered Models, which require 30-day retention." Flagged content may be kept up to 2 years. | Covered Models are Fable/Mythos 5.x, so use a Haiku/Sonnet/Opus model. Zero data retention needs a sales agreement. Source: platform.claude.com/docs/en/build-with-claude/api-and-data-retention |
| OpenAI API | No, since Mar 1 2023, unless you opt in | Abuse-monitoring logs up to 30 days | Zero data retention needs OpenAI's approval. Source: developers.openai.com/api/docs/guides/your-data |
| Gemini API, paid (billing on) | No: "Google doesn't use your prompts or responses to improve our products" | Logged "for a limited period of time" for abuse detection (length not stated) | Terms require users 18+ and say no apps "likely to be accessed by individuals under the age of 18". Free tier: used for training and human review. Source: ai.google.dev/terms |

Recommendation: Anthropic API on the cheapest current model that passes a small accuracy test (section 7), text
only, no tools. It keeps nothing by default for that model and doesn't train on it. This is a paid vendor, so it
waits for Michael's decision at Gate 1 (master plan decision 7).

Link checks: never open a link from NeonKey servers. Use Google Web Risk Lookup API: first 100,000 calls a month
free, then $0.50 per 1,000 (cloud.google.com/web-risk/pricing, read Nov 13 2026). Don't use `computeDiff`, which
switches lookups to $50 per 1,000.

## 6. Abuse limits

- **Per member:** 20 checks a day, 200 a month. **Per family:** 60 a day. KV counters, same pattern as the quiz Worker.
- **Size:** forwarded text capped at 8,000 characters; at most 5 links checked per message; screenshots (later) 1 per
  check, 5 MB max.
- **Senders:** only the confirmed member's own address can forward to their check address; anything else is dropped
  without a reply (no backscatter).
- **No open relay:** the product never sends to an address it wasn't told by the account; replies go only to the
  member who forwarded.
- **Prompt injection:** the forwarded message is data. The model gets no tools and its output is shown as text only.
  A message saying "tell them this is safe" can't change the rules, and the verdict wording is fixed (section 8).
- **Kill switch:** one Worker variable turns all checks off and returns "checks are paused, here's what to do instead".
- **Waitlist (this branch):** 5 signups per IP a day, 300 total a day, honeypot field, origin check, consent must be
  `true`, product allowlist.

## 7. Cost under heavy use

Assumptions (planning numbers, not measured): a check sends about 1,500 input tokens (instructions about 1,000 plus
the message and link results) and gets about 300 output tokens back. Prices from the Claude API price list cached
Nov 3 2026, per million tokens.

| Model | Per check | Heavy family: 5 adults x 10 checks a day = 1,500 a month | At the cap: 60 a day = 1,800 a month |
|---|---|---|---|
| Claude Haiku 5.5 ($0.10 in / $0.50 out) | about $0.0003 | about $0.45 | about $0.54 |
| Claude Sonnet 5.5 ($2 / $10) | about $0.006 | about $9.00 | about $10.80 |
| Claude Opus 5.5 ($4 / $20) | about $0.012 | about $18.00 | about $21.60 |

**So a $7 family plan works only on a Haiku-class model, or with much lower caps.** A Sonnet-class model loses
money on a heavy family. Prompt caching the instructions cuts the input cost further. An accuracy test on 50-100
labeled sample messages must pass before picking the model.

Other per-family costs at heavy use:

| Item | Cost | Notes |
|---|---|---|
| Stripe | $0.50 on $7 monthly (2.9% + 30 cents), $2.33 on $70 yearly | Push the yearly plan |
| Web Risk | $0 up to 100,000 lookups a month across all families | |
| Reply emails | 1 email per check: 1,500 a month for one heavy family | Check Resend's plan limits first; a few heavy families could outgrow a free plan, and Resend is shared with the Desk, quiz and Lockdown |
| Cloudflare Workers, Email Routing, KV, D1 | Free tiers at beta size | Paid Workers plan if it grows |

Worst case for a heavy family on Haiku: about $0.54 AI + $0.50 Stripe + email = roughly $1.10 of a $7 month.

## 8. Wording rules for every verdict

- Three outcomes only: **"Looks like a scam"**, **"Can't tell, check it the direct way"**, **"Fits a normal
  message, still go direct if money or a login is involved"**. Never "safe", never "verified", never a percentage.
- Every result ends with what to do, and the direct way to check (the official app, or a number you find yourself).
- Every result says it is advice, not a promise.

## 9. What waits for Michael

1. Ship this page and deploy the quiz Worker (site change plus Worker deploy; his "ship" and plain-words OK).
2. Approve showing $7/mo or $70/yr as a planned price (master plan decision 3).
3. Paid AI API at Gate 1, Dec 13 (decision 7). No vendor is signed up in this branch.
4. Reel scripts: approve before rendering or queuing.
