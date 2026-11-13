// Checks the built /learn/is-this-a-scam/ page (Family Shield demand test). Run after a build:
//   rm -rf dist && SITE_URL=https://neonkey.tech BASE_PATH=/ PUBLIC_SITE_MODE=live npx astro build && npm run test:site
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const page = "dist/learn/is-this-a-scam/index.html";
const html = existsSync(page) ? readFileSync(page, "utf8") : "";
// Remove <tag ...>...</tag ...> blocks from our own build output (plain index search, not a sanitizer).
function dropBlocks(src, tag) {
  let out = "";
  let i = 0;
  const low = src.toLowerCase();
  for (;;) {
    const start = low.indexOf(`<${tag}`, i);
    if (start < 0) return out + src.slice(i);
    const close = low.indexOf(`</${tag}`, start);
    const end = close < 0 ? -1 : low.indexOf(">", close);
    out += src.slice(i, start) + " ";
    if (end < 0) return out;
    i = end + 1;
  }
}
// Article body only: the site header/footer logo renders "Neon" and "Key" as separate spans.
const body = (html.match(/<article[\s\S]*?<\/article>/) || [""])[0];
const text = dropBlocks(dropBlocks(body, "script"), "style").replace(/<[^>]+>/g, " ").replace(/&#39;|&#x27;/g, "'").replace(/\s+/g, " ");

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

test("Family Shield free check: in-browser only, advice wording, no waitlist form", () => {
  assert.match(html, /id="check"/);
  assert.match(html, /<textarea id="fc-text"/);
  // Not inside a <form>: the Google tag watches form submits and could read fields.
  const box = html.slice(html.indexOf('id="check"'), html.indexOf('id="practice"'));
  assert.doesNotMatch(box, /<form/i);
  assert.match(text, /never sent or saved anywhere/);
  assert.match(text, /advice from a set of rules, not a promise/);
  assert.doesNotMatch(html, /data-fs-form|name="consent"|\/waitlist"/);
  assert.match(text, /nothing is for sale yet/);
  assert.match(html, /href="\/privacy\/#scam-check"|privacy/);
});

test("checker script sends nothing: no fetch or beacon in the page's own scripts", () => {
  const srcs = [...html.matchAll(/<script[^>]*src="(\/_astro\/[^"]+)"/g)].map((m) => m[1]);
  for (const s of srcs) {
    const js = readFileSync("dist" + s, "utf8");
    if (!js.includes("scam-check-run")) continue;
    assert.doesNotMatch(js, /\bfetch\(|sendBeacon|XMLHttpRequest/);
  }
});

test("/scam/ short link redirects to the checker", () => {
  const r = readFileSync("dist/scam/index.html", "utf8");
  assert.match(r, /url=\/learn\/is-this-a-scam\/#check/);
  assert.match(r, /noindex/);
});

test("no checkout or payment link on the page", () => {
  assert.doesNotMatch(html, /buy\.stripe\.com|checkout\.stripe\.com/);
});

test("analytics: Umami present once, events wired", () => {
  assert.equal(html.split("cloud.umami.is/script.js").length - 1, 1);
    const js = (html.match(/<script[^>]*src="([^"]+)"/g) || []).join(" ");
  assert.ok(js.length > 0);
});

test("privacy page explains the free check", () => {
  const p = readFileSync("dist/privacy/index.html", "utf8");
  assert.match(p, /id="scam-check"/);
  assert.match(p, /never sent to NeonKey or anyone else/);
  assert.match(p, /id="waitlists"/);
  assert.match(p, /aren(&#39;|')t added to the newsletter/);
});

test("waitlist host is allowed by the CSP", () => {
  assert.match(readFileSync("public/_headers", "utf8"), /connect-src[^\n]*https:\/\/neonkey-quiz\.mr-mream\.workers\.dev/);
});
