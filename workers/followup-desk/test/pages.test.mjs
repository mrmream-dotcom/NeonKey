// Rendering tests for the dashboard pages: escaping, CSP-safe markup, empty states, state-driven actions and the
// markup phones depend on. Pure functions only: no KV, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardPage, settingsPage, loginPage, notFoundPage, unsubPage, actionPage, attention, upcoming, todaySummary, primaryAction, statusChip, CSS } from "../src/pages.js";
import { defaultSettings, DAY } from "../src/engine.js";

const NOW = Date.UTC(2026, 10, 16, 18, 0); // Mon Nov 16 2026
const base = "/d/" + "a".repeat(43);
const portalUrl = "https://billing.stripe.com/p/login/test";
const HOSTILE = `<img src=x onerror=alert(1)>"'&</script><script>alert(2)</script>`;
let n = 0;
const it = (status, extra = {}) => ({ id: `item${String(++n).padStart(5, "0")}`, kind: "estimate", name: "Jane", email: "jane@ex.test", job: "Deck", sentOn: NOW - 5 * DAY, step: 1, status, sends: [NOW - DAY], ...extra });
const acctWith = (items, over = {}) => ({ id: "acct00000001", billing: "active", setupDone: true, paused: false, previewSent: true, messagesSeen: 1, email: "o@ex.test", settings: { ...defaultSettings("Smith Roofing"), replyTo: "o@ex.test", signoff: "Pat" }, items, ...over });

const allPages = (acct) => [
  dashboardPage({ acct, base, msg: "saved", portalUrl, now: NOW }),
  dashboardPage({ acct: { ...acct, setupDone: false }, base, msg: "", portalUrl, now: NOW }),
  settingsPage({ acct, base, msg: "saved", portalUrl }),
  loginPage(false), loginPage(true), notFoundPage(),
  unsubPage(acct.settings.business, false, "/u/x/y"), unsubPage(acct.settings.business, true),
  actionPage({ business: acct.settings.business, item: acct.items[0], action: "yes", path: "/a/x/y/yes", error: HOSTILE }),
  actionPage({ business: acct.settings.business, item: acct.items[0], action: "ask", path: "/a/x/y/ask" }),
  actionPage({ business: acct.settings.business, item: acct.items[0], action: "yes", path: "/a/x/y/yes", done: true }),
];

test("pages: hostile strings are escaped everywhere they appear", () => {
  const items = [
    it("replied", { name: HOSTILE, job: HOSTILE, email: HOSTILE, repliedAt: NOW - DAY, closedAt: NOW - DAY, note: HOSTILE }),
    it("bounced", { name: HOSTILE, job: HOSTILE, closedAt: NOW - DAY, note: HOSTILE }),
    it("stopped", { name: HOSTILE, closedAt: NOW - DAY, note: HOSTILE }),
    it("open", { name: HOSTILE, job: HOSTILE, id: `x"><b>` }),
  ];
  const acct = acctWith(items, { settings: { ...defaultSettings(HOSTILE), replyTo: HOSTILE, signoff: HOSTILE, payUrl: HOSTILE } });
  for (const html of allPages(acct)) {
    assert.ok(!html.includes("<img src=x"), "no raw tag");
    assert.ok(!html.includes("<script"), "no script tag");
    assert.ok(!/value="[^"]*"><b>/.test(html), "attribute values can't break out");
  }
  const dash = dashboardPage({ acct, base, msg: "", portalUrl: `https://x.test/"><img src=x>`, now: NOW });
  assert.ok(dash.includes("&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;"));
  assert.ok(!dash.includes(`"><img src=x>`), "portal URL is escaped");
});

test("pages: CSP-safe markup (no inline scripts, no style attributes, no external hosts)", () => {
  const acct = acctWith([it("open"), it("replied", { repliedAt: NOW - DAY, closedAt: NOW - DAY })]);
  for (const html of allPages(acct)) {
    assert.ok(!/<script/i.test(html));
    assert.ok(!/\sstyle=/i.test(html), "style-src 'self' blocks style attributes");
    assert.ok(!/<[^>]*\son[a-z]+=/i.test(html), "no inline event handlers");
    assert.ok(!/<link[^>]+href="https?:/i.test(html) && !/src="https?:/i.test(html), "no external assets");
  }
  assert.ok(!/@import|url\(/.test(CSS), "stylesheet loads nothing else");
});

test("pages: mobile-critical markup", () => {
  const acct = acctWith([it("open")]);
  const html = dashboardPage({ acct, base, msg: "", portalUrl, now: NOW });
  assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/);
  assert.match(html, /class="skip" href="#main"/);
  assert.match(html, /<main id="main"/);
  assert.match(html, /aria-current="page">Today</);
  assert.match(CSS, /min-height:44px/);
  assert.match(CSS, /:focus-visible\{outline:3px solid/);
  assert.match(CSS, /@media \(max-width:759px\)\{[^]*\.tbl,\.tbl tbody,\.tbl tr,\.tbl td\{display:block/, "table stacks on phones");
  assert.match(CSS, /\.btn\.sm\{min-height:44px/, "small buttons grow to 44px on phones");
  // Every form control has a label.
  for (const page of [html, settingsPage({ acct, base, msg: "" }), dashboardPage({ acct: { ...acct, setupDone: false }, base, msg: "" })]) {
    for (const [, id] of page.matchAll(/<(?:input|select|textarea)[^>]*\sid="([^"]+)"/g)) assert.ok(page.includes(`for="${id}"`), `label for ${id}`);
    for (const m of page.matchAll(/<input type="checkbox"[^>]*>/g)) assert.ok(page.slice(page.lastIndexOf("<label", m.index), m.index).length < 40, "checkbox sits inside its label");
  }
  // Action buttons name the customer for screen readers.
  assert.match(html, /Won<span class="sr"> for Jane<\/span>/);
});

test("pages: every existing form field and action is still there", () => {
  const acct = acctWith([it("open"), it("stopped", { closedAt: NOW - DAY })]);
  const dash = dashboardPage({ acct, base, msg: "", portalUrl, now: NOW });
  for (const a of ["add", "import", "item", "test", "pause"]) assert.ok(dash.includes(`action="${base}/${a}"`), a);
  for (const f of ["name", "email", "job", "kind", "date", "amount", "list", "id", "to", "paused"]) assert.ok(dash.includes(`name="${f}"`), f);
  assert.ok(dash.includes('name="to" value="open"'), "Reopen on a stopped job");
  const setup = dashboardPage({ acct: { ...acct, setupDone: false }, base, msg: "" });
  assert.ok(setup.includes(`action="${base}/setup"`));
  for (const f of ["business", "replyTo", "signoff", "timezone"]) assert.ok(setup.includes(`name="${f}"`), f);
  const set = settingsPage({ acct, base, msg: "" });
  assert.ok(set.includes(`action="${base}/settings"`) && set.includes(`action="${base}/reset"`));
  for (const f of ["business", "replyTo", "signoff", "timezone", "bccMe", "buttons", "payUrl", "d0", "d1", "d2", "estimate_s0", "estimate_b2", "invoice_s1", "inquiry_b0"]) assert.ok(set.includes(`name="${f}"`), f);
  assert.ok(loginPage(false).includes('action="/login"') && loginPage(false).includes('name="email"'));
  const yes = actionPage({ business: "B", item: acct.items[0], action: "yes", path: "/a/x/y/yes" });
  assert.ok(yes.includes('name="note"') && yes.includes('name="phone"'));
});

test("empty state: a new trial with nothing added says exactly what to do first", () => {
  const acct = acctWith([], { billing: "trialing", previewSent: false, messagesSeen: 0 });
  const html = dashboardPage({ acct, base, msg: "", portalUrl, now: NOW });
  assert.match(html, /Your Desk is ready\. Add the first estimate you're waiting on\./);
  assert.match(html, /href="#add">.*Add your first estimate/);
  assert.match(html, /Getting started/);
  assert.match(html, /1 of 4 done/);
  assert.ok(!html.includes("Needs your attention"), "no empty feeds before there's anything to show");
  assert.ok(!html.includes('class="head-cta"'), "one primary action: the first-run card");
  assert.match(html, /Free trial/);
  // Not set up yet: the setup form, nothing else.
  const setup = dashboardPage({ acct: { ...acct, setupDone: false }, base, msg: "" });
  assert.match(setup, /get your Desk running/);
  assert.ok(!setup.includes('id="add"'));
});

test("empty state: attention feed when nothing needs the owner", () => {
  const acct = acctWith([it("open")]);
  const html = dashboardPage({ acct, base, msg: "", portalUrl, now: NOW });
  assert.match(html, /Nothing needs you right now\./);
  assert.match(html, /Coming up/);
});

test("attention: replies first, then bounces and customer stops; old and owner-closed items left out", () => {
  const items = [
    it("stopped", { name: "Owner stop", closedAt: NOW - DAY }), // owner pressed Stop: no note, not attention
    it("stopped", { name: "Asked", closedAt: NOW - DAY, note: "Asked to stop" }),
    it("bounced", { name: "Bounce", closedAt: NOW - 2 * DAY, note: "Email couldn't be delivered" }),
    it("replied", { name: "Old reply", repliedAt: NOW - 20 * DAY, closedAt: NOW - 20 * DAY }),
    it("replied", { name: "Reply A", repliedAt: NOW - 3 * DAY, closedAt: NOW - 3 * DAY }),
    it("replied", { name: "Reply B", repliedAt: NOW - DAY, closedAt: NOW - DAY }),
    it("won", { name: "Won", repliedAt: NOW - DAY, closedAt: NOW - DAY }),
    it("open", { name: "Open" }),
  ];
  const list = attention(acctWith(items), NOW);
  assert.deepEqual(list.map((x) => x.item.name), ["Reply B", "Reply A", "Bounce", "Asked"]);
  const html = dashboardPage({ acct: acctWith(items), base, msg: "", portalUrl, now: NOW });
  assert.match(html, /Reply B replied/);
  assert.match(html, /Couldn't reach Bounce/);
  assert.match(html, /Follow-ups stopped for Asked/);
  assert.match(todaySummary(acctWith(items), NOW), /^2 customers replied and 2 follow-ups stopped or bounced\./);
});

test("upcoming: soonest first, capped", () => {
  const items = [it("open", { name: "Later", sentOn: NOW, step: 0 }), it("open", { name: "Soon", sentOn: NOW - DAY, step: 0 }), it("won")];
  const acct = acctWith(items);
  assert.deepEqual(upcoming(acct).map((x) => x.item.name), ["Soon", "Later"]);
  assert.equal(upcoming(acct, 1).length, 1);
  assert.match(todaySummary(acct, NOW), /^All clear\. 2 jobs are being followed up\. Next one goes out Nov 18\./);
});

test("primary action follows the account's state", () => {
  const a = acctWith([it("open")]);
  assert.match(primaryAction(a, base, portalUrl), /href="#add">.*Add a follow-up/);
  assert.match(primaryAction({ ...a, paused: true }, base, portalUrl), /name="paused" value="0".*Resume follow-ups/);
  assert.match(primaryAction({ ...a, billing: "canceled" }, base, portalUrl), /Restart the Desk/);
  assert.match(primaryAction({ ...a, billing: "canceled" }, base, portalUrl), /href="https:\/\/neonkey.tech\/follow-up-desk\/"/);
  assert.match(primaryAction({ ...a, billing: "past_due" }, base, portalUrl), /Update payment/);
  assert.match(primaryAction({ ...a, billing: "past_due" }, base, ""), /mailto:hello@neonkey\.tech/);
  const canceled = dashboardPage({ acct: { ...a, billing: "canceled" }, base, msg: "", portalUrl, now: NOW });
  assert.ok(!canceled.includes('id="add"'), "no adding after cancel");
  assert.match(canceled, /your subscription has ended/);
  assert.ok(!canceled.includes(`action="${base}/pause"`));
  const pastDue = dashboardPage({ acct: { ...a, billing: "past_due" }, base, msg: "", portalUrl, now: NOW });
  assert.match(pastDue, /the last payment didn't go through/);
  assert.match(pastDue, /Billing needs attention/);
});

test("status chip: trial shown only while it's really a running trial", () => {
  const a = acctWith([]);
  assert.deepEqual(statusChip({ ...a, billing: "trialing" }), { label: "Running", cls: "ok", trial: true });
  assert.equal(statusChip({ ...a, billing: "active" }).trial, false);
  assert.equal(statusChip({ ...a, billing: "trialing", paused: true }).label, "Paused");
});

test("a lost job the customer replied to has no Reopen button (it would follow up again)", async () => {
  const { dashboardPage } = await import("../src/pages.js");
  const now = Date.UTC(2026, 10, 16, 18);
  const acct = { id: "a1", billing: "active", paused: false, setupDone: true, settings: { timezone: "America/Chicago", days: [3, 7, 14], replyTo: "o@example.com", business: "Shop" },
    items: [
      { id: "r1", name: "Replied Lost", email: "r@example.com", status: "lost", repliedAt: now - 1000, closedAt: now - 500, step: 1, sentAt: now - 9e8 },
      { id: "s1", name: "Plain Stopped", email: "s@example.com", status: "stopped", closedAt: now - 400, step: 1, sentAt: now - 9e8 },
    ] };
  const html = dashboardPage({ acct, base: "/d/tok", now });
  const reopenIds = [...html.matchAll(/name="id" value="([^"]+)"><input type="hidden" name="to" value="open">/g)].map((m) => m[1]);
  assert.deepEqual(reopenIds, ["s1"]);
});

test("stylesheet URL carries a content version", async () => {
  const { CSS_VERSION, dashboardPage } = await import("../src/pages.js");
  assert.match(CSS_VERSION, /^[0-9a-z]+$/);
});
