# neonkey-family-shield

The paid **Family Shield** plan: one family, up to 5 adults (18+), paste a message you aren't sure about and get
the more cautious of two reads, our rules and an AI review. Planned price $7/month or $70/year (set in Stripe, not
here). Shares nothing with the other workers (its own Stripe endpoint and secret, its own KV).

**Checkout is closed until `FS_PAYMENT_LINK` is filled in.** Do that only after the end-to-end test below passes.

## What happens

1. **Buy.** A Stripe Payment Link listed in `FS_PAYMENT_LINK` sends `checkout.session.completed` to `POST /stripe`
   (signature checked, 5-minute window). Any other link is ignored. Live events are ignored until `ALLOW_LIVE = "true"`.
2. **Plan.** The Worker creates the family plan and emails the buyer a private link (`/f/<token>`). The link is the
   login: a 256-bit random token, only its SHA-256 hash is stored. "Email me a link" at `/login` (one email per
   10 minutes per address, same page whether or not the email is on a plan). An email already on a plan is not
   given a second plan; Michael gets a notice to refund or merge by hand.
3. **Consent.** Before the first check, each person adds a first name and confirms they're 18 or older and how
   checks are handled (text goes to Anthropic, not saved by NeonKey, advice not a promise).
4. **Invite.** The owner invites up to 4 more adults by email (10 invites a day max). The invite link works for
   7 days and opens the same 18+ consent page; accepting gives that person their own private link. The owner can
   remove anyone; their link stops working right away.
5. **Check.** Paste up to 8,000 characters. The rules in `src/rules.mjs` (an exact copy of the site's free checker,
   `src/lib/scam-check.mjs`; a test fails if they differ) always run. Then Claude Haiku 5.5 (`src/ai.js`) gives a
   second opinion with structured output, low effort, text only, no tools. **The final verdict is the more severe of
   the two**: the AI can raise it, never lower it. On a refusal, error, the kill switch or the daily cap, the result
   is rules only with a note. Limits: 20 checks a day per person, 60 per family, `AI_DAILY_CAP` AI calls a day
   across all families.
6. **Share (optional).** "Share with my family" stores the verdict, the rule ids (shown as generic phrases, never
   links or text from the message) and an optional 120-character note. The last 20 are kept.
7. **Billing.** `customer.subscription.updated` with `past_due` / `unpaid` -> rules only until fixed.
   `customer.subscription.deleted` -> checks off, everything deleted 30 days later by the daily cron.

## Privacy

The checked message is never written to KV, logged or emailed. Logs carry the verdict and whether the AI ran,
nothing else; private links are masked in error logs and invocation logs are off. Welcome emails are BCC'd to
`BCC_ADDRESS` (a sale record); invites and sign-in links are not. Site wording: `/privacy/#family-shield`.

## Setup (Michael)

None of these are in the repo or in chat. Set secrets with `npx wrangler secret put <NAME>` from this folder.

1. `npm install`, then `npx wrangler kv namespace create neonkey-family-shield` and paste the id into
   `wrangler.toml`.
2. **Anthropic key.** Claude Console > API keys > create a key just for this Worker. Under Limits, set a monthly
   spend limit (a few dollars is plenty to start). `npx wrangler secret put ANTHROPIC_API_KEY`.
3. **Resend.** `npx wrangler secret put RESEND_API_KEY` (a key that can send from neonkey.tech).
4. `npx wrangler deploy` (with `AI_ENABLED = "false"` and `FS_PAYMENT_LINK = ""` still).
5. **Stripe (test mode first).** Create the product "NeonKey Family Shield" with $7/month and $70/year prices and
   a Payment Link for each. Add a webhook endpoint `https://<APP_URL>/stripe` for `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`, then
   `npx wrangler secret put STRIPE_WEBHOOK_SECRET`.

## End-to-end test (before checkout opens)

1. Put the **test-mode** Payment Link ids in `FS_PAYMENT_LINK`, set `AI_ENABLED = "true"`, deploy.
2. Buy with a Stripe test card. Check: welcome email arrives, link opens, consent page shows, a check returns a
   result with an AI reason, and `/health` says `ai: true`.
3. Invite a second address, join from it, share a result, see it on both pages. Remove that person; their link
   shows "This link doesn't work".
4. Cancel the test subscription in Stripe. The plan page says it has ended.
5. Only then: swap in the live Payment Link ids, set `ALLOW_LIVE = "true"`, deploy, and add the buy buttons on
   neonkey.tech/scam-checker/.

Kill switch: set `AI_ENABLED = "false"` and deploy. Checks keep working on rules only.

## Tests

`npm test`: fake KV, stubbed Resend, a fake Claude client and signed fake Stripe events. No network, no secrets.
