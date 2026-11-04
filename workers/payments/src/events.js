// Turns a verified Stripe event into a short notice for NeonKey, or null for events we don't act on.
// Only subscribe the webhook endpoint to the events listed in EVENTS (see README).
export const EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "charge.refunded",
  "charge.dispute.created",
  "radar.early_fraud_warning.created",
];

const money = (cents, cur = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: String(cur).toUpperCase() }).format((cents || 0) / 100);
const day = (unix) => (unix ? new Date(unix * 1000).toISOString().slice(0, 10) : "");
const who = (o) => o?.customer_details?.email || o?.customer_email || o?.billing_details?.email || o?.receipt_email || "";

export function describeEvent(event) {
  const o = event.data?.object || {};
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      // Subscriptions and checkouts with invoice_creation also send invoice.paid, which carries the notice.
      if (o.mode === "subscription" || o.invoice) return null;
      if (o.payment_status === "unpaid") return null; // delayed method: wait for async_payment_succeeded
      return {
        subject: `Payment received: ${money(o.amount_total, o.currency)} from ${who(o) || "a customer"}`,
        headline: `Paid: ${money(o.amount_total, o.currency)}`,
        rows: [["Customer", who(o)], ["Name", o.customer_details?.name], ["Offer", o.metadata?.offer]],
        next: "Reply to the customer to book the work, and log it in the Accounts sheet.",
        replyTo: who(o) || undefined,
        dashPath: o.payment_intent ? `payments/${o.payment_intent}` : undefined,
      };
    }
    case "checkout.session.async_payment_failed":
      return {
        subject: `Payment failed at checkout: ${who(o) || "a customer"}`,
        headline: "A delayed payment (for example a bank debit) failed after checkout",
        rows: [["Customer", who(o)], ["Amount", money(o.amount_total, o.currency)], ["Offer", o.metadata?.offer]],
        next: "Don't start the work yet. Send the customer a new link or an invoice.",
        replyTo: who(o) || undefined,
      };
    case "invoice.paid":
      if (!o.amount_paid) return null; // $0 invoices (trials, credits) aren't news
      return {
        subject: `Invoice paid: ${money(o.amount_paid, o.currency)} from ${o.customer_email || o.customer_name || "a customer"}`,
        headline: `Paid: ${money(o.amount_paid, o.currency)} (${o.billing_reason === "subscription_cycle" ? "support plan renewal" : o.billing_reason === "subscription_create" ? "first support plan payment" : "invoice"})`,
        rows: [["Customer", o.customer_email], ["Name", o.customer_name], ["Invoice", o.number], ["Lines", lines(o)]],
        next: o.billing_reason === "subscription_cycle" ? "Nothing to do. Count it in Friday's MRR." : "Log it in the Accounts sheet and book the work.",
        replyTo: o.customer_email || undefined,
        dashPath: `invoices/${o.id}`,
      };
    case "invoice.payment_failed":
      return {
        subject: `Invoice payment failed: ${o.customer_email || "a customer"}`,
        headline: `Payment failed: ${money(o.amount_due, o.currency)}`,
        rows: [["Customer", o.customer_email], ["Invoice", o.number], ["Attempt", o.attempt_count], ["Next retry", day(o.next_payment_attempt)]],
        next: "Stripe retries automatically. If it keeps failing, send a friendly note asking them to update their card.",
        replyTo: o.customer_email || undefined,
        dashPath: `invoices/${o.id}`,
      };
    case "customer.subscription.created":
      return {
        subject: "New support plan subscription",
        headline: `New subscription: ${planName(o)}`,
        rows: [["Status", o.status], ["Customer", o.customer], ["Started", day(o.start_date)]],
        next: "Send the welcome note and agree the monthly request count in writing.",
        dashPath: `subscriptions/${o.id}`,
      };
    case "customer.subscription.updated": {
      const prev = event.data?.previous_attributes || {};
      // Only flag a cancellation being scheduled, or a plan going past due.
      if (o.cancel_at_period_end && prev.cancel_at_period_end === false) {
        return {
          subject: "Support plan set to cancel",
          headline: `Cancels on ${day(o.cancel_at || o.items?.data?.[0]?.current_period_end)}`,
          rows: [["Plan", planName(o)], ["Customer", o.customer]],
          next: "Optional: ask what would have made it worth keeping.",
          dashPath: `subscriptions/${o.id}`,
        };
      }
      if (o.status === "past_due" && prev.status && prev.status !== "past_due") {
        return {
          subject: "Support plan past due",
          headline: "A support plan payment is past due",
          rows: [["Plan", planName(o)], ["Customer", o.customer]],
          next: "Stripe keeps retrying. A short personal note usually helps.",
          dashPath: `subscriptions/${o.id}`,
        };
      }
      return null;
    }
    case "customer.subscription.deleted":
      return {
        subject: "Support plan canceled",
        headline: `Subscription ended: ${planName(o)}`,
        rows: [["Customer", o.customer], ["Ended", day(o.ended_at)], ["Reason", o.cancellation_details?.reason]],
        next: "Take it off Friday's MRR.",
        dashPath: `subscriptions/${o.id}`,
      };
    case "charge.refunded":
      return {
        subject: `Refund issued: ${money(o.amount_refunded, o.currency)}`,
        headline: `Refunded ${money(o.amount_refunded, o.currency)} of ${money(o.amount, o.currency)}`,
        rows: [["Customer", who(o)], ["Charge", o.id]],
        next: "Update the Accounts sheet so the scoreboard cash stays right.",
        dashPath: o.payment_intent ? `payments/${o.payment_intent}` : undefined,
      };
    case "charge.dispute.created":
      return {
        subject: `ACTION NEEDED: payment disputed (${money(o.amount, o.currency)})`,
        headline: "A customer disputed a payment",
        rows: [["Amount", money(o.amount, o.currency)], ["Reason", o.reason], ["Evidence due", day(o.evidence_details?.due_by)], ["Charge", o.charge]],
        next: "Respond in Stripe before the due date with the quote, emails and delivery notes.",
        dashPath: `disputes/${o.id}`,
      };
    case "radar.early_fraud_warning.created":
      return {
        subject: "ACTION NEEDED: fraud warning on a payment",
        headline: "The card issuer flagged a payment as possible fraud",
        rows: [["Charge", o.charge], ["Type", o.fraud_type]],
        next: "Don't start work. Consider refunding it in Stripe to avoid a dispute.",
        dashPath: o.payment_intent ? `payments/${o.payment_intent}` : undefined,
      };
    default:
      return null;
  }
}

function lines(inv) {
  return (inv.lines?.data || []).map((l) => l.description).filter(Boolean).slice(0, 5).join("; ");
}
function planName(sub) {
  const item = sub.items?.data?.[0];
  return item?.price?.lookup_key || item?.price?.nickname || item?.price?.id || "plan";
}
