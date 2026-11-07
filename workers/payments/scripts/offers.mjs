// NeonKey offers as Stripe catalog entries. Amounts are read from the site so the site stays the
// single source of truth for prices (CLAUDE.md: prices live in src/pages/ and src/data/).
// Run with: node --experimental-strip-types (services.ts is TypeScript).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { remoteIt, remoteSupportPlan, automationOffers, frontOfficePackage } from "../../../src/data/services.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const bySlug = Object.fromEntries(automationOffers.map((o) => [o.slug, o]));

// Prices that only appear in page copy, not in src/data. We check the page still says the same
// amount, so a price change on the site can't silently drift from Stripe.
function pagePrice(file, pattern, label) {
  const text = readFileSync(root + file, "utf8");
  const m = text.match(pattern);
  if (!m) throw new Error(`Couldn't find the ${label} price in ${file}. Update scripts/offers.mjs.`);
  return Number(m[1]);
}
const tuneUp = pagePrice("src/pages/local.astro", /<strong>\$(\d+)<\/strong> founding rate/, "Office Tech Tune-Up");
// Email Lockdown is sold by pay link and outreach email, not on its own site card, so its founding rate lives here:
// $49 (Michael, Nov 3 2026; live Payment Link since Nov 4). The site may list a higher standard rate inside the
// package ("standard rate $79"); we only check the founding rate is not above what the site shows.
const lockdown = 49;
{
  const text = readFileSync(root + "src/data/services.ts", "utf8");
  const shown = text.match(/Email lockdown[^']*', value: '(?:standard rate|normally) \$(\d+)'/);
  if (shown && Number(shown[1]) < lockdown) throw new Error(`Email lockdown on the site ($${shown[1]}) is below the founding rate ($${lockdown}). Update scripts/offers.mjs.`);
}

// Stripe tax code for these products: txcd_20030000 = "General - Services".
// automatic_tax is NOT turned on anywhere: it collects nothing without an active tax registration.
const SERVICES = "txcd_20030000";

/** One Stripe Product per offer, one founding-rate Price each, found by lookup_key. */
export const OFFERS = [
  { key: "nk_remote_it_setup", name: remoteIt.name, amount: remoteIt.from, slug: remoteIt.slug },
  { key: "nk_support_plan_monthly", name: remoteSupportPlan.name, amount: remoteSupportPlan.from, slug: remoteSupportPlan.slug, interval: "month" },
  { key: "nk_quick_win", name: bySlug["quick-win"].name, amount: bySlug["quick-win"].from, slug: "quick-win" },
  { key: "nk_ai_intake", name: bySlug["ai-faq"].name, amount: bySlug["ai-faq"].from, slug: "ai-faq" },
  { key: "nk_lead_routing", name: bySlug["lead-routing"].name, amount: bySlug["lead-routing"].from, slug: "lead-routing" },
  { key: "nk_front_office", name: frontOfficePackage.name, amount: frontOfficePackage.from, slug: frontOfficePackage.slug },
  { key: "nk_onsite_tuneup", name: "Office Tech Tune-Up (on-site, Fairbanks and North Pole)", amount: tuneUp, slug: "local-tune-up" },
  { key: "nk_email_lockdown", name: "Email Authentication Setup (SPF, DKIM and DMARC checked and fixed)", amount: lockdown, slug: "email-lockdown" },
].map((o) => ({ ...o, taxCode: SERVICES }));

for (const o of OFFERS) {
  if (!Number.isInteger(o.amount) || o.amount <= 0) throw new Error(`Bad amount for ${o.key}: ${o.amount}`);
}

export function findOffer(key) {
  const k = String(key || "").replace(/^nk_/, "");
  const o = OFFERS.find((x) => x.key === `nk_${k}` || x.slug === k);
  if (!o) throw new Error(`Unknown offer "${key}". Use one of: ${OFFERS.map((x) => x.key).join(", ")}`);
  return o;
}
