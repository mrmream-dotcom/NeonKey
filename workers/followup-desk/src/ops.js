// Keeping the Desk honest when nobody is watching it:
//   alert()    one email to NOTIFY_TO when something fails (at most one an hour, via the Resend idempotency key).
//   hourly()   wraps the hourly run: nightly backup, then a heartbeat in KV, then an alert if anything failed.
//   health()   what GET /health returns. 503 when the hourly run is late, its last run had failures, or the
//              nightly backup is late, so a free uptime monitor pointed at /health can page Michael even when
//              email itself is what's broken.
//   backup()   every KV key (accounts, link hashes, stop keys) to R2 as one JSON array, the same shape
//              `wrangler kv bulk put` reads, so a restore is one command. Kept BACKUP_KEEP_DAYS days.
import { sendNotice } from "./mail.js";

export const BACKUP_HOUR_UTC = 11; // the :05 run at 11 UTC = 2:05 AM AKST (3:05 AM AKDT), when nothing is sending
export const BACKUP_KEEP_DAYS = 7; // privacy page: deleted accounts leave the backups within 7 more days
const HOUR = 3600000;
const RUN_LATE = 2 * HOUR + 10 * 60000; // two missed hourly runs
const BACKUP_LATE = 26 * HOUR;

export function alert(env, where, detail = "") {
  return sendNotice(env, "error", null, [where, detail].filter(Boolean).join("\n").slice(0, 2000));
}

export async function hourly(env, now, runAll) {
  let totals;
  try {
    totals = await runAll(env, now);
  } catch (e) {
    totals = { accounts: 0, sent: 0, sendFailures: 0, runFailures: 1, errors: [`hourly run stopped: ${String(e)}`] };
    console.log("desk: hourly run stopped", String(e));
  }

  if (env.BACKUP && new Date(now).getUTCHours() === BACKUP_HOUR_UTC) {
    try {
      await backup(env, now);
    } catch (e) {
      totals.runFailures++;
      totals.errors.push(`nightly backup failed: ${String(e)}`);
      console.log("desk: backup failed", String(e));
    }
  }

  const { errors, ...counts } = totals;
  await env.DESK.put("ops:lastRun", JSON.stringify({ at: now, ...counts }));
  if (counts.sendFailures || counts.runFailures) {
    await alert(env, `The hourly run had problems: ${counts.sendFailures} email(s) not sent, ${counts.runFailures} error(s). Failed follow-ups retry next hour.`, errors.slice(0, 20).join("\n"));
  }
  return totals;
}

export async function health(env, now = Date.now()) {
  const run = await env.DESK.get("ops:lastRun", "json");
  const problems = [];
  if (!run) problems.push("no hourly run recorded yet");
  else {
    if (now - run.at > RUN_LATE) problems.push("hourly run is late");
    if (run.sendFailures || run.runFailures) problems.push("last hourly run had failures");
  }
  let lastBackupAt = null;
  if (env.BACKUP) {
    const b = await env.DESK.get("ops:lastBackup", "json");
    lastBackupAt = b ? b.at : null;
    if (!b || now - b.at > BACKUP_LATE) problems.push("nightly backup is late");
  }
  return {
    ok: problems.length === 0,
    live: env.ALLOW_LIVE === "true",
    lastRunAt: run ? new Date(run.at).toISOString() : null,
    lastBackupAt: lastBackupAt ? new Date(lastBackupAt).toISOString() : null,
    problems,
  };
}

export async function backup(env, now = Date.now()) {
  const entries = [];
  let cursor;
  do {
    const page = await env.DESK.list({ cursor });
    for (const k of page.keys) {
      if (k.name.startsWith("ops:")) continue;
      const value = await env.DESK.get(k.name);
      if (value === null) continue;
      entries.push(k.expiration ? { key: k.name, value, expiration: k.expiration } : { key: k.name, value });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const date = new Date(now).toISOString().slice(0, 10);
  const name = `desk/${date}.json`;
  await env.BACKUP.put(name, JSON.stringify(entries), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { keys: String(entries.length), at: new Date(now).toISOString() },
  });

  const cutoff = new Date(now - (BACKUP_KEEP_DAYS - 1) * 86400000).toISOString().slice(0, 10);
  let rc;
  do {
    const listed = await env.BACKUP.list({ prefix: "desk/", cursor: rc });
    for (const o of listed.objects) {
      const d = o.key.slice(5, 15);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < cutoff) await env.BACKUP.delete(o.key);
    }
    rc = listed.truncated ? listed.cursor : undefined;
  } while (rc);

  await env.DESK.put("ops:lastBackup", JSON.stringify({ at: now, keys: entries.length, object: name }));
  return { object: name, keys: entries.length };
}
