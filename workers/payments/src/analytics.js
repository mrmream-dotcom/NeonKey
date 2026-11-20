// Verified purchase tracking (Nov 19 2026). Runs only for Stripe events whose signature this Worker has already checked,
// so a purchase is counted when Stripe says the money (or the free trial) is real, not when someone lands on a thanks
// page. The thanks-page script (public/js/checkout-return.js) now only counts "came back from Stripe".
//
// Sends, for live Checkout Sessions only:
//   - GA4 (Measurement Protocol): "purchase" when money was taken, "trial_started" when a free trial began
//     (payment_status no_payment_required). transaction_id = the Checkout Session id, so GA4 drops a repeat.
//     Needs the secret GA4_API_SECRET (GA4 Admin > Data streams > Web > Measurement Protocol API secrets).
//     Without it, GA4 is skipped and logged; nothing else changes.
//   - Umami: "checkout_completed" with lane, sku, value and kind (purchase or trial). Uses only the public website id.
//
// No personal data is sent: no email, name or Stripe customer id. The GA4 client id comes from the buy link's
// client_reference_id (public/js/checkout-attr.js adds "_g<id>" on the buy click) so GA4 can join the purchase to the
// visit; when it is missing, a stand-in id is made from the session id (the purchase still counts, unattributed).
// Failures never fail the webhook: Stripe would retry and resend the notice email.

const GA4_ID = "G-425106TVS2";
const UMAMI_SEND = "https://cloud.umami.is/api/send";
const UMAMI_SITE = "2c6a467e-392a-4226-b068-fdfc908a48da";
const PAID_TYPES = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

/** nk1_<lane>_<sku>_<location>[_<src>][_g<a>-<b>] -> parts. Anything else -> {}. */
export function parseRef(ref) {
  if (typeof ref !== "string" || !/^nk1_[A-Za-z0-9_-]{1,196}$/.test(ref)) return {};
  const parts = ref.split("_").slice(1);
  let gaClientId = "";
  const last = parts[parts.length - 1] || "";
  const g = /^g(\d{1,12})-(\d{1,12})$/.exec(last);
  if (g) { gaClientId = `${g[1]}.${g[2]}`; parts.pop(); }
  const [lane = "", sku = "", location = "", src = ""] = parts;
  return { lane, sku, location, src, gaClientId };
}

/** What to report for a verified event, or null when it is not a completed live checkout. */
export function purchaseFor(event) {
  if (!event?.livemode || !PAID_TYPES.has(event.type)) return null;
  const o = event.data?.object || {};
  if (!o.id || o.object !== "checkout.session") return null;
  let kind;
  if (o.payment_status === "paid") kind = "purchase";
  else if (o.payment_status === "no_payment_required" && o.mode === "subscription") kind = "trial";
  else return null; // unpaid (delayed method): async_payment_succeeded reports it later
  const ref = parseRef(o.client_reference_id);
  const value = Math.max(0, Number(o.amount_total) || 0) / 100;
  return {
    kind,
    transactionId: o.id,
    value,
    currency: String(o.currency || "usd").toUpperCase(),
    lane: ref.lane || "",
    sku: ref.sku || String(o.metadata?.offer || "unknown").slice(0, 60),
    location: ref.location || "",
    src: ref.src || "",
    gaClientId: ref.gaClientId || standInClientId(o.id),
    attributed: Boolean(ref.gaClientId),
  };
}

function standInClientId(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${h}.${Math.floor(Date.now() / 1000)}`;
}

export function ga4Body(p) {
  const params = {
    transaction_id: p.transactionId,
    currency: p.currency,
    value: p.value,
    items: [{ item_id: p.sku, price: p.value, quantity: 1 }],
    lane: p.lane,
    checkout_location: p.location,
    first_source: p.src,
    verified: "stripe",
  };
  return { client_id: p.gaClientId, non_personalized_ads: true, events: [{ name: p.kind === "trial" ? "trial_started" : "purchase", params }] };
}

export function umamiBody(p) {
  return {
    type: "event",
    payload: {
      website: UMAMI_SITE,
      hostname: "neonkey.tech",
      language: "en-US",
      url: "/stripe/verified",
      name: "checkout_completed",
      data: { kind: p.kind, lane: p.lane || "unknown", sku: p.sku, value: p.value, src: p.src || "unknown", verified: "stripe" },
    },
  };
}

/** Sends both; never throws. Returns { ga4, umami } as "sent" | "skipped" | "failed" for logs and tests. */
export async function reportPurchase(env, event, fetchImpl = fetch) {
  const out = { ga4: "skipped", umami: "skipped" };
  const p = purchaseFor(event);
  if (!p) return out;
  const post = async (url, body, headers = {}) => {
    try {
      const r = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
      return r.ok ? "sent" : "failed";
    } catch {
      return "failed";
    }
  };
  const jobs = [];
  if (env.GA4_API_SECRET) {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_ID}&api_secret=${encodeURIComponent(env.GA4_API_SECRET)}`;
    jobs.push(post(url, ga4Body(p)).then((s) => (out.ga4 = s)));
  } else {
    console.log("payments: GA4_API_SECRET not set, verified purchase not sent to GA4");
  }
  // Umami drops requests whose User-Agent looks like a bot or is missing.
  jobs.push(post(UMAMI_SEND, umamiBody(p), { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) NeonKeyPayments/1.0" }).then((s) => (out.umami = s)));
  await Promise.all(jobs);
  if (out.ga4 === "failed" || out.umami === "failed") console.log("payments: purchase tracking failed", JSON.stringify(out));
  return out;
}
