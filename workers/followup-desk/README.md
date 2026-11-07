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
8. **Monday report** at 8 AM owner time: sent, replies, won, still open, bad addresses.
9. **Billing.** `customer.subscription.updated/deleted` set the billing state. Sending stops unless the subscription
   is active or trialing. 30 days after cancel, the account and every key for it are deleted. Signing up again within
   30 days brings the list back. Cancel/billing is the Stripe customer portal (`PORTAL_URL`).

Every status change (reply, Won/Lost/Stop, bounce) is also written to its own `stop:` key and checked right before
each send, so a cron run holding an older copy of the account can't send one more follow-up after a reply.

## Privacy

- Michael (BCC_ADDRESS) is copied on NeonKey's own emails: welcome, sign-in links, Monday reports, notices.
- He is **not** copied on follow-ups or reply forwards. Those are the customer's own correspondence with their
  clients. This is a deliberate exception to the "BCC every outbound email" rule; it's called out in the PR.
- Reply contents are passed through and not stored. Closed jobs are dropped after 90 days.

## Settings (`wrangler.toml`)

| Var | Meaning |
| --- | --- |
| `APP_URL` | Base URL in dashboard links (workers.dev for now). |
| `DESK_DOMAIN` | Sending + reply domain (`desk.neonkey.tech`), kept apart from neonkey.tech's reputation. |
| `DESK_PAYMENT_LINK` | The $250/mo Payment Link id. Empty = no checkout creates accounts. |
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
3. Cloudflare: `npx wrangler kv namespace create neonkey-desk` and put the id in `wrangler.toml`; deploy; set the
   three secrets; Email Routing on `desk.neonkey.tech` with a catch-all rule sent to this Worker.
4. Stripe webhook to `<APP_URL>/stripe` with `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`; set `DESK_PAYMENT_LINK`, then `ALLOW_LIVE = "true"`.
5. Put the Payment Link in `followUpDesk.buyUrl` (`src/data/services.ts`) so the site shows "Start now".
6. Test end to end with a Stripe test-mode checkout, then one live purchase and refund if Michael wants.

## Develop

`npm test` (fake KV, stubbed Resend, signed fake events; no network). `npm run preview` writes sample pages and
emails to `preview/` (git-ignored).
