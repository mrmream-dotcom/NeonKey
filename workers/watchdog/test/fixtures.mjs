// Synthetic fixtures, copied from prototypes/watchdog/fixtures/timeline.mjs. .test domains never resolve on the internet.
// healthy(): a founder domain on Google Workspace that passes everything. Each day below changes one thing,
// the way real setups drift: a new sending tool, a "cleanup" that deletes DMARC, a provider move, a DNS host change.
const q = (s) => `"${s}"`;
export const DOMAIN = "launchpad.test";

export function healthy() {
  return {
    [DOMAIN]: {
      MX: ["1 smtp.google.com."],
      NS: ["ada.ns.cloudflare.com.", "bob.ns.cloudflare.com."],
      TXT: [q("v=spf1 include:_spf.google.com ~all"), q("google-site-verification=fake")],
    },
    [`_dmarc.${DOMAIN}`]: { TXT: [q("v=DMARC1; p=quarantine; rua=mailto:dmarc@launchpad.test")] },
    [`google._domainkey.${DOMAIN}`]: { TXT: ['"v=DKIM1; k=rsa; p=MIIBIjANBgkqFAKE" "FAKEFAKEFAKE"'] },
    [`resend._domainkey.${DOMAIN}`]: { TXT: [q("p=MIGfMA0GCSqFAKE")] },
    "_spf.google.com": { TXT: [q("v=spf1 include:_netblocks.google.com ~all")] },
    "_netblocks.google.com": { TXT: [q("v=spf1 ip4:192.0.2.0/24 ~all")] },
    "sendgrid.net": { TXT: [q("v=spf1 ip4:198.51.100.0/24 ~all")] },
  };
}

const clone = (z) => JSON.parse(JSON.stringify(z));
const set = (z, name, type, values) => { z[name] = { ...(z[name] || {}), [type]: values }; return z; };

/** Day-by-day drift. Each entry: what happened (for the demo output) and the zone after it happened. */
export function timeline() {
  const days = [];
  let z = healthy();
  days.push({ day: 0, what: "Baseline: everything passes", zone: clone(z) });
  z = set(clone(z), DOMAIN, "TXT", [q("v=spf1 include:_spf.google.com include:sendgrid.net ~all"), q("google-site-verification=fake")]);
  days.push({ day: 1, what: "Added SendGrid for product emails (a normal change)", zone: clone(z) });
  z = clone(z); delete z[`_dmarc.${DOMAIN}`];
  days.push({ day: 2, what: "A DNS cleanup deleted the DMARC record", zone: clone(z) });
  z = set(clone(z), `_dmarc.${DOMAIN}`, "TXT", [q("v=DMARC1; p=none")]);
  days.push({ day: 3, what: "DMARC put back, but weaker and without reports", zone: clone(z) });
  z = clone(z); delete z[`resend._domainkey.${DOMAIN}`];
  days.push({ day: 4, what: "The Resend DKIM key was removed", zone: clone(z) });
  z = set(clone(z), DOMAIN, "NS", ["ns1.unknown-host.test.", "ns2.unknown-host.test."]);
  days.push({ day: 5, what: "Name servers moved to a host nobody set up", zone: clone(z) });
  z = set(clone(z), DOMAIN, "TXT", [q("v=spf1 include:_spf.google.com include:sendgrid.net +all"), q("google-site-verification=fake")]);
  days.push({ day: 6, what: "SPF ending changed to +all", zone: clone(z) });
  return days;
}
