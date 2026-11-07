// Writes sample pages and emails to ./preview/ (git-ignored) so they can be looked at in a browser. No network.
// Run: npm run preview
import { mkdirSync, writeFileSync } from "node:fs";
import { dashboardPage, settingsPage, loginPage, CSS } from "../src/pages.js";
import { welcomeEmail, reportEmail, forwardEmail, followUpEmail } from "../src/mail.js";
import { defaultSettings, DAY } from "../src/engine.js";

const now = Date.now();
const settings = { ...defaultSettings("Sample Roofing Co"), replyTo: "owner@example.com", signoff: "Pat, Sample Roofing Co" };
const it = (name, email, job, status, step, ago, extra = {}) => ({ id: Math.random().toString(36).slice(2, 11), kind: "estimate", name, email, job, sentOn: now - ago * DAY, step, status, sends: Array(step).fill(now - DAY), ...extra });
const acct = {
  id: "sampleacct01", billing: "active", setupDone: true, paused: false, email: "owner@example.com", settings,
  items: [
    it("Sample Customer A", "a@example.com", "the roof repair", "open", 1, 5),
    it("Sample Customer B", "b@example.com", "the gutter job", "open", 0, 1),
    it("Sample Customer C", "c@example.com", "the deck", "replied", 1, 6, { repliedAt: now - DAY, closedAt: now - DAY }),
    it("Sample Customer D", "d@example.com", "the siding", "won", 2, 12, { closedAt: now - 2 * DAY }),
  ],
};
const out = new URL("../preview/", import.meta.url);
mkdirSync(out, { recursive: true });
const withCss = (h) => h.replace('<link rel="stylesheet" href="/app.css">', `<style>${CSS}</style>`);
writeFileSync(new URL("dashboard.html", out), withCss(dashboardPage({ acct, base: "/d/sample", msg: "", portalUrl: "https://billing.stripe.com/p/login/sample" })));
writeFileSync(new URL("setup.html", out), withCss(dashboardPage({ acct: { ...acct, setupDone: false, items: [] }, base: "/d/sample", msg: "" })));
writeFileSync(new URL("settings.html", out), withCss(settingsPage({ acct, base: "/d/sample", msg: "" })));
writeFileSync(new URL("login.html", out), withCss(loginPage(false)));
writeFileSync(new URL("email-welcome.html", out), welcomeEmail({ name: "Pat", link: "https://example.com/d/sample" }).html);
writeFileSync(new URL("email-report.html", out), reportEmail({ acct, link: "https://example.com/login", now }).html);
writeFileSync(new URL("email-reply.html", out), forwardEmail({ item: acct.items[2], from: "Sample Customer C <c@example.com>", subject: "Re: Your estimate for the deck", text: "Looks good. When can you start?" }).html);
writeFileSync(new URL("email-followup.html", out), followUpEmail(acct.items[0], settings, "https://example.com/u/x/y").html);
console.log("Wrote preview/ files");
