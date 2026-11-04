// Make a pay link for a client after the job is scoped.
//   STRIPE_API_KEY=rk_test_... npm run checkout-link -- --offer support_plan_monthly --email owner@example.com
//     -> one-time Stripe Checkout link (expires in 24 h). Use this for the monthly support plan.
//   STRIPE_API_KEY=rk_test_... npm run checkout-link -- --offer email_lockdown --reusable
//     -> a Payment Link that never expires, good for outreach emails (fixed price only).
// Stripe picks the payment methods (cards, Apple Pay, Google Pay, Link, ...) from Dashboard settings.
import { findOffer } from "./offers.mjs";
import { stripeClient, args, fail, upsertCustomer, priceFor } from "./client.mjs";

const a = args();
const { stripe, live } = stripeClient({ allowLive: a.live === true });
if (!a.offer) fail("--offer is required");
const offer = findOffer(a.offer);
const price = await priceFor(stripe, offer);
const done = "https://neonkey.tech/pay/thanks/";
const mode = offer.interval ? "subscription" : "payment";
const tag = live ? "LIVE" : "Test";

if (a.reusable === true) {
  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    after_completion: { type: "redirect", redirect: { url: done } },
    ...(mode === "payment" ? { invoice_creation: { enabled: true } } : {}),
    metadata: { offer: offer.key },
  });
  console.log(`${tag} Payment Link (${offer.name}): ${link.url}`);
} else {
  const email = String(a.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("--email is required for a one-time checkout link (or pass --reusable)");
  const customer = await upsertCustomer(stripe, { email, name: a.name });
  const session = await stripe.checkout.sessions.create({
    mode,
    customer: customer.id,
    line_items: [{ price: price.id, quantity: 1 }],
    success_url: `${done}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: "https://neonkey.tech/services/",
    integration_identifier: "neonkey-checkout-link-qzvhtmra",
    ...(mode === "payment" ? { invoice_creation: { enabled: true } } : {}),
    metadata: { offer: offer.key },
  });
  console.log(`${tag} checkout link for ${email} (${offer.name}, expires in 24 h): ${session.url}`);
}
