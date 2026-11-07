// The dashboard. Server-rendered HTML with plain forms: no JavaScript, no cookies, no inline scripts.
// The link token in the URL is the login (see store.js). Every dynamic string goes through esc().
import { esc } from "./mail.js";
import { KINDS, TIMEZONES, fmtDate, nextDue, DEFAULT_TEMPLATES } from "./engine.js";

export const CSS = `
:root{--bg:#0b0d17;--panel:#151935;--line:#262b52;--text:#e8eaf6;--muted:#b3b8d6;--cyan:#22d3ee;--violet:#a78bfa;--magenta:#f472b6;--green:#34d399;--amber:#fbbf24;--red:#f87171}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:var(--cyan)}
.wrap{max-width:980px;margin:0 auto;padding:20px 16px 60px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:18px}
.brand{font-weight:800;letter-spacing:.02em}.brand span{color:var(--cyan)}
.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:.8rem;font-weight:700;border:1px solid var(--line)}
.pill.ok{color:var(--green);border-color:var(--green)}.pill.warn{color:var(--amber);border-color:var(--amber)}.pill.bad{color:var(--red);border-color:var(--red)}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;margin:0 0 16px}
.panel h2{margin:0 0 10px;font-size:1.1rem}
.muted{color:var(--muted)}.small{font-size:.88rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px}.stat b{display:block;font-size:1.6rem}
label{display:block;font-size:.88rem;color:var(--muted);margin-bottom:4px}
input,select,textarea{width:100%;background:#0f1230;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:9px 10px;font:inherit}
textarea{min-height:110px}
input[type=checkbox]{width:auto;margin-right:6px}
.btn{display:inline-block;background:var(--cyan);color:#0b0d17;border:0;border-radius:9px;padding:9px 16px;font-weight:700;cursor:pointer;text-decoration:none;font-size:.95rem}
.btn.ghost{background:transparent;color:var(--cyan);border:1px solid var(--cyan)}
.btn.sm{padding:4px 10px;font-size:.82rem}.btn.warn{background:transparent;color:var(--muted);border:1px solid var(--line)}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:end}.row>*{flex:1 1 180px}
.actions{display:flex;gap:6px;flex-wrap:wrap}.actions form{margin:0}
table{width:100%;border-collapse:collapse;font-size:.92rem}
th,td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:600;font-size:.8rem;text-transform:uppercase;letter-spacing:.05em}
.note{border-left:3px solid var(--cyan);padding:10px 14px;background:#10143a;border-radius:8px;margin:0 0 16px}
.note.warn{border-color:var(--amber)}.note.bad{border-color:var(--red)}
.tpl{border-top:1px solid var(--line);padding-top:12px;margin-top:12px}
details summary{cursor:pointer;color:var(--cyan);font-weight:600}
h1{font-size:1.6rem;margin:0 0 4px}
.mt{margin-top:12px}.sr{position:absolute;left:-9999px}
.ic{width:20px;height:20px;vertical-align:-4px;color:var(--cyan);flex:none}.ic.sm{width:15px;height:15px;vertical-align:-2px}.ic.big{width:36px;height:36px}
.panel h2 .ic{margin-right:6px}
.hello{margin:6px 0 18px}
.steps{display:flex;gap:8px;flex-wrap:wrap;list-style:none;padding:0;margin:14px 0 0}
.steps li{display:flex;align-items:center;gap:8px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:.9rem}
.steps li b{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--line);color:var(--text);font-size:.8rem}
.steps li.on{border-color:var(--cyan);color:var(--text)}.steps li.on b{background:var(--cyan);color:#0b0d17}
.split{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:16px;align-items:start}
.split.two{grid-template-columns:1fr 1fr}
@media (max-width:760px){.split,.split.two{grid-template-columns:1fr}}
.label-up{font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--violet);margin:4px 0 8px}
.mail{background:#fff;color:#222;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.mail-head{padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:.92rem}.mail-head .muted{color:#6b7280;display:inline-block;width:62px}
.mail-body{padding:14px 16px 4px;font-size:.95rem}.mail-body p{margin:0 0 12px}
.mail-foot{margin:0;padding:10px 16px;background:#f3f4f6;color:#4b5563}.mail-foot .ic{color:#0891b2}
.btn.big{padding:12px 22px;font-size:1rem;margin-top:6px}
.hint{display:block;font-size:.82rem;color:var(--muted);margin-top:4px}
.start{border-color:var(--cyan)}
.todo{list-style:none;padding:0;margin:0}
.todo li{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.todo li:last-child{border-bottom:0}
.todo li>div{flex:1}.todo form{margin:0}
.tick{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;border:2px solid var(--line);flex:none}
.todo li.done .tick{background:var(--green);border-color:var(--green)}.todo li.done .tick .ic{color:#0b0d17}
.todo li.done strong{color:var(--muted);text-decoration:line-through}
.how{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:14px}
.how>div{display:flex;gap:10px;align-items:flex-start;background:#10143a;border-radius:10px;padding:10px 12px;font-size:.9rem}
.tools{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}
.tool-form{margin:0}
.tool{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);text-decoration:none;font:inherit;font-size:.88rem;font-weight:600;cursor:pointer}
.tool:hover,.tool:focus-visible{border-color:var(--cyan)}
.stat{display:flex;gap:12px;align-items:center}.stat .ic{width:26px;height:26px}
.tag{display:inline-block;font-size:.8rem;font-weight:700;padding:1px 8px;border-radius:999px;border:1px solid var(--line)}
.tag.ok{color:var(--green);border-color:var(--green)}.tag.warn{color:var(--amber);border-color:var(--amber)}
.empty{text-align:center;padding:18px 10px}.empty p{margin:8px 0 14px}
.foot{margin-top:22px}
:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
@media (max-width:640px){.hide-sm{display:none}th,td{padding:8px 4px}.tool{flex:1 1 calc(50% - 8px);justify-content:center}.tool-form{flex:1 1 calc(50% - 8px)}.tool-form .tool{width:100%}}
`;

const MSGS = {
  saved: ["Saved.", ""],
  setup: ["Nice, you're set up. Next: add an estimate you're waiting to hear back on.", ""],
  added: ["Added. The first follow-up goes out on its date, on a weekday morning.", ""],
  dup: ["That email already has an open follow-up, so nothing was added.", "warn"],
  imported: ["List added.", ""],
  limit: ["You've reached 500 open follow-ups. Close some out before adding more.", "warn"],
  bad: ["Something in that form wasn't right. Check the highlighted fields and try again.", "bad"],
  bademail: ["That doesn't look like an email address.", "bad"],
  baddays: ["Follow-up days must be three increasing numbers between 1 and 60.", "bad"],
  updated: ["Updated. No more follow-ups for that job.", ""],
  reopened: ["Reopened. Follow-ups pick up where they left off.", ""],
  test: ["Preview sent to your inbox. Reply to it to see how a customer's reply comes back to you.", ""],
  testfail: ["The preview didn't send. Try again in a minute.", "bad"],
  paused: ["Paused. Nothing goes out until you resume.", "warn"],
  resumed: ["Running again.", ""],
  reset: ["Messages reset to the defaults.", ""],
};

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${esc(title)} · NeonKey Follow-Up Desk</title><link rel="stylesheet" href="/app.css"></head><body><div class="wrap">${body}</div></body></html>`;
}

function header(acct) {
  const state = acct ? deskState(acct) : null;
  return `<div class="top"><div class="brand">NeonKey <span>Follow-Up Desk</span>${acct?.settings?.business ? ` · ${esc(acct.settings.business)}` : ""}</div>${acct ? `<span class="pill ${state.cls}">${esc(state.label)}</span>` : ""}</div>`;
}

export function deskState(acct) {
  if (!["active", "trialing"].includes(acct.billing)) return { label: acct.billing === "canceled" ? "Canceled" : "Billing needs attention", cls: "bad", sending: false };
  if (!acct.setupDone) return { label: "Setup needed", cls: "warn", sending: false };
  if (acct.paused) return { label: "Paused", cls: "warn", sending: false };
  return { label: "Running", cls: "ok", sending: true };
}

const flash = (code) => {
  const m = MSGS[code];
  return m ? `<div class="note ${m[1]}">${esc(m[0])}</div>` : "";
};
const tzOptions = (cur) => TIMEZONES.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("");
const kindOptions = (cur = "estimate") => Object.entries(KINDS).map(([v, l]) => `<option value="${v}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("");

// Simple line icons, drawn inline (no image requests, nothing for the CSP to block).
const ICON = {
  user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="M14 6l4 4"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 5l12 7-12 7V5Z"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  reply: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v5"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
};
const icon = (n, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

// What the first follow-up will look like, filled in with the owner's own details.
function samplePreview(s) {
  const t = s.templates?.estimate?.[0] || DEFAULT_TEMPLATES.estimate[0];
  const biz = s.business || "Your Business";
  const sign = s.signoff || s.business || "Your name, Your Business";
  const fill = (x) => esc(x.replace(/\{first_name\}/g, "Jane").replace(/\{job\}/g, "the kitchen remodel").replace(/\{business\}/g, biz).replace(/\{signoff\}/g, sign).replace(/\{amount_phrase\}|\{amount\}/g, ""));
  return `<div class="mail"><div class="mail-head"><span class="muted small">From</span> ${esc(biz)}<br><span class="muted small">Subject</span> ${fill(t.subject)}</div><div class="mail-body">${fill(t.body).split(/\n{2,}/).map((x) => `<p>${x.replace(/\n/g, "<br>")}</p>`).join("")}</div><p class="small muted mail-foot">${icon("reply", "ic sm")} If Jane replies, it lands in your inbox and the rest stop.</p></div>`;
}

function setupForm(base, acct) {
  const s = acct.settings;
  return `<div class="hello"><h1>Welcome! Let's get your Desk running.</h1><p class="muted">Three quick steps. Most people are done in about five minutes.</p>
<ol class="steps"><li class="on"><b>1</b>Your details</li><li><b>2</b>Add an estimate</li><li><b>3</b>Send yourself a preview</li></ol></div>
<div class="split"><div class="panel"><h2>${icon("user")} Your details</h2>
<p class="muted small">Follow-ups go out under your business name. Replies come straight to the email you enter here.</p>
<form method="post" action="${base}/setup">
<label for="business">Business name</label><input id="business" name="business" required maxlength="60" placeholder="Smith Roofing" value="${esc(s.business)}">
<label for="replyTo" class="mt">Where should replies go?</label><input id="replyTo" name="replyTo" type="email" required maxlength="254" value="${esc(s.replyTo)}">
<label for="signoff" class="mt">How do you sign your emails?</label><input id="signoff" name="signoff" required maxlength="80" placeholder="Pat, Smith Roofing" value="${esc(s.signoff)}">
<label for="timezone" class="mt">Your time zone</label><select id="timezone" name="timezone">${tzOptions(s.timezone)}</select>
<p class="small muted">Follow-ups go out on day ${s.days.map(Number).join(", ")} after you send an estimate, on weekday mornings. You can change the days and every word later.</p>
<button class="btn big" type="submit">Save and continue</button>
</form></div>
<div><p class="label-up">Here's what your customer will get</p>${samplePreview(s)}</div></div>`;
}

function gettingStarted(base, acct) {
  const steps = [
    { done: acct.setupDone, label: "Add your details", hint: "Business name, reply email, sign-off.", href: `${base}/settings` },
    { done: acct.items.length > 0, label: "Add your first estimate", hint: "One at a time, or paste a list.", href: "#add" },
    { done: Boolean(acct.previewSent), label: "Send yourself a preview", hint: "See exactly what your customers get, and reply to test it.", form: `${base}/test` },
    { done: Boolean(acct.messagesSeen), label: "Look over your messages (optional)", hint: "They're written for you. Change any word.", href: `${base}/settings` },
  ];
  const left = steps.filter((x) => !x.done).length;
  if (steps.slice(0, 3).every((x) => x.done)) return "";
  return `<div class="panel start"><h2>${icon("check")} Getting started <span class="muted small">${steps.length - left} of ${steps.length} done</span></h2><ul class="todo">${steps.map((x) => `<li class="${x.done ? "done" : ""}"><span class="tick">${x.done ? icon("check", "ic sm") : ""}</span><div><strong>${esc(x.label)}</strong><br><span class="muted small">${esc(x.hint)}</span></div>${x.done ? "" : x.form ? `<form method="post" action="${x.form}"><button class="btn sm" type="submit">Do it</button></form>` : `<a class="btn sm" href="${x.href}">Do it</a>`}</li>`).join("")}</ul>
<div class="how"><div>${icon("plus")}<span><b>You add</b> the estimates you've sent</span></div><div>${icon("send")}<span><b>We follow up</b> under your name, weekday mornings</span></div><div>${icon("reply")}<span><b>They reply</b>, it comes to you and the follow-ups stop</span></div></div></div>`;
}

function toolbar(base, acct, portalUrl) {
  const t = (href, ic, label) => `<a class="tool" href="${href}">${icon(ic)}<span>${label}</span></a>`;
  return `<nav class="tools" aria-label="Tools">${t("#add", "plus", "Add one")}${t("#paste", "list", "Paste a list")}${t("#list", "chart", "Your follow-ups")}${t(`${base}/settings`, "pen", "Your messages")}
<form method="post" action="${base}/test" class="tool-form"><button class="tool" type="submit">${icon("send")}<span>Send me a preview</span></button></form>
<form method="post" action="${base}/pause" class="tool-form"><input type="hidden" name="paused" value="${acct.paused ? "0" : "1"}"><button class="tool" type="submit">${icon(acct.paused ? "play" : "pause")}<span>${acct.paused ? "Resume" : "Pause"}</span></button></form>
${portalUrl ? t(esc(portalUrl), "card", "Billing") : ""}</nav>`;
}

function addForms(base) {
  const today = new Date().toISOString().slice(0, 10);
  return `<div class="split two">
<div class="panel" id="add"><h2>${icon("plus")} Add a follow-up</h2>
<form method="post" action="${base}/add">
<label for="a-name">Customer name</label><input id="a-name" name="name" maxlength="80" required placeholder="Jane Smith">
<label for="a-email" class="mt">Customer email</label><input id="a-email" name="email" type="email" maxlength="254" required placeholder="jane@example.com">
<label for="a-job" class="mt">What's the job?</label><input id="a-job" name="job" maxlength="100" placeholder="the kitchen remodel">
<span class="hint">Used in the message: "Just checking that the estimate for <em>the kitchen remodel</em> reached you."</span>
<div class="row mt"><div><label for="a-kind">Type</label><select id="a-kind" name="kind">${kindOptions()}</select></div>
<div><label for="a-date">Date you sent it</label><input id="a-date" name="date" type="date" value="${today}" max="${today}"></div></div>
<label for="a-amount" class="mt">Amount <span class="muted">(invoices only, optional)</span></label><input id="a-amount" name="amount" maxlength="20" inputmode="decimal" placeholder="$1,200">
<p class="mt"><button class="btn" type="submit">Add follow-up</button></p>
</form></div>
<div class="panel" id="paste"><h2>${icon("list")} Paste a list</h2>
<p class="muted small">Have a bunch? Copy rows from QuickBooks, Jobber or a spreadsheet and paste them here. We find the email column on our own and skip anyone already on your list.</p>
<form method="post" action="${base}/import">
<label for="i-kind">Type</label><select id="i-kind" name="kind">${kindOptions()}</select>
<label for="i-list" class="mt">Your list</label><textarea id="i-list" name="list" required placeholder="Jane Smith, jane@example.com, Kitchen remodel, 11/3/2026&#10;Bob Lee, bob@example.com, New roof, 11/4/2026"></textarea>
<span class="hint">One per line: name, email, job, date sent. Up to 1,000 at once.</span>
<p class="mt"><button class="btn" type="submit">Add list</button></p>
</form></div></div>`;
}

const STATUS = { open: "Open", replied: "Replied", won: "Won / paid", lost: "Lost", stopped: "Stopped", bounced: "Bad address", done: "Finished, no reply" };
const STATUS_CLS = { open: "", replied: "ok", won: "ok", lost: "", stopped: "", bounced: "warn", done: "" };

function itemRow(base, i, acct) {
  const tz = acct.settings.timezone;
  const due = nextDue(i, acct.settings.days);
  const step = `${i.step || 0} of 3 sent`;
  const next = i.status === "open" ? (due ? fmtDate(due, tz) : "-") : "";
  const act = (to, label, cls = "sm ghost") => `<form method="post" action="${base}/item"><input type="hidden" name="id" value="${esc(i.id)}"><input type="hidden" name="to" value="${to}"><button class="btn ${cls}" type="submit">${label}</button></form>`;
  const buttons = i.status === "open"
    ? act("won", i.kind === "invoice" ? "Paid" : "Won") + act("lost", "Lost", "sm warn") + act("stopped", "Stop", "sm warn")
    : ["stopped", "done", "lost"].includes(i.status) ? act("open", "Reopen", "sm warn") : "";
  return `<tr><td><strong>${esc(i.name || "(no name)")}</strong><br><span class="muted small">${esc(i.email)}</span></td><td class="hide-sm">${esc(KINDS[i.kind] || "")}${i.job ? `<br><span class="muted small">${esc(i.job)}</span>` : ""}</td><td><span class="tag ${STATUS_CLS[i.status] || ""}">${esc(STATUS[i.status] || i.status)}</span><br><span class="muted small">${esc(step)}${next ? ` · next ${esc(next)}` : ""}</span></td><td><div class="actions">${buttons}</div></td></tr>`;
}

export function dashboardPage({ acct, base, msg, portalUrl }) {
  const state = deskState(acct);
  const items = acct.items || [];
  const open = items.filter((i) => i.status === "open").sort((a, b) => (nextDue(a, acct.settings.days) || 0) - (nextDue(b, acct.settings.days) || 0));
  const closed = items.filter((i) => i.status !== "open").sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0)).slice(0, 50);
  const replied = items.filter((i) => i.repliedAt).length;
  const sent = items.reduce((n, i) => n + (i.sends || []).length, 0);
  const banner = !["active", "trialing"].includes(acct.billing)
    ? `<div class="note bad">Follow-ups are off because ${acct.billing === "canceled" ? "your subscription has ended" : "the last payment didn't go through"}. ${portalUrl ? `<a href="${esc(portalUrl)}">Manage billing</a>.` : "Reply to any NeonKey email for help."}</div>`
    : acct.paused ? `<div class="note warn">Paused. Nothing goes out until you press Resume.</div>` : "";
  if (!acct.setupDone) return page("Welcome", [header(acct), flash(msg), banner, setupForm(base, acct), footer()].join(""));
  const stat = (n, label, ic) => `<div class="stat">${icon(ic)}<div><b>${n}</b><span class="muted small">${label}</span></div></div>`;
  const table = (rows) => `<table><thead><tr><th>Customer</th><th class="hide-sm">Job</th><th>Status</th><th><span class="sr">Actions</span></th></tr></thead><tbody>${rows.map((i) => itemRow(base, i, acct)).join("")}</tbody></table>`;
  const body = [
    header(acct),
    flash(msg),
    banner,
    gettingStarted(base, acct),
    toolbar(base, acct, portalUrl),
    `<div class="stats">${stat(open.length, "open", "list")}${stat(sent, "follow-ups sent", "send")}${stat(replied, "replies", "reply")}${stat(items.filter((i) => i.status === "won").length, "won or paid", "check")}</div>`,
    state.label !== "Canceled" ? addForms(base) : "",
    `<div class="panel" id="list"><h2>${icon("chart")} Your follow-ups <span class="muted small">${open.length} open</span></h2>${open.length ? table(open) + `<p class="small muted">Got an answer some other way? Press Won, Lost or Stop so they don't get another email.</p>` : `<div class="empty">${icon("plus", "ic big")}<p><strong>Nothing open yet.</strong><br><span class="muted">Add an estimate you're waiting to hear back on, and the first follow-up goes out on its day.</span></p><a class="btn" href="#add">Add your first one</a></div>`}</div>`,
    closed.length ? `<div class="panel"><h2>Closed recently</h2>${table(closed)}<p class="small muted">Closed follow-ups are removed 90 days after they close.</p></div>` : "",
    `<p class="small muted">Follow-ups go out on weekday mornings (9 to noon your time), at most 60 a day. A reply, a bad address or a "stop" request ends that job's follow-ups on its own.</p>`,
    footer(),
  ].join("");
  return page("Dashboard", body);
}

const footer = () => `<p class="small muted foot">${icon("key", "ic sm")} This page's address is your login, so keep it to yourself. Lost it? <a href="/login">Get a new link</a>. Questions? <a href="mailto:hello@neonkey.tech">hello@neonkey.tech</a></p>`;

export function settingsPage({ acct, base, msg }) {
  const s = acct.settings;
  const tpl = (kind) => [0, 1, 2].map((k) => {
    const t = s.templates?.[kind]?.[k] || DEFAULT_TEMPLATES[kind][k];
    return `<div class="tpl"><label for="${kind}-s${k}">Follow-up ${k + 1} (day ${esc(s.days[k])}) subject</label><input id="${kind}-s${k}" name="${kind}_s${k}" maxlength="150" required value="${esc(t.subject)}">
<label for="${kind}-b${k}" style="margin-top:8px">Message</label><textarea id="${kind}-b${k}" name="${kind}_b${k}" maxlength="2000" required>${esc(t.body)}</textarea></div>`;
  }).join("");
  const body = [
    header(acct),
    flash(msg),
    `<p><a href="${base}">Back to dashboard</a></p>`,
    `<form method="post" action="${base}/settings">
<div class="panel"><h2>Your details</h2><div class="grid">
<div><label for="business">Business name (shown as the sender)</label><input id="business" name="business" required maxlength="60" value="${esc(s.business)}"></div>
<div><label for="replyTo">Where replies should go</label><input id="replyTo" name="replyTo" type="email" required maxlength="254" value="${esc(s.replyTo)}"></div>
<div><label for="signoff">How you sign off</label><input id="signoff" name="signoff" required maxlength="80" value="${esc(s.signoff)}"></div>
<div><label for="timezone">Your time zone</label><select id="timezone" name="timezone">${tzOptions(s.timezone)}</select></div>
</div>
<p style="margin:12px 0 0"><label><input type="checkbox" name="bccMe" value="1"${s.bccMe ? " checked" : ""}>Send me a copy of every follow-up</label></p></div>
<div class="panel"><h2>When follow-ups go out</h2><p class="small muted">Days after you sent the original. Three increasing numbers, 1 to 60.</p><div class="row">
${[0, 1, 2].map((k) => `<div><label for="d${k}">Follow-up ${k + 1}</label><input id="d${k}" name="d${k}" type="number" min="1" max="60" required value="${esc(s.days[k])}"></div>`).join("")}
</div></div>
<div class="panel"><h2>Your messages</h2><p class="small muted">These fill in on their own: <code>{first_name}</code> <code>{job}</code> <code>{signoff}</code> <code>{business}</code> <code>{amount}</code>. Keep them short and easy to say no to. A reply always stops the rest.</p>
${Object.entries(KINDS).map(([kind, label]) => `<details${kind === "estimate" ? " open" : ""} style="margin-top:12px"><summary>${esc(label)}</summary>${tpl(kind)}</details>`).join("")}
</div>
<p><button class="btn" type="submit">Save settings</button></p>
</form>
<form method="post" action="${base}/reset"><button class="btn warn" type="submit">Reset messages to the defaults</button></form>`,
  ].join("");
  return page("Settings", body);
}

export function loginPage(sent = false) {
  return page("Sign in", header(null) + `<div class="panel" style="max-width:520px"><h2>Get a link to your Desk</h2>
${sent ? `<p>If that email has a Follow-Up Desk, a new link is on its way. Check your inbox (and spam) in a minute or two.</p>` : `<p class="muted small">Enter the email you paid with. We'll email you a link that opens your dashboard. There's no password.</p>
<form method="post" action="/login"><label for="email">Email</label><input id="email" name="email" type="email" required maxlength="254"><p style="margin:12px 0 0"><button class="btn" type="submit">Email me a link</button></p></form>`}
</div><p class="small muted">Don't have one yet? <a href="https://neonkey.tech/follow-up-desk/">See the Follow-Up Desk</a>.</p>`);
}

export function unsubPage(business, done = false, action = "") {
  const name = esc(business || "this business");
  return page("Stop follow-ups", `<div class="panel" style="max-width:520px;margin-top:40px"><h2>${done ? "Done" : "Stop these follow-ups?"}</h2>
${done ? `<p>You won't get more follow-up emails from ${name} through this service. To reach them, reply to any of their emails.</p>` : `<p>You'll stop getting follow-up emails from ${name} about this job.</p><form method="post" action="${esc(action)}"><button class="btn" type="submit">Stop the emails</button></form>`}</div>`);
}

export function notFoundPage() {
  return page("Link not found", header(null) + `<div class="panel" style="max-width:520px"><h2>That link doesn't work</h2><p>It may be old or mistyped. <a href="/login">Get a new link</a> with the email you paid with.</p></div>`);
}
