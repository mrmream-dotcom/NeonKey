# neonkey-office-ai (Cloudflare Worker)

Backend for the Lab demo at https://neonkey.tech/lab/office-ai/.

`POST /ask` with JSON `{ "question": "..." }` returns an answer drawn only from the made-up
Birchline Plumbing & Heating documents in `src/data/office-ai-docs.json` (bundled into the Worker at
deploy time, so the page and the Worker always use the same text):

```json
{ "ok": true, "model": "...", "fallback": false, "ms": 2100, "tokens": 2900,
  "result": { "found": "yes|partly|no", "answer": "...", "sources": [{ "doc_id", "doc_title", "section", "quote" }],
              "dropped_sources": 0, "unverified": false, "ask_next": "", "confidence": "low|medium|high" } }
```

## Quote checker

Every quote the model cites is matched against the real document text (ignoring case, curly quotes,
dashes, extra spaces and edge punctuation). Quotes that don't match, or are under 12 characters, are dropped
and the confidence drops to `low`. If the model says the docs answer the question but no quote survives,
`unverified` is `true` and the page shows a warning. If the model names the wrong section for a real
quote, the checker reports the section the quote actually comes from.

## Guardrails (same as the triage demo)

- CORS / Origin: only `ALLOWED_ORIGINS` (neonkey.tech); localhost only when `ALLOW_LOCALHOST` is `"true"`
  for `wrangler dev`. Production is `"false"`; never deploy it as `"true"`.
- Strict limits via the SQLite-backed `Limiter` Durable Object (free plan): `PER_IP_MINUTE` (5) per rolling
  60 s, `PER_IP_DAILY` (30) and `GLOBAL_DAILY` (150) AI runs per UTC day. Visitors are keyed by a SHA-256 hash
  of IP + date; objects delete their data 48 h after last use. Limiter errors fail closed (503).
- Question length 5–`MAX_CHARS` (400); body max 4 KB.
- EEA, Switzerland and UK get 451 (Gemini free-tier terms).
- Questions and answers are never stored or logged.
- `PRIMARY_MODEL` (gemini-3.5-flash, minimal thinking), retry once on `FALLBACK_MODEL` (gemini-3.5-flash-lite).

## Deploy

```sh
cd workers/office-ai
npm install
npx wrangler login                     # or export CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
printf %s "$GEMINI_API_KEY" | npx wrangler secret put GEMINI_API_KEY   # same key as the triage Worker; never commit it
npx wrangler deploy
```

Expected URL: https://neonkey-office-ai.mr-mream.workers.dev (the page's default in `src/config.ts`).

Local test without the AI: `npx wrangler dev --var ALLOW_LOCALHOST:true` (requests stop at `not_configured`
after the limiter and validation run).

## Example answers on the Lab page

`src/data/office-ai-examples.json` holds real responses captured by running the four sample questions
through the deployed page with Playwright and recording the Worker's JSON. Re-capture them rather than
editing them by hand. Shape: `[{ sampleId, label, question, capturedAt, model, ms, tokens, result }]`.
