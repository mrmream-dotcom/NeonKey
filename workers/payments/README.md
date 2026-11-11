# neonkey-payments

Stripe for NeonKey: a webhook Worker plus three small local scripts. **Live since Nov 4 2026**
(products and pay links are in the live account). Scripts still default to test keys and need `--live`
for a live key. Shares nothing with the other workers.

## How NeonKey takes money

Every offer on the site is a "from" price that gets scoped first, so there are no Buy buttons on the site.
After a job is scoped, Michael sends one of these:

| Situation | Stripe product | How |
| --- | --- | --- |
| Scoped project, remote or on-site (IT Setup, Quick Win, AI Intake, Lead-Routing, Front Office, Tune-Up) | **Invoicing**: Stripe emails an invoice with a hosted pay page (card, bank, Apple/Google Pay, Link) | Stripe Dashboard or the Stripe phone app (Invoices > Create). `npm run invoice` does the same from a terminal. |
| Monthly Remote Support Plan ($99/mo flat, no trial) | **Billing**: subscription through a reusable Payment Link; Stripe charges monthly, retries failed cards, emails receipts | `npm run checkout-link -- --offer support_plan_monthly --reusable` (once), then send that link. Leave out `--reusable` for a 24-hour link tied to one email. |
| Fixed-price item in an outreach email ($29 Email Lockdown) | **Payments**: reusable Payment Link | `npm run checkout-link -- --offer email_lockdown --reusable` |
| On-site job paid on the spot | Invoice with the client there: open its pay page on their phone | Dashboard or app, due today |

This follows Stripe's integration planner (run Nov 4 2026): invoices made by hand per job in the Dashboard,
the hosted invoice page for payment, Dashboard for reconciliation (export CSV for the accountant), a
no-code Payment Link for the flat-rate subscription, the customer portal for self-service, and Smart Retries.

Customers who want to update their card or cancel the support plan use Stripe's no-code
**customer portal** link (Dashboard > Settings > Billing > Customer portal > turn on the login link).

The Front Office Package includes 3 months of the support plan, and after that it continues only if the
client chooses. So it's invoiced as one $999 job, and the support-plan link is sent in month 3 only if
they want to keep it. Don't start a subscription that auto-charges in month 4.

## Catalog

`scripts/offers.mjs` reads every price from the site (`src/data/services.ts`, and `src/pages/local.astro`
for the $249 tune-up), so the site stays the single source of truth. Each offer is one Stripe Product
with a fixed ID (`nk_quick_win`, ...) and one founding-rate Price with the same `lookup_key`.
`npm run catalog` shows the diff and `--apply` writes it. If a site price changes, re-run it: the new
Price takes over the lookup key and the old one is archived. Offer keys:
`remote_it_setup, support_plan_monthly, quick_win, ai_intake, lead_routing, front_office, onsite_tuneup, email_lockdown`.

**Tax:** `automatic_tax` is off on purpose. Stripe Tax collects nothing without an active registration.
Check with a tax professional whether any local sales tax applies to your services (rules differ by city and borough) before turning it on.

## Keys (never in the repo, never in chat)

Use a **restricted key** for the scripts (Dashboard > Developers > API keys > Create restricted key,
test mode). Permissions: Customers write, Products write, Prices write, Invoices write, Invoice items write,
Checkout Sessions write, Payment Links write. Everything else none. Keep it in your shell only:

```sh
cd workers/payments && npm ci
read -rs STRIPE_API_KEY && export STRIPE_API_KEY   # paste, Enter (nothing is shown)
npm run catalog                 # dry run
npm run catalog -- --apply
npm run invoice -- --email you+test@example.com --name "Test Client" --offer onsite_tuneup   # draft
npm run invoice -- --email you+test@example.com --offer quick_win --amount 149 --desc "Quick Win: auto-reply setup" --send
npm run checkout-link -- --offer support_plan_monthly --email you+test@example.com
```

The scripts refuse a live key unless you pass `--live`.

## Webhook Worker

`POST /webhook` verifies the `Stripe-Signature` header (HMAC-SHA256 via WebCrypto in `src/verify.js`, 5-minute replay window, constant-time compare; tests check it against the official SDK signer) with `STRIPE_WEBHOOK_SECRET` before reading anything,
then emails a short notice From `NeonKey 🔑 <hello@neonkey.tech>` to `NOTIFY_TO`, BCC `BCC_ADDRESS`
(payments, failed payments, new/canceled subscriptions, refunds, disputes, fraud warnings). A Resend
idempotency key per event stops duplicate emails when Stripe retries. If the email fails the Worker
returns 500 so Stripe retries. Live-mode events are ignored while `ALLOW_LIVE = "false"`.
It needs no Stripe API key and stores nothing.

### Founder Stack auto-delivery (`src/deliver.js`)

A paid `checkout.session.completed` (or `async_payment_succeeded`) from the Founder Stack Payment Link
(`FOUNDER_STACK_LINK`, or metadata `offer=nk_founder_stack_guide`) emails the buyer the PDF as an attachment,
From hello@, BCC `BCC_ADDRESS`, with the Lockdown domain from the checkout's `domain` field (or a "reply with
your domain" line). Idempotency key `founder-stack-<session id>` stops duplicates. If the PDF is missing or
Resend fails it returns 500 so Stripe retries; a checkout with no buyer email alerts `NOTIFY_TO` instead.

The PDF lives only in the private KV namespace `neonkey-products` (binding `PRODUCTS`, key
`founder-stack/the-founder-stack-neonkey.pdf`). It is never committed, never on the site, and the Worker has
no route that serves it. To ship a new edition, overwrite that key:
`npx wrangler kv key put --namespace-id d078b508b3954a908d17fe7bc72c8a65 founder-stack/the-founder-stack-neonkey.pdf --path ./the-founder-stack-neonkey.pdf --remote`.
The included Email Lockdown is still run by hand from the BCC copy.

Deploy (test mode):

```sh
npm ci
export CLOUDFLARE_ACCOUNT_ID=13d2e240576e100fbd65b2499bd6c048   # plus CLOUDFLARE_API_TOKEN
npx wrangler deploy
printf '%s' "$RESEND_API_KEY" | npx wrangler secret put RESEND_API_KEY
```

Then in Stripe (test mode) > Developers > Webhooks > Add endpoint:
`https://neonkey-payments.mr-mream.workers.dev/webhook`, API version `2026-10-28.endive`, and select only:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
`invoice.paid`, `invoice.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`, `radar.early_fraud_warning.created`.
Copy its signing secret and run `npx wrangler secret put STRIPE_WEBHOOK_SECRET` (paste when asked).

Dashboard settings to turn on (test and live):
- Settings > Payment methods: keep dynamic payment methods on, turn on Link. Turn on Adaptive Pricing (Checkout settings).
- Settings > Branding: logo, brand color, invoice footer (applies to every invoice, receipt and Checkout page).
- Settings > Customer emails: successful payments, refunds, and finalized invoices.
- Settings > Billing > Revenue recovery: Smart Retries on, failed-payment emails on, automatic card updates on.
- Settings > Billing > Customer portal: allow cancel (at period end) and payment-method updates; turn on the login link.
- Settings > Tax: confirm the head office address. Leave collection off for now; Stripe's free threshold monitoring
  alerts if sales cross a tax threshold. Products already carry tax code `txcd_20030000` (general services).

`npm test` runs the webhook tests with fake secrets and no network.

## Going live (done Nov 4 2026; kept as a checklist)

1. Account activated with the LLC's details and EIN, bank account added, 2FA with an authenticator app or passkey.
2. Create a **live** restricted key and a live webhook endpoint (same events), set the live signing secret.
3. Set `ALLOW_LIVE = "true"`, redeploy, run `npm run catalog -- --apply --live`.
4. Review Stripe's go-live checklist: https://docs.stripe.com/get-started/checklist/go-live
