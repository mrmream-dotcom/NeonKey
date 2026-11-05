// Run the Lockdown audit on a real domain from a terminal (public DNS only, changes nothing, sends nothing).
//   npm run audit-domain -- example.com [buyer@example.com]
import { audit, cleanDomain } from "../src/audit.js";
const d = cleanDomain(process.argv[2] || "");
if (!d) { console.error("usage: npm run audit-domain -- example.com [buyer-email]"); process.exit(1); }
console.log(JSON.stringify(await audit(d, { contactEmail: process.argv[3] }), null, 2));
