# neonkey-followup-desk

The self-serve **Follow-Up Desk** ($250/month). A business buys it, sets it up, and runs it with nobody at NeonKey
touching the account. The $999 Front Office Package stays the custom, done-with-you setup.
Shares nothing with the other workers (its own Stripe endpoint and secret, its own KV, its own sending domain).

## What happens

1. **Buy.** The Stripe Payment Link (`DESK_PAYMENT_LINK`, a $250/mo subscription with a `business` custom field)
   sends `checkout.session.completed` to `POST /stripe`. The signature is checked (WebCrypto, 5-minute window).
2. **Account.** The Worker creates the account and emails the buyer a private dashboard link. The link is the login:
   a 256-bit random token, and only its SHA-256 hash is stored. Up to 5 live links per account; "email me a new link"
   at `/login` (buyer email only, max one email per 10 minutes, same page whether or not the account exists).
3. **Setup** (dashboard, no JavaScript, strict CSP): business name, reply-to email, sign-off, time zone. Settings page:
   follow-up days (default 3, 7, 14), copy-me toggle, and the three messages for each type (estimate, unpaid
   invoice, new inquiry). "Send me a preview" sends follow-up #1 to the owner; replying to it shows the reply flow.
4. **Add follow-ups**: one at a time, or paste a CSV/TSV (QuickBooks, Jobber, a spreadsheet). The email column is
   found by content, the rest by header names. One open follow-up per email address; max 500 open per account.
5. **Sending** (cron, hourly): weekdays 9 AM to noon in the owner's time zone, at most 60 a day per account, never two
   follow-ups for the same job within 2 days. From `"<Business>" <followups@DESK_DOMAIN>`, Reply-To
   `r-<account>-<job>@DESK_DOMAIN`, with `List-Unsubscribe` (one-click) and a small "Sent for <Business> by
   NeonKey Follow-Up Desk" footer. After the third, the job is "Finished, no reply".
6. **Stop on reply.** Cloudflare Email Routing sends everything for `DESK_DOMAIN` to this Worker's `email()` handler.
   A reply marks the job Replied and is passed to the owner's inbox (Reply-To set to the customer, attachments up to
   10 MB). Out-of-office auto-replies are passed on but do **not** stop follow-ups. A reply with subject "stop" stops
   them. If the owner replies to their own copy, they're told it didn't reach the customer.
7. **Bounces and spam complaints** (`POST /resend`, Svix-signed Resend webhook): that job stops and shows as
   "Bad address" in the dashboard and the Monday report.
8. **One-tap buttons** (on by default, Settings > "Buttons in your follow-ups"): each follow-up carries
   "Yes, let's go ahead" (estimates; "Yes, let's set up a time" for inquiries; none for invoices) and "I have a
   question", linking to `/a/<account>/<job>/<yes|ask>`. GET only shows a short form, so email link scanners can't
   trigger anything; POST emails the owner right away (Reply-To the customer, text escaped), marks the job Replied
   and writes its `stop:` key. One message per job every 10 minutes. Optional **payment link** (any https link the
   owner pastes: Stripe, Square, PayPal, an invoicing app) adds "Pay the deposit" to estimates and "Pay the invoice" to
   invoices; the link goes straight to the owner's own checkout, so no money passes through NeonKey. These customer
   pages are light and plain, since they belong to the owner's business.
9. **Trial nudges**: on day 1, 3 and 10 after signup, while the account has no follow-ups yet, one short email
   (9 AM to 5 PM owner time) with a fresh dashboard link: finish setup / add your first estimate. Only the latest
   due nudge goes out, never a backlog. Nothing once a follow-up exists.
10. **Monday report** at 8 AM owner time: sent, replies, won, still open, bad addresses.
11. **Billing.** `customer.subscription.updated/deleted` set the billing state. Sending stops unless the subscription
    is active or trialing. 30 days after cancel, the account and every key for it are deleted. Signing up again within
   30 days brings the list back. Cancel/billing is the Stripe customer portal (`PORTAL_URL`).

Every status change (reply, Won/Lost/Stop, bounce) is also written to its own `stop:` key and checked right before
each send, so a cron run holding an older copy of the account can't send one more follow-up after a reply.

## When something breaks

- **Alert email.** If the hourly run can't send a follow-up or a report, hits an error, or the nightly backup fails,
  one "🚨 URGENT · Follow-Up Desk problem" email goes to `NOTIFY_TO` (at most one an hour). Same for a request or an
  incoming reply that throws. Alerts name the account id, never the customer's clients, and never the dashboard link.
  Failed follow-ups aren't counted as sent, so they retry the next hour.
- **`GET /health`** returns 200 only when the hourly run ran in the last ~2 hours with no failures and (with `BACKUP`
  bound) the nightly backup is less than 26 hours old. Otherwise 503 with a `problems` list. Point a free uptime
  monitor at `<APP_URL>/health` so a page reaches Michael even when email is the thing that's broken. Right after a
  deploy it reads 503 ("no hourly run recorded yet") until the next :05 run.
- **Logs.** Workers Logs is on, invocation logs off (request URLs carry dashboard tokens). Only the `desk:` lines are
  kept, for 3 days: Cloudflare dashboard > Workers > neonkey-followup-desk > Logs.

## Backups and restore

At the 11:05 UTC run (2:05 AM AKST) every KV key except `ops:` is written to R2 `neonkey-desk-backup` as
`desk/<date>.json`, in the format `wrangler kv bulk put` reads. Seven days are kept, so a deleted account is gone
from backups 7 days after it leaves KV (the privacy page says so). To restore:

```
npx wrangler r2 object get neonkey-desk-backup/desk/<date>.json --file backup.json --remote
node scripts/restore-prep.mjs backup.json > restore.json
npx wrangler kv bulk put restore.json --binding DESK --remote
```

Delete both files afterward (they hold customer data). One account is one KV record today; a dashboard save and an
hourly send landing in the same second can still overwrite each other (stop-on-reply has its own `stop:` keys so that
part is safe). Plan: move accounts to D1 or a Durable Object around 10 paying accounts, before that race matters.

## Privacy

- Michael (BCC_ADDRESS) is copied on NeonKey's own emails: welcome, sign-in links, Monday reports, notices.
- He is **not** copied on follow-ups or reply forwards. Those are the customer's own correspondence with their
  clients. This is a deliberate exception to the "BCC every outbound email" rule; it's called out in the PR.
- Reply contents are passed through and not stored. Closed jobs are dropped after 90 days. Nightly backups are kept
  7 days.

## Settings (`wrangler.toml`)

| Var | Meaning |
| --- | --- |
| `APP_URL` | Base URL in dashboard links (workers.dev for now). |
| `DESK_DOMAIN` | Sending + reply domain (`desk.neonkey.tech`), kept apart from neonkey.tech's reputation. |
| `DESK_PAYMENT_LINK` | Payment Link ids that create accounts, comma-separated (regular $250/mo, founding $99/mo, founding $891/yr). Empty = none. |
| `PORTAL_URL` | Stripe customer portal login link, shown as "Billing and cancel". |
| `ALLOW_LIVE` | Live-mode Stripe events are ignored unless `"true"`. |
| `FROM_ADDRESS`, `NOTIFY_TO`, `REPLY_TO`, `BCC_ADDRESS` | NeonKey 🔑 From, notices to hello@, BCC Michael. |

Secrets (never in the repo or chat): `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`.

## Going live (each step needs Michael's OK)

1. Stripe: product "Follow-Up Desk", $250/month recurring; Payment Link with a required text custom field
   `business` ("Business name") and the Terms checkbox; success page `https://neonkey.tech/follow-up-desk/thanks/`. Turn on the
   customer portal (cancel at period end) and copy its login link to `PORTAL_URL`.
2. Resend: add and verify `desk.neonkey.tech` (DNS records in Cloudflare). Add a webhook to `<APP_URL>/resend` for
   `email.bounced` and `email.complained`; its secret goes in `RESEND_WEBHOOK_SECRET`.
3. Cloudflare: `npx wrangler kv namespace create neonkey-desk` and put the id in `wrangler.toml`;
   `npx wrangler r2 bucket create neonkey-desk-backup` (deploy fails without it); deploy; set the three secrets; Email Routing on `desk.neonkey.tech` with a catch-all rule sent to this Worker.
4. Stripe webhook to `<APP_URL>/stripe` with `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`; set `DESK_PAYMENT_LINK`, then `ALLOW_LIVE = "true"`.
5. Put the Payment Link in `followUpDesk.buyUrl` (`src/data/services.ts`) so the site shows "Start now".
6. Test end to end with a Stripe test-mode checkout, then one live purchase and refund if Michael wants.

## Develop

`npm test` (fake KV, stubbed Resend, signed fake events; no network). `npm run preview` writes sample pages and
emails to `preview/` (git-ignored).
