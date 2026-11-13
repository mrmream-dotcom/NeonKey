# neonkey-watchdog

Runs **Founder Watchdog** ($9/mo or $90/yr) end to end: takes the Stripe subscription, proves the buyer controls the
domain, then checks it every day and emails when something changes or breaks. Shares nothing with the other Workers
(its own Stripe webhook endpoint and secret, its own KV namespace, its own copy of the Lockdown DNS audit).

Live at `https://neonkey-watchdog.mr-mream.workers.dev` since Nov 13 2026. Sales page: `/founders/watchdog/`.

## What happens

1. A buyer pays through one of the two Payment Links in `PAYMENT_LINKS` (checkout asks for the domain, custom field
   `domain`). Stripe sends `checkout.session.completed` to `POST /stripe`. The signature is checked (WebCrypto HMAC,
   `src/verify.js`) before anything is read. Other offers' checkouts are ignored.
2. The Worker saves `acct:<subscription id>` in KV and emails the buyer **one TXT record**:
   `_neonkey-watchdog.<domain>` = `neonkey-watchdog=<HMAC(WATCHDOG_SECRET, subscription|domain)>`. hello@ gets a note.
   If the domain typed at checkout isn't usable (gmail.com, typo), the buyer is asked to reply with it and hello@ gets
   an ACTION note (set `domain` and status `verifying` on the KV record by hand).
3. A cron every 10 minutes runs whatever is due (at most `MAX_SUBREQUESTS` = 45 outbound calls per run, the free
   plan allows 50). While verifying it looks for the TXT record hourly for 2 days, then every 6 hours, with reminders
   on day 2 and day 7 and an ACTION note to hello@ after day 7.
4. Once the record shows up: a **first look** (tries the provider's DKIM selectors plus common ones) and the
   "now watching" email with what it sees today.
5. Then **once a day**: SPF, DKIM, DMARC, MX, NS (public DNS over HTTPS), homepage over HTTPS (status under 500 = up),
   and weekly the registration expiry from RDAP (rdap.org). Anything worse than the last good state is checked again
   15 minutes later and only then emailed (anti-flap). Each alert has an "I meant to do this" button that accepts the
   new setup as the baseline. Recoveries get a short email. Expiry warnings at 30 and 7 days. A monthly all-clear.
6. `customer.subscription.updated` / `deleted` keep the status in step. Past-due subscribers are still checked;
   canceled ones get one goodbye email and their record expires from KV 30 days later.

Read-only: it never changes anything on the customer's domain and never asks for a login.

## Routes

| Route | What |
|---|---|
| `POST /stripe` | Stripe webhook (signed) |
| `GET /ack?a=<sub>&t=<token>` | Shows a confirm button; `POST /ack` accepts the change (link scanners only do GET) |
| `GET /health` | `{"ok":true}` |

## Secrets (Michael sets them; never in the repo or chat)

| Name | What |
|---|---|
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from the Stripe endpoint for `/stripe` (events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`) |
| `RESEND_API_KEY` | same kind of key the other Workers use |
| `WATCHDOG_SECRET` | random; set once at first deploy. **Never change it** while there are subscribers, or every ownership record stops matching. |
| `MAILING_ADDRESS` | optional, email footer |

## Changing a subscriber by hand

Records are JSON at `acct:<sub_…>` in the `neonkey-watchdog` KV namespace. To change a domain: set `domain`, set
`status` to `verifying`, clear `state`, set `nextAt` to now, then email the buyer their new TXT record (or let the
next run's reminder do it). Writing through the dashboard drops the key metadata (`{n, s}`) the cron lists by, so
use `wrangler kv key put --metadata '{"n":0,"s":"verifying"}'`.

## Tests

`npm test`: 21 tests with a fake KV, stubbed DNS/web/RDAP/Resend and signed fake Stripe events. No network, no secrets.
Also runs in CI (`.github/workflows/ci.yml`, workers matrix).

## Deploy

`npx wrangler deploy` (Michael's OK first). KV id and vars are in `wrangler.toml`.
