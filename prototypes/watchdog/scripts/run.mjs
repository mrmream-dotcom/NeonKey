// Founder Watchdog prototype runner. Sends nothing, stores nothing.
//   npm run demo                  synthetic drift timeline (fixtures/timeline.mjs), prints each day's alerts
//   npm run own -- neonkey.tech   live public DNS for ONE of NeonKey's own domains: baseline + snapshot as JSON
// Live mode refuses any domain not in OWN_DOMAINS, so the prototype never looks up a customer's or stranger's domain.
import { baseline, step, snapshot, counted, fixtureResolver, renderAlert, cleanDomain } from "../src/engine.mjs";
import { dohResolve } from "../../../workers/lockdown/src/audit.js";
import { DOMAIN, timeline } from "../fixtures/timeline.mjs";

export const OWN_DOMAINS = ["neonkey.tech", "getneonkey.com", "neonkeytech.com", "neonkeymail.com", "neonkeysolutions.com", "neonkey.co"];
const [mode, arg] = process.argv.slice(2);

if (mode === "--fixture") {
  const days = timeline();
  const base = await baseline(DOMAIN, { resolve: fixtureResolver(days[0].zone) });
  console.log(`Baseline for ${DOMAIN}: ${base.provider.label}, DNS at ${base.dnsHost.label}, DKIM selectors ${base.selectors.join(", ")}, locked=${base.locked}\n`);
  let state = { last: base.snapshot, good: base.snapshot, open: [] };
  for (const d of days.slice(1)) {
    const r = counted(fixtureResolver(d.zone));
    const next = await snapshot(DOMAIN, { resolve: r, selectors: base.selectors });
    const { alerts, state: nextState } = step(state, next);
    console.log(`Day ${d.day}: ${d.what} (${r.calls} lookups)`);
    console.log(alerts.length ? renderAlert(DOMAIN, alerts).split("\n").map((l) => `  ${l}`).join("\n") : "  no alert\n");
    state = nextState;
  }
} else if (mode === "--live") {
  const domain = cleanDomain(arg || "");
  if (!domain || !OWN_DOMAINS.includes(domain)) {
    console.error(`Live mode only runs on NeonKey's own domains: ${OWN_DOMAINS.join(", ")}`);
    process.exit(2);
  }
  const r = counted(dohResolve);
  const b = await baseline(domain, { resolve: r });
  console.log(JSON.stringify({ ...b, lookups: r.calls }, null, 2));
} else {
  console.error("Usage: npm run demo | npm run own -- neonkey.tech");
  process.exit(2);
}
