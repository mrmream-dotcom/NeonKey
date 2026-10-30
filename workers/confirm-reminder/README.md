# neonkey-confirm-reminder

One confirmation reminder per unconfirmed Unlock the Week signup, ever.

Why not Kit-native: Kit has no built-in confirmation reminder, does not let you resend
confirmation emails to unconfirmed subscribers, has no API to confirm a subscriber, and
re-adding someone to the same form via the API does not resend the email ("Subscribers
already added to the specified form will not receive the Incentive Email again"). Kit does
send a new confirmation when the person signs up to the opt-in again after 12 hours, so the
reminder's button leads to a page where the person's own browser re-submits Kit's form.

- Cron `17 * * * *` (hourly). Lists form 10118914 subscribers with `status=inactive` and
  `added_at` 24-48h ago, re-checks each one in Kit (`state` must still be `inactive`), and
  sends one reminder via Resend from `NeonKey <hello@neonkey.tech>`. Max 50 per run.
- Dedupe: KV `remind:<sha256(email)>` is written before sending and never expires. Resend
  `Idempotency-Key` covers retries; failures retry at most 3 times inside the window.
- `GET /c?s=<id>&t=<hmac>`: signed confirm page. Inactive -> button posting `email_address`
  to `https://app.kit.com/forms/10118914/subscriptions` (Kit sends a fresh confirmation).
  Active -> "already confirmed". Unsubscribed/bounced -> "no longer active".
- `GET|POST /u?s=<id>&t=<hmac>`: signed unsubscribe (RFC 8058 one-click POST supported).
  Unsubscribes in Kit and records `stop:<hash>` in KV.
- `POST /test/<TEST_TOKEN>` exists only while the `TEST_TOKEN` secret is set (deleted after
  testing). `{"mode":"dry"}` = counts only; `{"mode":"send"}` = mrmream2@gmail.com only.
- No addresses are logged or stored.

Secrets: `KIT_API_KEY`, `RESEND_API_KEY` (sending-only key), `LINK_SECRET`, `MAILING_ADDRESS`
(postal address shown in small text in the footer for CAN-SPAM; kept out of the public repo).

Deploy: `CLOUDFLARE_ACCOUNT_ID=... npx wrangler deploy`
