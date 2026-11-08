// Turns a nightly backup (R2 neonkey-desk-backup/desk/<date>.json) into a file `wrangler kv bulk put` accepts,
// dropping keys whose expiration has already passed (KV rejects those).
//   npx wrangler r2 object get neonkey-desk-backup/desk/2026-11-09.json --file backup.json --remote
//   node scripts/restore-prep.mjs backup.json > restore.json
//   npx wrangler kv bulk put restore.json --binding DESK --remote
// A restore overwrites the keys it contains and leaves newer keys alone. Pause the cron (or restore between
// :10 and :55 past the hour) so a send doesn't land mid-restore. Delete backup.json and restore.json afterward:
// they hold customer data.
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) { console.error("usage: node scripts/restore-prep.mjs <backup.json>"); process.exit(1); }
const entries = JSON.parse(readFileSync(file, "utf8"));
if (!Array.isArray(entries)) { console.error("not a Desk backup (expected a JSON array)"); process.exit(1); }
const now = Math.floor(Date.now() / 1000);
const keep = entries.filter((e) => typeof e.key === "string" && typeof e.value === "string" && (!e.expiration || e.expiration > now + 60));
console.error(`${keep.length} of ${entries.length} keys kept (${entries.length - keep.length} already expired)`);
process.stdout.write(JSON.stringify(keep));
