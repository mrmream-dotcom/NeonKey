// Create or update NeonKey's Stripe catalog: one Product per offer, one founding-rate Price each.
//   STRIPE_API_KEY=rk_test_... npm run catalog            # show what would change (dry run)
//   STRIPE_API_KEY=rk_test_... npm run catalog -- --apply # make the changes
// Safe to re-run. Product IDs are fixed (e.g. nk_quick_win) and prices are found by lookup_key.
// When a site price changes, a new Price is created and takes over the lookup key; the old one is archived.
import { OFFERS } from "./offers.mjs";
import { stripeClient, args } from "./client.mjs";

const a = args();
const apply = a.apply === true;
const { stripe, live } = stripeClient({ allowLive: a.live === true });
console.log(`${live ? "LIVE" : "Test"} mode, ${apply ? "applying changes" : "dry run (add --apply to make changes)"}\n`);

for (const o of OFFERS) {
  const cents = o.amount * 100;
  let product = await stripe.products.retrieve(o.key).catch((e) => (e.statusCode === 404 ? null : Promise.reject(e)));
  if (!product) {
    console.log(`+ product ${o.key}: ${o.name}`);
    if (apply) product = await stripe.products.create({ id: o.key, name: o.name, tax_code: o.taxCode, metadata: { site_slug: o.slug } });
  } else if (product.name !== o.name || !product.active) {
    console.log(`~ product ${o.key}: name/active updated`);
    if (apply) product = await stripe.products.update(o.key, { name: o.name, active: true });
  }

  const existing = (await stripe.prices.list({ lookup_keys: [o.key], limit: 1 })).data[0];
  const same = existing && existing.active && existing.unit_amount === cents && existing.currency === "usd" &&
    (existing.recurring?.interval || null) === (o.interval || null) && existing.product === o.key;
  const label = `$${o.amount}${o.interval ? `/${o.interval}` : ""}`;
  if (same) { console.log(`= price  ${o.key}: ${label}`); continue; }
  console.log(`${existing ? "~" : "+"} price  ${o.key}: ${label}${existing ? ` (was $${existing.unit_amount / 100})` : ""}`);
  if (!apply) continue;
  await stripe.prices.create({
    product: o.key,
    currency: "usd",
    unit_amount: cents,
    lookup_key: o.key,
    transfer_lookup_key: true,
    nickname: "Founding-client rate",
    tax_behavior: "exclusive",
    ...(o.interval ? { recurring: { interval: o.interval } } : {}),
  });
  if (existing?.active) await stripe.prices.update(existing.id, { active: false });
}
console.log("\nDone.");
