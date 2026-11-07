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
@media (max-width:640px){.hide-sm{display:none}th,td{padding:8px 4px}}
`;

const MSGS = {
  saved: ["Saved.", ""],
  setup: ["You're set up. Add your first estimate below.", ""],
  added: ["Added. The first follow-up goes out on its date, on a weekday morning.", ""],
  dup: ["That email already has an open follow-up, so nothing was added.", "warn"],
  imported: ["List added.", ""],
  limit: ["You've reached 500 open follow-ups. Close some out before adding more.", "warn"],
  bad: ["Something in that form wasn't right. Check the highlighted fields and try again.", "bad"],
  bademail: ["That doesn't look like an email address.", "bad"],
  baddays: ["Follow-up days must be three increasing numbers between 1 and 60.", "bad"],
  updated: ["Updated. No more follow-ups for that job.", ""],
  reopened: ["Reopened. Follow-ups pick up where they left off.", ""],
  test: ["Preview sent to your reply-to email. Reply to it to see how a customer reply reaches you.", ""],
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

function setupForm(base, acct) {
  const s = acct.settings;
  return `<div class="panel"><h2>Set up your Desk (about two minutes)</h2>
<p class="muted small">Your follow-ups go out under your business name. When a customer replies, the reply comes straight to the email below and that job's follow-ups stop.</p>
<form method="post" action="${base}/setup">
<div class="grid">
<div><label for="business">Business name (shown as the sender)</label><input id="business" name="business" required maxlength="60" value="${esc(s.business)}"></div>
<div><label for="replyTo">Where replies should go</label><input id="replyTo" name="replyTo" type="email" required maxlength="254" value="${esc(s.replyTo)}"></div>
<div><label for="signoff">How you sign off</label><input id="signoff" name="signoff" required maxlength="80" placeholder="Jane, Smith Roofing" value="${esc(s.signoff)}"></div>
<div><label for="timezone">Your time zone</label><select id="timezone" name="timezone">${tzOptions(s.timezone)}</select></div>
</div>
<p class="small muted">Follow-ups go out on day ${s.days.map(Number).join(", ")} after you sent the estimate, on weekday mornings between 9 and noon your time. You can change the days and the wording in Settings any time.</p>
<button class="btn" type="submit">Save and start</button>
</form></div>`;
}

function addForms(base) {
  const today = new Date().toISOString().slice(0, 10);
  return `<div class="panel"><h2>Add a follow-up</h2>
<form method="post" action="${base}/add">
<div class="row">
<div><label for="a-name">Customer name</label><input id="a-name" name="name" maxlength="80" required></div>
<div><label for="a-email">Customer email</label><input id="a-email" name="email" type="email" maxlength="254" required></div>
<div><label for="a-kind">Type</label><select id="a-kind" name="kind">${kindOptions()}</select></div>
</div>
<div class="row" style="margin-top:10px">
<div><label for="a-job">Job (used in the message, like "the kitchen remodel")</label><input id="a-job" name="job" maxlength="100"></div>
<div><label for="a-amount">Amount (optional, invoices only)</label><input id="a-amount" name="amount" maxlength="20" inputmode="decimal"></div>
<div><label for="a-date">Date you sent it</label><input id="a-date" name="date" type="date" value="${today}" max="${today}"></div>
</div>
<p style="margin:12px 0 0"><button class="btn" type="submit">Add</button></p>
</form>
<details style="margin-top:16px"><summary>Paste a list instead</summary>
<form method="post" action="${base}/import" style="margin-top:10px">
<p class="small muted">Paste a CSV export (QuickBooks "Estimates by Customer", Jobber, or a spreadsheet) or one per line: <code>Name, email, job, date sent</code>. We find the email column on our own. Rows without an email, and emails that already have an open follow-up, are skipped. Up to 1,000 rows.</p>
<div class="row"><div style="flex:0 1 220px"><label for="i-kind">Type</label><select id="i-kind" name="kind">${kindOptions()}</select></div></div>
<label for="i-list" style="margin-top:10px">List</label><textarea id="i-list" name="list" required placeholder="Jane Smith, jane@example.com, Kitchen remodel, 11/3/2026"></textarea>
<p style="margin:12px 0 0"><button class="btn" type="submit">Add list</button></p>
</form></details></div>`;
}

const STATUS = { open: "Open", replied: "Replied", won: "Won / paid", lost: "Lost", stopped: "Stopped", bounced: "Bad address", done: "Finished, no reply" };

function itemRow(base, i, acct) {
  const tz = acct.settings.timezone;
  const due = nextDue(i, acct.settings.days);
  const step = `${i.step || 0} of 3 sent`;
  const next = i.status === "open" ? (due ? fmtDate(due, tz) : "-") : "";
  const act = (to, label, cls = "sm ghost") => `<form method="post" action="${base}/item"><input type="hidden" name="id" value="${esc(i.id)}"><input type="hidden" name="to" value="${to}"><button class="btn ${cls}" type="submit">${label}</button></form>`;
  const buttons = i.status === "open"
    ? act("won", i.kind === "invoice" ? "Paid" : "Won") + act("lost", "Lost", "sm warn") + act("stopped", "Stop", "sm warn")
    : ["stopped", "done", "lost"].includes(i.status) ? act("open", "Reopen", "sm warn") : "";
  return `<tr><td><strong>${esc(i.name || "(no name)")}</strong><br><span class="muted small">${esc(i.email)}</span></td><td class="hide-sm">${esc(KINDS[i.kind] || "")}${i.job ? `<br><span class="muted small">${esc(i.job)}</span>` : ""}</td><td>${esc(STATUS[i.status] || i.status)}<br><span class="muted small">${esc(step)}${next ? ` · next ${esc(next)}` : ""}</span></td><td><div class="actions">${buttons}</div></td></tr>`;
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
    : acct.paused ? `<div class="note warn">Paused. Nothing goes out until you resume.</div>` : "";
  const body = [
    header(acct),
    flash(msg),
    banner,
    !acct.setupDone ? setupForm(base, acct) : "",
    acct.setupDone ? `<div class="stats"><div class="stat"><b>${open.length}</b><span class="muted small">open</span></div><div class="stat"><b>${sent}</b><span class="muted small">follow-ups sent</span></div><div class="stat"><b>${replied}</b><span class="muted small">replies</span></div><div class="stat"><b>${items.filter((i) => i.status === "won").length}</b><span class="muted small">won or paid</span></div></div>` : "",
    acct.setupDone && state.label !== "Canceled" ? addForms(base) : "",
    acct.setupDone ? `<div class="panel"><h2>Open (${open.length})</h2>${open.length ? `<table><thead><tr><th>Customer</th><th class="hide-sm">Job</th><th>Status</th><th></th></tr></thead><tbody>${open.map((i) => itemRow(base, i, acct)).join("")}</tbody></table>` : `<p class="muted">Nothing open. Add the estimates you're waiting on above.</p>`}</div>` : "",
    closed.length ? `<div class="panel"><h2>Closed recently</h2><table><thead><tr><th>Customer</th><th class="hide-sm">Job</th><th>Status</th><th></th></tr></thead><tbody>${closed.map((i) => itemRow(base, i, acct)).join("")}</tbody></table><p class="small muted">Closed follow-ups are removed 90 days after they close.</p></div>` : "",
    acct.setupDone ? `<div class="panel"><h2>Controls</h2><div class="actions">
<a class="btn ghost" href="${base}/settings">Settings and messages</a>
<form method="post" action="${base}/test"><button class="btn ghost" type="submit">Send me a preview</button></form>
<form method="post" action="${base}/pause"><input type="hidden" name="paused" value="${acct.paused ? "0" : "1"}"><button class="btn warn" type="submit">${acct.paused ? "Resume" : "Pause everything"}</button></form>
${portalUrl ? `<a class="btn warn" href="${esc(portalUrl)}" rel="noopener">Billing and cancel</a>` : ""}
</div><p class="small muted" style="margin-top:12px">Follow-ups go out on weekday mornings (9 to noon your time), at most 60 a day. A customer reply, a bad address, or a "stop" request ends that job's follow-ups on its own.</p></div>` : "",
    `<p class="small muted">This page's address is your login. Don't share it. Lost it? <a href="/login">Get a new link</a>. Questions: <a href="mailto:hello@neonkey.tech">hello@neonkey.tech</a></p>`,
  ].join("");
  return page("Dashboard", body);
}

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
