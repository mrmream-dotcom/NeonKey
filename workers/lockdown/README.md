# neonkey-lockdown

Runs the $49 **Email Lockdown** end to end with no manual step. Shares nothing with the other workers
(its own Stripe webhook endpoint and secret, its own KV namespace).

## What happens

1. A buyer pays through the Email Lockdown Payment Link. Stripe's checkout already asks for their domain
   (custom field `domain`).
2. Stripe sends `checkout.session.completed` to this Worker's `POST /webhook`. The signature is checked
   (WebCrypto HMAC, 5-minute replay window) before anything is read. Only sessions from `LOCKDOWN_PAYMENT_LINK`
   with `payment_status = paid` are handled. Delayed payment methods arrive later as `async_payment_succeeded`.
3. `src/audit.js` reads the domain's **public** DNS through Cloudflare DNS-over-HTTPS: MX (which email provider),
   NS (which DNS host), SPF, DMARC and DKIM. No logins, nothing changed.
4. The buyer gets a branded email (`src/email.js`) with the exact records to add, written for their provider
   (Google Workspace, Microsoft 365, Zoho, Fastmail, Proton, Titan, GoDaddy email, Namecheap Private Email, or forwarding via Porkbun, Cloudflare Email Routing or ImprovMX), a link to their DNS host's own guide, the DKIM click-path for their admin
   console, and the "$49 counts toward any NeonKey package" credit (Michael, Nov 4 2026).
5. hello@ (BCC Michael) gets a short notice. The subject starts with **FYI** when everything was automatic and
   **ACTION NEEDED** only when a person has to step in.
6. A daily cron (8:07 AM AKST) rechecks open orders:
   - day 2: quiet unless everything passes, then a "locked down" email
   - day 5: if still open, one friendly reminder with what's left
   - day 10: if still open, ACTION NEEDED to hello@ and the order is closed for automation

### When a person is needed (ACTION NEEDED)

The Worker never guesses. It hands off when it can't write a safe record:

- the domain doesn't exist, has no mail server, isn't valid, or is a personal mailbox (gmail.com and similar)
- the email provider isn't one we write records for (for example MXroute, iCloud or Yahoo)
- two SPF or two DMARC records (merging needs judgment)
- SPF would go over the 10-lookup limit
- still not finished after 10 days

In those cases the buyer still gets a short, branded holding email (or the records it *could* write safely) so
nobody is left waiting.

### What it stores

KV `ORDERS`, key `order:<checkout session id>`: buyer email and name, domain, recheck count and status.
Every entry expires after 60 days. No payment details. Re-delivered Stripe events for the same session do nothing.

## Settings (`wrangler.toml`)

| Var | Meaning |
| --- | --- |
| `LOCKDOWN_PAYMENT_LINK` | The live Email Lockdown Payment Link id. Other links are ignored. |
| `ALLOW_LIVE` | Live-mode events are ignored unless `"true"`. |
| `CUSTOMER_EMAILS` | `"shadow"`: buyer emails go to hello@ only, subject `[SHADOW for buyer@...]`. `"send"`: they go to the buyer. |
| `FROM_ADDRESS`, `NOTIFY_TO`, `REPLY_TO`, `BCC_ADDRESS` | NeonKey 🔑 From, notices to hello@, every email BCC'd to Michael. |

Secrets (never in the repo, never in chat): `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`. No Stripe API key is needed.

Optional secret `BROWSER_TOKEN`: a Cloudflare API token with **Account > Browser Rendering > Edit**. With it, the report is attached as a one-page PDF (rendered by Cloudflare Browser Rendering for the account in `CF_ACCOUNT_ID`). Without it, or if a render fails, the same report is attached as an HTML file and the email tells the buyer to open it in a browser.

## Deploy (needs Michael's OK)

```sh
cd workers/lockdown && npm ci && npm test
export CLOUDFLARE_ACCOUNT_ID=13d2e240576e100fbd65b2499bd6c048   # plus CLOUDFLARE_API_TOKEN
# KV namespace already exists (neonkey-lockdown-orders); id is in wrangler.toml
npx wrangler deploy
printf '%s' "$RESEND_API_KEY" | npx wrangler secret put RESEND_API_KEY
```

Then in Stripe (live) > Developers > Webhooks > Add endpoint:
`https://neonkey-lockdown.mr-mream.workers.dev/webhook`, events `checkout.session.completed` and
`checkout.session.async_payment_succeeded` only. Copy its signing secret and run
`npx wrangler secret put STRIPE_WEBHOOK_SECRET`.

Optional Stripe tweak: change the Payment Link's confirmation message to say the report arrives by email in a
few minutes (today it says "We'll email you shortly to get your domain details").

## Try it

```sh
npm test                                         # 22 tests, fixture DNS, no network, no keys
npm run audit-domain -- example.com              # live DNS audit as JSON, sends nothing
npm run preview -- example.com "Pat Owner" out   # render the buyer emails to HTML files, sends nothing
```
