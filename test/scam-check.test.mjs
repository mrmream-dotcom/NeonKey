// Unit tests for the Family Shield free check rules (src/lib/scam-check.mjs). No build needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMessage, findLinks, linkTells, VERDICTS } from "../src/lib/scam-check.mjs";

const v = (m) => checkMessage(m).verdict;

test("common scams read as scams", () => {
  for (const m of [
    "USPS: Your package is on hold due to an incomplete address. Pay the $1.25 redelivery fee within 24 hours: usps-redeliver-help.top/track",
    "FINAL NOTICE: unpaid toll balance of $6.99. Pay now at ezpass-tolls.xyz to avoid a $50 late fee and license suspension.",
    "Did you try an $892 purchase? Reply YES or NO. A specialist will call to verify you with the code we just sent.",
    "Your computer is infected with 3 viruses. Do NOT close this window. Call Microsoft Support now.",
    "Hi mom this is my new number, save it. Can you send me $300, I'll pay you back tomorrow",
    "Congratulations! You've won a $1000 Walmart gift card. Claim your prize: bit.ly/xyz123",
    "Your PayPal account has been limited. Verify your account at paypal-secure-login.com within 24 hours.",
    "This is the IRS. You owe back taxes. Pay with gift cards today or a warrant will be issued for your arrest.",
  ]) assert.equal(v(m), "scam", m);
});

test("ordinary messages are not called scams", () => {
  for (const m of [
    "Hey are we still on for dinner Friday at 7?",
    "Your Amazon order #112-555 has shipped. Track it in the Amazon app.",
    "Your Sample Shop verification code is 482913. It expires in 10 minutes. Sample Shop will never call or text to ask for this code.",
    "Meeting moved to 3pm, see the agenda at docs.google.com/document/d/abc",
  ]) assert.notEqual(v(m), "scam", m);
});

test("an unknown link alone means check it the direct way", () => {
  assert.equal(v("Hey, look at this: some-random-site.com/page"), "unsure");
});

test("look-alike, shortener, IP and punycode links are flagged; real brand domains are not", () => {
  assert.ok(linkTells("usps-redeliver-help.top").some((t) => t.id === "link-lookalike"));
  assert.ok(linkTells("bit.ly").some((t) => t.id === "link-short"));
  assert.ok(linkTells("192.168.4.20").some((t) => t.id === "link-ip"));
  assert.ok(linkTells("xn--pple-43d.com").some((t) => t.id === "link-punycode"));
  assert.equal(linkTells("tools.usps.com").length, 0);
  assert.equal(linkTells("docs.google.com").length, 0);
});

test("link finder skips emails and prices", () => {
  assert.deepEqual(findLinks("Email hello@neonkey.tech, pay $1.25 at example.top/x"), ["example.top"]);
});

test("empty or tiny input asks for a message", () => {
  assert.equal(checkMessage("").empty, true);
  assert.equal(checkMessage("hi").empty, true);
});

test("wording rules: three outcomes, never 'safe', every result says what to do", () => {
  assert.deepEqual(Object.keys(VERDICTS).sort(), ["normal", "scam", "unsure"]);
  for (const label of Object.values(VERDICTS)) assert.doesNotMatch(label, /\bsafe\b|verified|%/i);
  for (const m of ["Dinner at 7?", "Pay the fee at x-y-z.top now", "Your bank account needs attention, call us"]) {
    const r = checkMessage(m);
    assert.ok(r.todo.length > 40);
    assert.doesNotMatch(r.todo + r.tells.map((t) => t.say).join(" "), /\byou'?re safe\b|\bit'?s safe\b|guarantee/i);
  }
});

test("long input is capped at 8,000 characters", () => {
  const r = checkMessage("a ".repeat(10000) + " gift card");
  assert.equal(r.tells.some((t) => t.id === "pay-odd"), false);
});
