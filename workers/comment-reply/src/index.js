// NeonKey comment-keyword auto reply for Instagram.
//
// Every 5 minutes (cron) this Worker:
//   1. reads recent posts/reels on @neonkey.tech (last 7 days) via Meta's official
//      Instagram API (graph.instagram.com, Business Login for Instagram),
//   2. finds new comments that contain a keyword (e.g. KEY),
//   3. posts a short public reply under the comment, and
//   4. sends the commenter one private reply (DM) with the promised link.
//
// Why polling and not webhooks: Meta only delivers `comments` webhooks to apps that are
// Live with Advanced Access (App Review + Business Verification). Reading and replying to
// comments on our own account works with Standard Access, so polling avoids the review.
//
// MODE (wrangler var):
//   "dry"   log what would be sent, send nothing (default, safe)
//   "reply" public comment replies only
//   "live"  public comment replies + private reply DMs
//
// Storage (KV binding STATE):
//   token            current long-lived Instagram token (seeded from secret IG_TOKEN)
//   token_refreshed  ISO time of last refresh
//   since            ISO time; comments older than this are ignored (set on first run)
//   rules            optional JSON override of DEFAULT_RULES (see below)
//   c:<comment_id>   marks a comment as handled (30-day TTL)
//   d:<comment_id>   marks a comment as already logged in dry mode (30-day TTL)
//   u:<media>:<user> marks a user as already answered on a post (30-day TTL)
//   status           last run summary (shown at GET /status)
//   log              last 100 actions (usernames + comment ids, no message bodies)
//
// Routes: GET /status (run summary, no tokens), everything else 404.

const GRAPH = "https://graph.instagram.com/v26.0";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const HANDLED_TTL = 30 * 24 * 60 * 60; // seconds
const MAX_MEDIA = 10;
const MAX_ACTIONS_PER_RUN = 25; // stays far below Meta's 750 private replies/hour
const REFRESH_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

// Keyword rules. A comment matches when it contains the keyword as a whole word
// (case-insensitive). `media` can override the rule for a single post by media id.
const DEFAULT_RULES = {
  default: {
    keywords: ["KEY"],
    publicReplies: [
      "Sent! Check your DMs 🔑",
      "Just sent it to your DMs 🔑",
      "On its way to your messages 🔑",
    ],
    dm:
      "Here's the free step-by-step guide we mentioned 🔑\n\n" +
      "https://neonkey.tech/learn/two-factor-authentication/\n\n" +
      "It takes about 10 minutes per account. If you get stuck, just reply here.\n\n– NeonKey",
  },
  media: {},
};

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/status") {
      const status = (await env.STATE.get("status", "json")) || { note: "no runs yet" };
      return json({ mode: mode(env), ...status });
    }
    return new Response("Not found", { status: 404 });
  },
};

function mode(env) {
  const m = String(env.MODE || "dry").toLowerCase();
  return ["dry", "reply", "live"].includes(m) ? m : "dry";
}

// ------------------------------------------------------------------- run ---

async function run(env) {
  const started = new Date();
  const summary = {
    lastRun: started.toISOString(),
    mediaChecked: 0,
    commentsSeen: 0,
    matched: 0,
    replied: 0,
    dmSent: 0,
    dryRun: 0,
    errors: [],
  };

  try {
    let token = await getToken(env);
    if (!token) {
      summary.errors.push("No token yet. Add the IG_TOKEN secret in Cloudflare.");
      return;
    }
    token = await maybeRefresh(env, token, summary);

    let since = await env.STATE.get("since");
    if (!since) {
      // First run: never answer comments made before the automation existed.
      since = started.toISOString();
      await env.STATE.put("since", since);
    }
    const sinceMs = Date.parse(since);

    const me = await graph(`/me?fields=user_id,username`, token);
    const ownUsername = String(me.username || "").toLowerCase();
    const rules = await loadRules(env);

    const media = await graph(`/me/media?fields=id,timestamp,permalink&limit=${MAX_MEDIA}`, token);
    const recent = (media.data || []).filter(
      (m) => started - Date.parse(m.timestamp) < SEVEN_DAYS_MS
    );

    let actions = 0;
    for (const m of recent) {
      summary.mediaChecked++;
      const rule = { ...rules.default, ...(rules.media?.[m.id] || {}) };
      const comments = await graph(
        `/${m.id}/comments?fields=id,text,timestamp,username,from&limit=50`,
        token
      );

      for (const c of comments.data || []) {
        summary.commentsSeen++;
        if (actions >= MAX_ACTIONS_PER_RUN) break;

        const username = String(c.username || c.from?.username || "").toLowerCase();
        const userId = c.from?.id || username;
        const ts = Date.parse(c.timestamp);
        if (!c.id || !c.text) continue;
        if (username && username === ownUsername) continue; // never answer ourselves
        if (ts < sinceMs || started - ts > SEVEN_DAYS_MS) continue; // DM window is 7 days
        if (!matches(c.text, rule.keywords)) continue;
        if (await env.STATE.get(`c:${c.id}`)) continue;
        if (mode(env) === "dry" && (await env.STATE.get(`d:${c.id}`))) continue;

        summary.matched++;
        actions++;
        const userKey = `u:${m.id}:${userId}`;
        const alreadyAnswered = await env.STATE.get(userKey);
        const entry = { at: new Date().toISOString(), media: m.id, comment: c.id, user: username };

        if (mode(env) === "dry" || alreadyAnswered) {
          entry.result = alreadyAnswered ? "skip_repeat_user" : "dry_run";
          if (!alreadyAnswered) summary.dryRun++;
        } else {
          try {
            const reply = pick(rule.publicReplies, c.id);
            await graph(`/${c.id}/replies`, token, { message: reply });
            summary.replied++;
            entry.result = "replied";

            if (mode(env) === "live") {
              await graph(`/${me.user_id || "me"}/messages`, token, {
                recipient: { comment_id: c.id },
                message: { text: rule.dm },
              });
              summary.dmSent++;
              entry.result = "replied+dm";
            }
            await env.STATE.put(userKey, "1", { expirationTtl: HANDLED_TTL });
          } catch (err) {
            entry.result = "error";
            entry.error = errText(err);
            summary.errors.push(`comment ${c.id}: ${entry.error}`);
          }
        }

        // Dry runs are not marked handled, so switching to reply/live answers them later
        // (as long as they are still inside the 7-day window).
        if (entry.result === "dry_run") {
          await env.STATE.put(`d:${c.id}`, "1", { expirationTtl: HANDLED_TTL });
        } else {
          await env.STATE.put(`c:${c.id}`, entry.result, { expirationTtl: HANDLED_TTL });
        }
        await appendLog(env, entry);
      }
    }
  } catch (err) {
    summary.errors.push(errText(err));
  } finally {
    summary.ms = Date.now() - started.getTime();
    await env.STATE.put("status", JSON.stringify(summary));
  }
}

// ------------------------------------------------------------- helpers ---

export function matches(text, keywords) {
  const clean = String(text).toLowerCase();
  return (keywords || []).some((k) => {
    const kw = String(k).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${kw}($|[^\\p{L}\\p{N}])`, "u").test(clean);
  });
}

function pick(list, seed) {
  if (!list || !list.length) return "Sent! Check your DMs 🔑";
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

async function loadRules(env) {
  const stored = await env.STATE.get("rules", "json");
  return stored && stored.default ? stored : DEFAULT_RULES;
}

async function getToken(env) {
  return (await env.STATE.get("token")) || env.IG_TOKEN || null;
}

async function maybeRefresh(env, token, summary) {
  const last = await env.STATE.get("token_refreshed");
  if (last && Date.now() - Date.parse(last) < REFRESH_EVERY_MS) return token;
  if (!last) {
    // First sight of this token: Meta only refreshes tokens that are 24h+ old,
    // so start the clock now and refresh on a later run.
    await env.STATE.put("token_refreshed", new Date().toISOString());
    return token;
  }
  try {
    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`
    );
    const body = await res.json();
    if (res.ok && body.access_token) {
      await env.STATE.put("token", body.access_token);
      await env.STATE.put("token_refreshed", new Date().toISOString());
      return body.access_token;
    }
    summary.errors.push(`token refresh failed: ${body.error?.message || res.status}`);
  } catch (err) {
    summary.errors.push(`token refresh failed: ${errText(err)}`);
  }
  return token;
}

async function graph(path, token, postBody) {
  const init = postBody
    ? {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(postBody),
      }
    : { headers: { Authorization: `Bearer ${token}` } };
  const res = await fetch(GRAPH + path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = new Error(body.error?.message || `HTTP ${res.status}`);
    e.code = body.error?.code;
    throw e;
  }
  return body;
}

async function appendLog(env, entry) {
  const log = (await env.STATE.get("log", "json")) || [];
  log.unshift(entry);
  await env.STATE.put("log", JSON.stringify(log.slice(0, 100)));
}

function errText(err) {
  const msg = err && err.message ? err.message : String(err);
  return msg.replace(/access_token=[^&\s]+/g, "access_token=***").slice(0, 300);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
