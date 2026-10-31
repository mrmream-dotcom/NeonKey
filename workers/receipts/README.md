# neonkey-receipts

Cloudflare Worker behind the Lab tool at `/lab/receipt-sorter/`. It reads a receipt or invoice
(photo or PDF) with Gemini and returns validated JSON. It is separate from the triage, welcome, quiz and
confirm-reminder workers and shares nothing with them.

- `POST /extract` body `{ "type": "image/jpeg|png|webp|heic|heif|application/pdf", "data": "<base64>" }`
- `GET /health`, `GET /robots.txt` (Disallow all). Any other GET (including the retired workers.dev preview
  page) 301-redirects to the same path on neonkey.tech.

## Guardrails
- CORS: only origins in `ALLOWED_ORIGINS` (neonkey.tech and www.neonkey.tech). `ALLOW_LOCALHOST`
  is `"false"` in production; use `--var ALLOW_LOCALHOST:true` for `wrangler dev`.
- 5 MB file cap, type whitelist plus magic-byte check, EEA/CH/UK requests refused (same as triage).
- Rate limits (Durable Object `Limiter`, hashed IP, auto-deleted after 48 h, fails closed):
  `PER_IP_MINUTE=5`, `PER_IP_DAILY=20`, `GLOBAL_DAILY=100`.
- Model: `PRIMARY_MODEL=gemini-3.5-flash`, `FALLBACK_MODEL=gemini-3.5-flash-lite` (free tier), structured output
  schema, server-side validation (`clean()`), sanity `checks()`. Blank rather than guessed values.
- Never logs file content or extracted fields.

## Deploy
```sh
npm ci
export CLOUDFLARE_ACCOUNT_ID=13d2e240576e100fbd65b2499bd6c048   # plus CLOUDFLARE_API_TOKEN
printf %s "$GEMINI_API_KEY" | npx wrangler secret put GEMINI_API_KEY   # once
npx wrangler deploy
```
Published Oct 31, 2026 (listed on /lab/, indexed, in the sitemap).
