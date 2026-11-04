// Shared Stripe client for the local scripts. The key comes from the STRIPE_API_KEY env var only
// (use a restricted key, rk_test_...). It is never printed or logged.
import Stripe from "stripe";

export function stripeClient({ allowLive = false } = {}) {
  const key = (process.env.STRIPE_API_KEY || "").trim();
  if (!key) fail("Set STRIPE_API_KEY first (a restricted test key, rk_test_..., from the Stripe Dashboard > Developers > API keys).");
  const live = /^(sk|rk)_live_/.test(key);
  if (!/^(sk|rk)_(test|live)_/.test(key)) fail("STRIPE_API_KEY doesn't look like a Stripe secret or restricted key.");
  if (live && !allowLive) fail("That's a LIVE key. These scripts run in test mode unless you pass --live (only after Michael's OK to take real payments).");
  return { stripe: new Stripe(key, { maxNetworkRetries: 2, appInfo: { name: "neonkey-payments", url: "https://neonkey.tech" } }), live };
}

export function args(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const [k, v] = a.slice(2).split("=", 2);
    if (v !== undefined) out[k] = v;
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}

export function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

/** Find a customer by email, or create one. */
export async function upsertCustomer(stripe, { email, name, phone }) {
  const found = await stripe.customers.list({ email, limit: 1 });
  if (found.data[0]) return found.data[0];
  return stripe.customers.create({ email, ...(name ? { name } : {}), ...(phone ? { phone } : {}) });
}

/** The founding-rate price for an offer, by lookup key (run `npm run catalog` first). */
export async function priceFor(stripe, offer) {
  const r = await stripe.prices.list({ lookup_keys: [offer.key], active: true, limit: 1, expand: ["data.product"] });
  if (!r.data[0]) fail(`No active price with lookup key ${offer.key}. Run \`npm run catalog\` first.`);
  return r.data[0];
}
