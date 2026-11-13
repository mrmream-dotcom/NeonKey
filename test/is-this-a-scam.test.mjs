// Checks the built /learn/is-this-a-scam/ page (Family Shield demand test). Run after a build:
//   rm -rf dist && SITE_URL=https://neonkey.tech BASE_PATH=/ PUBLIC_SITE_MODE=live npx astro build && npm run test:site
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const page = "dist/learn/is-this-a-scam/index.html";
const html = existsSync(page) ? readFileSync(page, "utf8") : "";
// Article body only: the site header/footer logo renders "Neon" and "Key" as separate spans.
const body = (html.match(/<article[\s\S]*?<\/article>/) || [""])[0];
const text = body.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#39;|&#x27;/g, "'").replace(/\s+/g, " ");

test("page is built", () => assert.ok(html.length > 1000, `${page} missing; build first`));

test("copy rules: no safety promises, banned words or wrong names", () => {
  for (const banned of [/you'?re safe/i, /\bit'?s safe\b/i, /guarantee/i, /plain english/i, /\bMike\b/, /Neon Key/, /100%/]) assert.doesNotMatch(text, banned, String(banned));
});

test("every practice message is labeled as a made-up sample", () => {
  const cards = html.match(/data-ss data-id=/g) || [];
  assert.equal(cards.length, 6);
  assert.equal((text.match(/Sample \d · /g) || []).length, 6);
  assert.match(text, /sample made up for practice/i);
});

test("practice phone numbers are fictional 555-01xx numbers", () => {
  const nums = text.match(/\(?\d{3}\)?[ -]\d{3}-\d{4}/g) || [];
  assert.ok(nums.length >= 3);
  for (const n of nums) assert.match(n, /555\)? ?-?010-?\d{4}|555[ -]010/, n);
});

test("Family Shield waitlist: planned price, not built, adults, consent, privacy link", () => {
  assert.match(text, /Planned price: \$7\/month or \$70\/year/);
  assert.match(text, /not built yet/i);
  assert.match(text, /18 or older/);
  assert.match(text, /charges nothing/);
  assert.match(html, /name="consent"[^>]*required/);
  assert.match(html, /href="\/privacy\/#waitlists"/);
  assert.match(html, /data-api="https:\/\/neonkey-quiz\.mr-mream\.workers\.dev\/waitlist"/);
  assert.match(html, /data-product="family-shield"/);
});

test("no checkout or payment link on the page", () => {
  assert.doesNotMatch(html, /buy\.stripe\.com|checkout\.stripe\.com/);
});

test("analytics: Umami present once, events wired", () => {
  assert.equal(html.split("cloud.umami.is/script.js").length - 1, 1);
  assert.match(html, /data-umami-event="waitlist-cta"/);
  const js = (html.match(/<script[^>]*src="([^"]+)"/g) || []).join(" ");
  assert.ok(js.length > 0);
});

test("privacy page has the Waitlists section", () => {
  const p = readFileSync("dist/privacy/index.html", "utf8");
  assert.match(p, /id="waitlists"/);
  assert.match(p, /aren(&#39;|')t added to the newsletter/);
});

test("waitlist host is allowed by the CSP", () => {
  assert.match(readFileSync("public/_headers", "utf8"), /connect-src[^\n]*https:\/\/neonkey-quiz\.mr-mream\.workers\.dev/);
});
