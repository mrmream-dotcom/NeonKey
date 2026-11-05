// Render the buyer emails for a real domain to HTML files you can open in a browser. Sends nothing.
//   npm run preview -- example.com "Pat Owner" [outdir]
import { mkdirSync, writeFileSync } from "node:fs";
import { audit, cleanDomain } from "../src/audit.js";
import { reportEmail, doneEmail, reminderEmail, noticeEmail } from "../src/email.js";
const d = cleanDomain(process.argv[2] || "");
if (!d) { console.error('usage: npm run preview -- example.com "Name" [outdir]'); process.exit(1); }
const name = process.argv[3] || "";
const out = process.argv[4] || "preview";
mkdirSync(out, { recursive: true });
const a = await audit(d, {});
const order = { id: "cs_preview", email: `owner@${d}`, name, domain: d, customerMode: "shadow" };
for (const [file, m] of [["1-report", reportEmail({ name, a })], ["2-reminder", reminderEmail({ name, a })], ["3-done", doneEmail({ name, a })], ["0-notice", noticeEmail({ kind: "new", order, a })]]) {
  writeFileSync(`${out}/${d}-${file}.html`, m.html);
  writeFileSync(`${out}/${d}-${file}.txt`, `Subject: ${m.subject}\n\n${m.text}`);
}
console.log(`wrote ${out}/ (${a.fixes.length} records, ${a.buyerSteps.length} buyer steps, ${a.human.length} human flags, locked=${a.locked})`);
