# neonkey-welcome

Free automatic welcome email for the **Unlock the Week** newsletter.

Kit (free plan, no sequences) → legacy webhook `subscriber.subscriber_activate` →
this Cloudflare Worker → Resend (`hello@neonkey.tech`, domain `neonkey.tech` verified in Resend).

- `POST /kit/<WEBHOOK_PATH_TOKEN>` – Kit webhook. Re-fetches the subscriber from the Kit API,
  requires `state == "active"`, dedupes per address forever in KV (`WELCOME_SENT`, key =
  `welcome:<sha256(lowercased email)>`, no addresses stored), then sends via Resend.
- `GET /unsubscribe?e=<email>&t=<HMAC>` – verifies the HMAC, unsubscribes in Kit
  (`POST /v4/subscribers/{id}/unsubscribe`) and shows a branded confirmation page.
  `POST` to the same URL supports RFC 8058 one-click (`List-Unsubscribe-Post`).
- Everything else returns 404.

Template: `src/email.js` (HTML + plain text).

## Secrets (never commit)

```
printf '%s' "$KIT_API_KEY" | npx wrangler secret put KIT_API_KEY
printf '%s' "$RESEND_SENDING_KEY" | npx wrangler secret put RESEND_API_KEY   # sending-only key scoped to neonkey.tech
printf '%s' "$(openssl rand -hex 32)" | npx wrangler secret put WEBHOOK_PATH_TOKEN
printf '%s' "$(openssl rand -hex 32)" | npx wrangler secret put UNSUB_SECRET
```

Rotating `WEBHOOK_PATH_TOKEN` requires re-registering the Kit webhook. Rotating
`UNSUB_SECRET` invalidates unsubscribe links in already-sent welcome emails.

## Deploy

```
npm install && CLOUDFLARE_ACCOUNT_ID=13d2e240576e100fbd65b2499bd6c048 npx wrangler deploy
```
