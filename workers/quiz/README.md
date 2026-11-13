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

## Free Starter IT Kit: `POST /kit`

Used by https://neonkey.tech/free-it-kit/. JSON `{ email, first_name?, newsletter, website }`.
Same origin lock, honeypot, email check and Resend sender as `/plan`. Emails the download link
(`KIT_DOWNLOAD_URL` in `wrangler.toml`, a file in `public/downloads/`) once per address per day,
sends a lead copy to `LEAD_TO`, and starts Kit's double opt-in only if `newsletter` is true.
Rate-limit keys are prefixed `kit:` so they don't collide with plan requests; daily cap is
`KIT_GLOBAL_DAILY_LIMIT`. The spreadsheet is built by `build_free_kit.py` (project files,
products/it-kit/). If you rebuild it, keep the same path or update `KIT_DOWNLOAD_URL`.

## Founder Watchdog waitlist: `POST /watchdog`

No longer linked from the site (the waitlist closed Nov 13 2026 when Founder Watchdog went on sale, see workers/watchdog/). Was used by https://neonkey.tech/founders/watchdog/ when the site was built with `PUBLIC_WATCHDOG_WAITLIST=live`
(default `off`). Waitlist only: nothing is sold, nothing is monitored. Code in `src/watchdog.js`; the answer
whitelist and the "qualified" rule live in `../../src/data/watchdog.ts`, shared with the page.

JSON `{ email, domain, answers: { dns, domains, plan, watch[], from }, website, src }`. Same origin lock, honeypot and
JSON checks as the other routes. Stores one entry per email at `wd:entry:<hash>` in `QUIZ_RL` (365-day TTL) with key
metadata `{ q, from, plan, dns, created }`; a repeat signup updates it and sends no second confirmation. Sends the
visitor one confirmation and `LEAD_TO` a lead copy. Limits: `WD_IP_DAILY_LIMIT` (default 5) per hashed IP,
`WD_GLOBAL_DAILY_LIMIT` (default 200) per day. Count the gate with:

```sh
npx wrangler kv key list --binding QUIZ_RL --prefix wd:entry:   # metadata.q = 1 means qualified
```

Delete an entry on request with `npx wrangler kv key delete --binding QUIZ_RL <key>`.

## Tests

```sh
npm test    # node --test, stubbed KV and Resend, no network
```

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
