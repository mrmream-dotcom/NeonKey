# neonkey-receipts (draft)

Cloudflare Worker behind the draft Lab tool at `/lab/receipt-sorter/`. It reads a receipt or invoice
(photo or PDF) with Gemini and returns validated JSON. It is separate from the triage, welcome, quiz and
confirm-reminder workers and shares nothing with them.

- `POST /extract` body `{ "type": "image/jpeg|png|webp|heic|heif|application/pdf", "data": "<base64>" }`
- `GET /health`, `GET /robots.txt` (Disallow all). `GET /` → the preview page. Any other GET redirects to neonkey.tech.
- Static assets in `./preview` (built by `scripts/build-preview.sh`, gitignored) serve the noindex draft page
  on `https://neonkey-receipts.mr-mream.workers.dev/lab/receipt-sorter/` for private testing.

## Guardrails
- CORS: only origins in `ALLOWED_ORIGINS` (neonkey.tech, www, and the workers.dev preview). `ALLOW_LOCALHOST`
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
./scripts/build-preview.sh
export CLOUDFLARE_ACCOUNT_ID=13d2e240576e100fbd65b2499bd6c048   # plus CLOUDFLARE_API_TOKEN
printf %s "$GEMINI_API_KEY" | npx wrangler secret put GEMINI_API_KEY   # once
npx wrangler deploy
```
To launch on the live site later: remove `draft: true` in `src/data/lab.ts`, the `noindex` prop on the page and
the `DRAFT_PAGES` entry in `astro.config.mjs`; optionally drop `assets` and the workers.dev origin here.
