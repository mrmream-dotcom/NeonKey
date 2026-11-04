// Create a Stripe invoice for a scoped job (remote or on-site). Stripe emails it with a pay-online link.
//   STRIPE_API_KEY=rk_test_... npm run invoice -- --email owner@example.com --name "Jane Doe" \
//       --offer onsite_tuneup [--amount 249] [--desc "Office Tech Tune-Up, 12 Main St"] [--days 7] [--send]
// Without --send it leaves a draft you can check in the Dashboard first (Invoices > Drafts).
// --amount overrides the founding-rate price when the quote was different (e.g. 349 or 349.50).
// Several offers on one invoice: --offer email_lockdown,quick_win
import { findOffer } from "./offers.mjs";
import { stripeClient, args, fail, upsertCustomer, priceFor } from "./client.mjs";

const a = args();
const { stripe, live } = stripeClient({ allowLive: a.live === true });
const email = String(a.email || "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("--email is required");
if (!a.offer) fail("--offer is required (e.g. onsite_tuneup, quick_win, remote_it_setup)");
const offers = String(a.offer).split(",").map(findOffer);
if (offers.some((o) => o.interval)) fail("The support plan is a subscription. Use `npm run checkout-link -- --offer support_plan_monthly` instead.");
if (a.amount && offers.length > 1) fail("--amount works with a single --offer only.");
const days = a.days ? Number(a.days) : 7;
if (!Number.isInteger(days) || days < 0 || days > 60) fail("--days must be 0 to 60");
let cents = null;
if (a.amount) {
  cents = Math.round(Number(a.amount) * 100);
  if (!Number.isFinite(cents) || cents < 100) fail("--amount must be at least 1.00");
}

const customer = await upsertCustomer(stripe, { email, name: a.name });
const invoice = await stripe.invoices.create({
  customer: customer.id,
  collection_method: "send_invoice",
  days_until_due: days,
  auto_advance: false,
  pending_invoice_items_behavior: "exclude",
  ...(a.memo ? { description: String(a.memo).slice(0, 500) } : {}),
  metadata: { source: "neonkey-invoice-script" },
});

for (const offer of offers) {
  const desc = a.desc ? String(a.desc).slice(0, 250) : undefined;
  if (cents !== null) {
    await stripe.invoiceItems.create({
      customer: customer.id, invoice: invoice.id, amount: cents, currency: "usd",
      description: desc || offer.name, metadata: { offer: offer.key },
    });
  } else {
    const price = await priceFor(stripe, offer);
    await stripe.invoiceItems.create({
      customer: customer.id, invoice: invoice.id, pricing: { price: price.id },
      ...(desc ? { description: desc } : {}), metadata: { offer: offer.key },
    });
  }
}

let out = await stripe.invoices.retrieve(invoice.id);
if (a.send === true) {
  await stripe.invoices.finalizeInvoice(invoice.id);
  out = await stripe.invoices.sendInvoice(invoice.id);
}
console.log(`${live ? "LIVE" : "Test"} invoice ${out.id} for ${email}: $${(out.total / 100).toFixed(2)}, status ${out.status}`);
if (out.hosted_invoice_url) console.log(`Pay link: ${out.hosted_invoice_url}`);
else console.log("Draft saved. Review it in the Dashboard (Invoices > Drafts), then click Send or re-run with --send.");
