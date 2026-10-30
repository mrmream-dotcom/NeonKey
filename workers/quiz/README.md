# neonkey-quiz Worker

Backend for the "What service do I need?" quiz at https://neonkey.tech/services/quiz/.
The result is calculated in the browser; this Worker only runs when a visitor asks for
their plan by email.

`POST /plan` with JSON `{ email, first_name?, answers, newsletter, website }`:

1. Origin must be `https://neonkey.tech` or `https://www.neonkey.tech` (CORS locked to those).
2. `website` is a honeypot: if filled, the Worker replies `ok` and sends nothing.
3. Email and answers are validated (answers against a strict whitelist), and the plan is
   recomputed server-side from the shared logic in `../../src/data/quiz.ts`.
4. Rate limits in KV (`QUIZ_RL`, hashed keys, ~24h TTL): one plan per email per day,
   `IP_DAILY_LIMIT` per hashed IP per day, `GLOBAL_DAILY_LIMIT` total per day.
   Counted only after a successful send.
5. Sends the plan via Resend from `FROM_ADDRESS`, then a lead copy to `LEAD_TO`
   (reply-to = the visitor).
6. Only if `newsletter` is true: creates the Kit subscriber as inactive and adds them to
   form 10118914, which triggers Kit's double opt-in. The welcome Worker handles the rest.

## Deploy

```sh
npm ci
CLOUDFLARE_ACCOUNT_ID=13d2e240576e100fbd65b2499bd6c048 npx wrangler deploy
# secrets (never commit, never echo):
printf '%s' "$RESEND_API_KEY" | npx wrangler secret put RESEND_API_KEY
printf '%s' "$KIT_API_KEY"    | npx wrangler secret put KIT_API_KEY
printf '%s' "$MAILING_ADDRESS" | npx wrangler secret put MAILING_ADDRESS   # postal address for the email footer (CAN-SPAM)
```

Live at https://neonkey-quiz.mr-mream.workers.dev/plan (set in `src/config.ts` as `QUIZ_API_URL`).
