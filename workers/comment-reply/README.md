# neonkey-comment-reply

Free "Comment KEY and we'll DM you the guide" automation for Instagram, built on Meta's
official Instagram API (Business Login for Instagram, `graph.instagram.com`). No scraping and
no unofficial logins.

Every 5 minutes (cron) the Worker reads posts and reels from the last 7 days, finds new
comments that contain a keyword (whole word, any case), then:

1. posts a short public reply under the comment (rotates between 3 variants), and
2. sends the commenter one private reply DM with the promised link.

It never answers our own comments, comments from before it was switched on, or the same
person twice on the same post. At most 25 actions per run.

Deployed at `https://neonkey-comment-reply.mr-mream.workers.dev` (`GET /status` shows the last
run, no tokens). Everything else returns 404.

## Why polling and not webhooks

Meta only delivers `comments` webhooks to apps that are Live with Advanced Access, which needs
App Review and Business Verification. Reading and replying to comments on an account we own
works with Standard Access, so polling every 5 minutes avoids the review for public replies.
Private replies (DMs) to people without a role on the app may still need Advanced Access; the
first live test tells us.

## Modes (`MODE` var)

| Mode | What it does |
| --- | --- |
| `dry` (default) | Logs matching comments, sends nothing |
| `reply` | Public comment replies only |
| `live` | Public replies + private reply DMs |

## Keyword rules

Defaults are in `DEFAULT_RULES` in `src/index.js` (keyword `KEY`, DM links the 2FA guide).
Override without redeploying by writing JSON to the KV key `rules`:

```json
{
  "default": { "keywords": ["KEY"], "publicReplies": ["Sent! Check your DMs 🔑"], "dm": "..." },
  "media": { "<instagram media id>": { "dm": "a different link for this one post" } }
}
```

Meta limits: one private reply per comment, within 7 days of the comment. Follow-ups only if
the person replies, within 24 hours.

## One-time setup (Michael)

1. Instagram @neonkey.tech must be a professional account and public.
2. In the Instagram app: Settings → Messages and story replies → Connected tools → turn on
   **Allow access to messages**.
3. At developers.facebook.com: My Apps → Create app → pick the Instagram use case
   (manage messaging and content on Instagram) → name it "NeonKey Replies".
4. In the app: Instagram → **API setup with Instagram login** → Generate access tokens →
   Add account → sign in as @neonkey.tech and allow the permissions
   (`instagram_business_basic`, `instagram_business_manage_comments`,
   `instagram_business_manage_messages`). Copy the token.
5. Cloudflare dashboard → Workers & Pages → `neonkey-comment-reply` → Settings →
   Variables and Secrets → Add → type **Secret**, name `IG_TOKEN`, paste the token → Deploy.
   Never paste the token in chat.

The Worker stores the token in KV and refreshes it weekly (tokens last 60 days).

## Deploy

```
CLOUDFLARE_ACCOUNT_ID=13d2e240576e100fbd65b2499bd6c048 npx wrangler deploy
```

KV namespace `neonkey-comment-reply-state` (`d8c4f7aaf30f454cb983cafee7614081`).
