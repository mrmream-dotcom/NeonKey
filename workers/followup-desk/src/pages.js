// The dashboard. Server-rendered HTML with plain forms: no JavaScript, no cookies, no inline scripts and no inline
// style attributes (the CSP is style-src 'self', so all styling lives in CSS below, served as /app.css).
// The link token in the URL is the login (see store.js). Every dynamic string goes through esc().
import { esc } from "./mail.js";
import { KINDS, TIMEZONES, ACTIONS, DAY, fmtDate, nextDue, DEFAULT_TEMPLATES } from "./engine.js";

export const CSS = `
:root{--bg:#0b0d17;--bg2:#11142a;--panel:#151935;--panel2:#1a1f40;--line:#262b52;--line2:#1f2347;--text:#e8eaf6;--muted:#b3b8d6;--faint:#9399bf;--cyan:#22d3ee;--violet:#a78bfa;--magenta:#f472b6;--green:#34d399;--amber:#fbbf24;--red:#f87171;--ink:#04121a;--r:12px;--font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;--mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;color-scheme:dark}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 var(--font);overflow-wrap:anywhere}
a{color:var(--cyan);text-underline-offset:3px}
:focus-visible{outline:3px solid var(--magenta);outline-offset:2px;border-radius:6px}
h1,h2,h3{letter-spacing:-.015em;line-height:1.2}
h1{font-size:1.75rem;margin:0}
h2{font-size:1.05rem;margin:0}
p{margin:0 0 12px}
code{font-family:var(--mono);font-size:.85em;background:var(--panel2);border:1px solid var(--line);padding:1px 6px;border-radius:6px}
.skip{position:absolute;left:-999px;top:8px;background:var(--cyan);color:var(--ink);padding:10px 14px;border-radius:8px;font-weight:700;z-index:10}
.skip:focus{left:8px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 16px}
main.wrap{padding-top:20px;padding-bottom:56px}
.muted{color:var(--muted)}.faint{color:var(--faint)}.small{font-size:.875rem}
.num{font-variant-numeric:tabular-nums}

/* top bar */
.bar{border-bottom:1px solid var(--line);background:var(--bg2)}
.bar-in{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px;flex-wrap:wrap;padding-top:8px;padding-bottom:8px}
.brand{display:flex;align-items:center;gap:10px;min-height:44px;color:var(--text);text-decoration:none;min-width:0}
.mark{width:30px;height:30px;flex:none;border-radius:8px}
.brand-name{font-weight:800;letter-spacing:-.02em;white-space:nowrap}.brand-name span{color:var(--cyan)}
.brand-sep{color:var(--line);font-weight:300}
.brand-prod{color:var(--muted);font-weight:600;white-space:nowrap}
.biz{color:var(--text);font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px}
.bar-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tabs{display:flex;gap:4px;border-top:1px solid var(--line2);margin-top:0}
.tabs a{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;color:var(--muted);text-decoration:none;font-weight:600;font-size:.94rem;border-bottom:2px solid transparent;margin-bottom:-1px}
.tabs a:hover{color:var(--text)}
.tabs a[aria-current=page]{color:var(--text);border-bottom-color:var(--cyan)}
.tabs .ext{margin-left:auto}

/* chips and tags */
.chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:.8rem;font-weight:700;border:1px solid var(--line);color:var(--muted);white-space:nowrap}
.chip::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.chip.plain::before{display:none}
.ok{color:var(--green)}.warn{color:var(--amber)}.bad{color:var(--red)}
.chip.ok{border-color:rgba(52,211,153,.45)}.chip.warn{border-color:rgba(251,191,36,.45)}.chip.bad{border-color:rgba(248,113,113,.5)}
.tag{display:inline-block;font-size:.78rem;font-weight:700;padding:1px 8px;border-radius:6px;border:1px solid var(--line);color:var(--muted);white-space:nowrap}
.tag.ok{border-color:rgba(52,211,153,.45)}.tag.warn{border-color:rgba(251,191,36,.45)}.tag.bad{border-color:rgba(248,113,113,.5)}.tag.cy{color:var(--cyan);border-color:rgba(34,211,238,.45)}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text);font:inherit;font-weight:700;font-size:.95rem;text-decoration:none;cursor:pointer;white-space:nowrap}
.btn:hover{border-color:var(--faint)}
.btn.primary{background:var(--cyan);border-color:var(--cyan);color:var(--ink)}
.btn.primary:hover{background:#67e8f9;border-color:#67e8f9}
.btn.quiet{background:transparent}
.btn.danger{background:transparent;color:var(--red);border-color:rgba(248,113,113,.5)}
.btn.sm{min-height:36px;padding:0 12px;font-size:.86rem;border-radius:8px}
.btn.block{width:100%}
.btn .ic{color:inherit}
form.inline{display:inline;margin:0}

/* page head */
.head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin:4px 0 20px}
.eyebrow{font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--violet);margin:0 0 6px}
.lede{color:var(--muted);margin:8px 0 0;max-width:62ch}
.head-cta{display:flex;gap:8px;flex-wrap:wrap}

/* layout */
.layout{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.col{display:grid;gap:16px;align-content:start;min-width:0}
@media (min-width:1000px){.layout{grid-template-columns:minmax(0,1fr) 360px;gap:20px}}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);min-width:0}
.card-h{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line2);flex-wrap:wrap}
.card-h h2{display:flex;align-items:center;gap:8px}
.card-b{padding:16px}
.count{font-size:.8rem;font-weight:700;color:var(--muted);background:var(--panel2);border:1px solid var(--line);border-radius:999px;padding:0 8px;font-variant-numeric:tabular-nums}
.count.hot{color:var(--ink);background:var(--cyan);border-color:var(--cyan)}
.card.focus{border-color:rgba(34,211,238,.55)}

/* notes */
.note{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-left:3px solid var(--cyan);background:var(--panel);border-radius:10px;padding:12px 14px;margin:0 0 16px}
.note.warn{border-left-color:var(--amber)}.note.bad{border-left-color:var(--red)}
.note .ic{margin-top:2px}
.note p{margin:0}

/* icons */
.ic{width:18px;height:18px;flex:none;color:var(--cyan)}.ic.sm{width:15px;height:15px}.ic.lg{width:28px;height:28px}
.note.warn .ic{color:var(--amber)}.note.bad .ic{color:var(--red)}

/* stats */
.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--line2);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
@media (min-width:640px){.stats{grid-template-columns:repeat(4,minmax(0,1fr))}}
.stat{background:var(--panel);padding:14px 16px}
.stat b{display:block;font-size:1.6rem;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.2}
.stat span{color:var(--muted);font-size:.86rem}

/* feed (attention, coming up) */
.feed{list-style:none;margin:0;padding:0}
.feed li{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-top:1px solid var(--line2)}
.feed li:first-child{border-top:0}
.feed .dot{flex:none;display:grid;place-items:center;width:32px;height:32px;border-radius:8px;background:var(--panel2);border:1px solid var(--line)}
.feed .dot.ok .ic{color:var(--green)}.feed .dot.warn .ic{color:var(--amber)}.feed .dot.bad .ic{color:var(--red)}
.feed .body{flex:1;min-width:0}
.feed .t{font-weight:700;margin:0}
.feed .d{color:var(--muted);font-size:.9rem;margin:2px 0 0}
.feed .acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.feed .when{flex:none;text-align:right;font-size:.86rem;color:var(--muted);font-variant-numeric:tabular-nums;min-width:64px}
.feed .when b{display:block;color:var(--text);font-size:.95rem}
.card-f{padding:12px 16px;border-top:1px solid var(--line2);font-size:.875rem;color:var(--muted)}
.card-f a{display:inline-flex;align-items:center;min-height:44px}

/* empty states */
.empty{padding:28px 20px;text-align:center}
.empty .ic.lg{margin:0 auto 8px;display:block}
.empty h3{margin:0 0 6px;font-size:1.05rem}
.empty p{color:var(--muted);max-width:46ch;margin:0 auto 14px}
.empty.compact{padding:20px 16px;text-align:left;display:flex;gap:12px;align-items:flex-start}
.empty.compact .ic{margin-top:2px;color:var(--green)}
.empty.compact p{margin:0;max-width:none}
.first{padding:24px 20px}
.first h2{font-size:1.25rem;margin:0 0 8px}
.first ol{margin:14px 0 18px;padding:0;list-style:none;display:grid;gap:10px;counter-reset:s}
.first li{counter-increment:s;display:flex;gap:10px;align-items:flex-start;color:var(--muted)}
.first li::before{content:counter(s);flex:none;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;border:1px solid var(--line);color:var(--text);font-size:.8rem;font-weight:700}
.first li b{color:var(--text)}

/* getting started */
.progress{height:6px;background:var(--panel2);border-radius:999px;overflow:hidden;margin:2px 16px 0}
.progress i{display:block;height:100%;background:var(--cyan);border-radius:999px}
.p0 i{width:4%}.p1 i{width:25%}.p2 i{width:50%}.p3 i{width:75%}.p4 i{width:100%}
.todo{list-style:none;margin:0;padding:8px 0 4px}
.todo li{display:flex;align-items:center;gap:12px;padding:10px 16px}
.todo li>div{flex:1;min-width:0}
.todo strong{display:block}
.tick{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;border:2px solid var(--line);flex:none}
.todo li.done .tick{background:var(--green);border-color:var(--green)}.todo li.done .tick .ic{color:var(--ink)}
.todo li.done strong{color:var(--muted);text-decoration:line-through}
.todo li.next .tick{border-color:var(--cyan)}
.todo form{margin:0}

/* forms */
label{display:block;font-size:.88rem;font-weight:600;color:var(--muted);margin:0 0 6px}
.field{margin:0 0 14px}
.field:last-child{margin-bottom:0}
input,select,textarea{width:100%;min-height:44px;background:var(--bg2);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font:inherit;font-size:16px}
input:hover,select:hover,textarea:hover{border-color:#353b6b}
input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--cyan);outline-offset:1px;border-color:var(--cyan)}
input::placeholder,textarea::placeholder{color:#7d84ad}
textarea{min-height:120px;resize:vertical;line-height:1.5}
.hint{display:block;font-size:.84rem;color:var(--faint);margin-top:6px}
.pair{display:grid;grid-template-columns:minmax(0,1fr);gap:0 12px}
@media (min-width:520px){.pair{grid-template-columns:1fr 1fr}}
.triple{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.check{display:flex;gap:12px;align-items:flex-start;min-height:44px;padding:10px 12px;margin:0 0 10px;border:1px solid var(--line);border-radius:10px;background:var(--bg2);color:var(--text);font-weight:500;font-size:.95rem;cursor:pointer}
.check input{width:20px;height:20px;min-height:0;margin:2px 0 0;flex:none;accent-color:var(--cyan)}
.check span small{display:block;color:var(--muted);font-size:.85rem;margin-top:2px}
details.more{border-top:1px solid var(--line2)}
details.more>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:52px;padding:0 16px;cursor:pointer;font-weight:700}
details.more>summary::-webkit-details-marker{display:none}
details.more>summary::after{content:"+";color:var(--cyan);font-size:1.3rem;font-weight:400}
details.more[open]>summary::after{content:"\\2212"}
details.more>.card-b{padding-top:0}

/* follow-up table: a table on wide screens, stacked cards on phones */
.tbl{width:100%;border-collapse:collapse;font-size:.92rem}
.tbl th{text-align:left;color:var(--faint);font-weight:600;font-size:.76rem;text-transform:uppercase;letter-spacing:.06em;padding:10px 16px;border-bottom:1px solid var(--line2)}
.tbl td{padding:12px 16px;border-bottom:1px solid var(--line2);vertical-align:top}
.tbl tr:last-child td{border-bottom:0}
.tbl .who strong{display:block}
.tbl .acts{display:flex;gap:6px;flex-wrap:nowrap;justify-content:flex-end}
.tbl .st .sub{white-space:nowrap}
.tbl .acts form{margin:0}
.sub{display:block;color:var(--muted);font-size:.86rem}
@media (max-width:759px){
  .tbl thead{display:none}
  .tbl,.tbl tbody,.tbl tr,.tbl td{display:block;width:100%}
  .tbl tr{padding:14px 16px;border-bottom:1px solid var(--line2)}
  .tbl tr:last-child{border-bottom:0}
  .tbl td{padding:0;border:0}
  .tbl td+td{margin-top:8px}
  .tbl .acts{justify-content:flex-start;margin-top:12px;flex-wrap:wrap}
  .btn.sm{min-height:44px;padding:0 16px}
  .tabs a{padding:0 10px}
  .biz{max-width:150px}
  .head .btn{width:100%}
  .head-cta{width:100%}
}

/* setup */
.steps{display:flex;gap:8px;flex-wrap:wrap;list-style:none;padding:0;margin:16px 0 0}
.steps li{display:flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:.88rem;background:var(--panel)}
.steps li b{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--panel2);border:1px solid var(--line);color:var(--text);font-size:.8rem}
.steps li.on{border-color:var(--cyan);color:var(--text)}.steps li.on b{background:var(--cyan);border-color:var(--cyan);color:var(--ink)}
.preview-label{font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--violet);margin:0 0 10px}
.mail{background:#fff;color:#1f2937;border-radius:var(--r);overflow:hidden;border:1px solid var(--line)}
.mail-head{padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:.92rem;display:grid;grid-template-columns:64px 1fr;gap:2px 8px}
.mail-head .k{color:#5b6472}
.mail-body{padding:14px 16px 4px;font-size:.95rem}.mail-body p{margin:0 0 12px}
.mail-foot{display:flex;gap:8px;align-items:flex-start;margin:0;padding:10px 16px;background:#f3f4f6;color:#374151;font-size:.88rem}.mail-foot .ic{color:#0e7490;margin-top:2px}

/* settings */
.sticky-save{margin-top:16px;padding:12px 16px;background:rgba(17,20,42,.96);border:1px solid var(--line);border-radius:var(--r);display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.sticky-save p{margin:0}
@media (max-width:759px){.sticky-save .btn{width:100%}}
@media (min-width:760px){.sticky-save{position:sticky;bottom:12px;z-index:2;box-shadow:0 8px 24px rgba(0,0,0,.35)}}
.tpl{padding:14px 0 0;margin-top:14px;border-top:1px solid var(--line2)}
.tpl:first-child{margin-top:0;border-top:0;padding-top:0}
.tpl h3{font-size:.95rem;margin:0 0 10px;color:var(--text)}
.danger-zone{margin-top:24px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:.9rem}
.back{display:inline-flex;align-items:center;gap:6px;min-height:44px;color:var(--muted);text-decoration:none;font-weight:600}
.back:hover{color:var(--text)}

/* account card */
.facts{list-style:none;margin:0;padding:4px 0}
.facts li{display:flex;justify-content:space-between;gap:12px;padding:8px 16px;font-size:.9rem}
.facts li span:first-child{color:var(--muted)}
.facts li span:last-child{text-align:right;min-width:0}
.btn-stack{display:grid;gap:8px;padding:12px 16px 16px}
.btn-stack form{margin:0}
.btn-stack .btn{width:100%;justify-content:flex-start}

/* small single-card pages */
.narrow{max-width:520px;margin:32px auto 0}
.narrow .card-b{padding:24px}
.narrow h1{font-size:1.4rem;margin:0 0 8px}
.rules{margin:24px 0 0}
.foot{margin-top:16px;padding-top:16px;border-top:1px solid var(--line2);font-size:.86rem;color:var(--muted);display:flex;gap:8px;align-items:flex-start}
.foot p{margin:0}
.foot a{display:inline-block;padding:10px 0;margin:-10px 0}

/* customer-facing pages (they belong to the owner's business, so light and plain) */
body.cust{--bg:#f6f7f9;--bg2:#ffffff;--panel:#ffffff;--panel2:#f3f4f6;--line:#d9dde3;--line2:#e5e7eb;--text:#1f2937;--muted:#4b5563;--faint:#5b6472;--cyan:#1f2937;--ink:#ffffff;color-scheme:light}
body.cust .card{box-shadow:0 1px 2px rgba(0,0,0,.04)}
body.cust .btn.primary{background:#1f2937;border-color:#1f2937;color:#fff}
body.cust .btn.primary:hover{background:#374151}
body.cust :focus-visible{outline-color:#2563eb}
body.cust input:focus-visible,body.cust textarea:focus-visible{outline-color:#2563eb;border-color:#2563eb}
body.cust input::placeholder,body.cust textarea::placeholder{color:#6b7280}
body.cust .cust-foot{margin-top:18px;font-size:.82rem;color:var(--muted);text-align:center}
.err{color:#b91c1c;font-weight:600}
`;

const MSGS = {
  saved: ["Saved.", ""],
  setup: ["Nice, you're set up. Next: add an estimate you're waiting to hear back on.", ""],
  added: ["Added. The first follow-up goes out on its date, on a weekday morning.", ""],
  dup: ["That email already has an open follow-up, so nothing was added.", "warn"],
  imported: ["List added.", ""],
  limit: ["You've reached 500 open follow-ups. Close some out before adding more.", "warn"],
  bad: ["Something in that form wasn't right. Check the fields and try again.", "bad"],
  bademail: ["That doesn't look like an email address.", "bad"],
  badpay: ["The payment link has to be a full https:// link.", "bad"],
  baddays: ["Follow-up days must be three increasing numbers between 1 and 60.", "bad"],
  updated: ["Updated. No more follow-ups for that job.", ""],
  reopened: ["Reopened. Follow-ups pick up where they left off.", ""],
  test: ["Preview sent to your inbox. Reply to it to see how a customer's reply comes back to you.", ""],
  testfail: ["The preview didn't send. Try again in a minute.", "bad"],
  paused: ["Paused. Nothing goes out until you resume.", "warn"],
  resumed: ["Running again.", ""],
  reset: ["Messages reset to the defaults.", ""],
};

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
  alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  stop: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-7Z"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
};
const icon = (n, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

// The NeonKey key mark (same drawing as the site favicon).
const MARK = '<svg class="mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="14" fill="#151935"/><g fill="none" stroke="#22d3ee" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="22" cy="32" r="10"/><path d="M32 32h22M46 32v8M52 32v6"/></g><circle cx="22" cy="32" r="3" fill="#f472b6"/></svg>';

function page(title, body, { cls = "", top = "" } = {}) {
  const scheme = cls === "cust" ? "light" : "dark";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="${scheme}"><title>${esc(title)} · NeonKey Follow-Up Desk</title><link rel="stylesheet" href="/app.css"></head><body${cls ? ` class="${cls}"` : ""}><a class="skip" href="#main">Skip to content</a>${top}<main id="main" class="wrap">${body}</main></body></html>`;
}

/** What the owner sees as the Desk's state. Display only: the cron decides sending with deskState(). */
export function statusChip(acct) {
  const s = deskState(acct);
  const trial = s.sending && acct.billing === "trialing";
  return { label: s.label, cls: s.cls, trial };
}

function topBar(acct, base, current, portalUrl) {
  const brand = `<a class="brand" href="${acct ? esc(base) : "/login"}"><span class="sr">NeonKey Follow-Up Desk${acct ? ", go to Today" : ""}</span>${MARK}<span class="brand-name" aria-hidden="true">Neon<span>Key</span></span><span class="brand-sep" aria-hidden="true">/</span><span class="brand-prod" aria-hidden="true">Follow-Up Desk</span></a>`;
  if (!acct) return `<header class="bar"><div class="wrap bar-in">${brand}</div></header>`;
  const chip = statusChip(acct);
  const right = `<div class="bar-right">${acct.settings?.business ? `<span class="biz">${esc(acct.settings.business)}</span>` : ""}${chip.trial ? `<span class="chip plain">Free trial</span>` : ""}<span class="chip ${chip.cls}"><span class="sr">Status: </span>${esc(chip.label)}</span></div>`;
  const tab = (href, label, key) => `<a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  const tabs = acct.setupDone
    ? `<nav class="wrap tabs" aria-label="Desk">${tab(esc(base), "Today", "today")}${tab(`${esc(base)}/settings`, "Messages &amp; settings", "settings")}${portalUrl ? `<a class="ext" href="${esc(portalUrl)}">${icon("card", "ic sm")}Billing</a>` : ""}</nav>`
    : "";
  return `<header class="bar"><div class="wrap bar-in">${brand}${right}</div>${tabs}</header>`;
}

export function deskState(acct) {
  if (!["active", "trialing"].includes(acct.billing)) return { label: acct.billing === "canceled" ? "Canceled" : "Billing needs attention", cls: "bad", sending: false };
  if (!acct.setupDone) return { label: "Setup needed", cls: "warn", sending: false };
  if (acct.paused) return { label: "Paused", cls: "warn", sending: false };
  return { label: "Running", cls: "ok", sending: true };
}

const flash = (code) => {
  const m = MSGS[code];
  if (!m) return "";
  const ic = m[1] === "bad" ? "alert" : m[1] === "warn" ? "alert" : "check";
  return `<div class="note ${m[1]}" role="${m[1] === "bad" ? "alert" : "status"}">${icon(ic)}<p>${esc(m[0])}</p></div>`;
};
const tzOptions = (cur) => TIMEZONES.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("");
const tzLabel = (tz) => (TIMEZONES.find(([v]) => v === tz) || [])[1] || "";
const kindOptions = (cur = "estimate") => Object.entries(KINDS).map(([v, l]) => `<option value="${v}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("");
function longDate(ms, tz) {
  try { return new Intl.DateTimeFormat("en-US", { timeZone: tz || "America/Chicago", weekday: "long", month: "long", day: "numeric" }).format(new Date(ms)); }
  catch { return ""; }
}
const safeDate = (ms, tz) => { try { return fmtDate(ms, tz); } catch { return fmtDate(ms); } };

// ---------- view model (pure, tested) ----------
export const ATTENTION_DAYS = 14;

/**
 * What needs the owner today: recent replies (still marked Replied), follow-ups a customer stopped, and bad
 * addresses. Each entry says why it's here. Nothing here changes data.
 */
export function attention(acct, now = Date.now()) {
  const since = now - ATTENTION_DAYS * DAY;
  const items = acct.items || [];
  const out = [];
  for (const i of items) {
    if (i.status === "replied" && (i.repliedAt || i.closedAt || 0) >= since) out.push({ type: "reply", at: i.repliedAt || i.closedAt, item: i });
    else if (i.status === "bounced" && (i.closedAt || 0) >= since) out.push({ type: "bounce", at: i.closedAt, item: i });
    else if (i.status === "stopped" && i.note && (i.closedAt || 0) >= since) out.push({ type: "stopped", at: i.closedAt, item: i });
  }
  const rank = { reply: 0, bounce: 1, stopped: 2 };
  return out.sort((a, b) => rank[a.type] - rank[b.type] || (b.at || 0) - (a.at || 0));
}

/** The next follow-ups due, soonest first. */
export function upcoming(acct, limit = 5) {
  const days = acct.settings?.days || [];
  return (acct.items || [])
    .filter((i) => i.status === "open")
    .map((i) => ({ item: i, due: nextDue(i, days) }))
    .filter((x) => x.due !== null)
    .sort((a, b) => a.due - b.due)
    .slice(0, limit);
}

/** One sentence for the top of the dashboard. */
export function todaySummary(acct, now = Date.now()) {
  const state = deskState(acct);
  const att = attention(acct, now);
  const replies = att.filter((a) => a.type === "reply").length;
  const other = att.length - replies;
  const open = (acct.items || []).filter((i) => i.status === "open").length;
  const parts = [];
  if (replies) parts.push(`${replies} ${replies === 1 ? "customer" : "customers"} replied`);
  if (other) parts.push(`${other} ${other === 1 ? "follow-up" : "follow-ups"} stopped or bounced`);
  let first = parts.length ? `${parts.join(" and ")}. Take a look below.` : "";
  if (!state.sending) {
    const why = state.label === "Paused" ? "You're paused, so nothing goes out." : state.label === "Canceled" ? "Your subscription has ended, so nothing goes out." : state.label === "Setup needed" ? "Finish setup to start sending." : "Sending is off until billing is fixed.";
    return [first, why].filter(Boolean).join(" ");
  }
  if (!open) return [first, (acct.items || []).length ? "Nothing is waiting on a follow-up. Add the next estimate you send." : "Add an estimate you're waiting to hear back on, and the Desk follows up for you."].filter(Boolean).join(" ");
  const next = upcoming(acct, 1)[0];
  const when = next.due <= now ? "the next weekday morning" : safeDate(next.due, acct.settings.timezone);
  const rest = `${open} ${open === 1 ? "job is" : "jobs are"} being followed up. Next one goes out ${when}.`;
  return first ? `${first} ${rest}` : `All clear. ${rest}`;
}

// What the first follow-up will look like, filled in with the owner's own details.
function samplePreview(s) {
  const t = s.templates?.estimate?.[0] || DEFAULT_TEMPLATES.estimate[0];
  const biz = s.business || "Your Business";
  const sign = s.signoff || s.business || "Your name, Your Business";
  const fill = (x) => esc(x.replace(/\{first_name\}/g, "Jane").replace(/\{job\}/g, "the kitchen remodel").replace(/\{business\}/g, biz).replace(/\{signoff\}/g, sign).replace(/\{amount_phrase\}|\{amount\}/g, ""));
  return `<div class="mail"><div class="mail-head"><span class="k">From</span><span>${esc(biz)}</span><span class="k">Subject</span><span>${fill(t.subject)}</span></div><div class="mail-body">${fill(t.body).split(/\n{2,}/).map((x) => `<p>${x.replace(/\n/g, "<br>")}</p>`).join("")}</div><p class="mail-foot">${icon("reply", "ic sm")}<span>If Jane replies, it lands in your inbox and the rest stop.</span></p></div>`;
}

function setupForm(base, acct) {
  const s = acct.settings;
  return `<div class="head"><div><p class="eyebrow">Step 1 of 3</p><h1>Welcome! Let's get your Desk running.</h1><p class="lede">Three quick steps. Most people are done in about five minutes. Nothing is sent to your customers until you add them.</p>
<ol class="steps" aria-label="Setup steps"><li class="on" aria-current="step"><b>1</b>Your details</li><li><b>2</b>Add an estimate</li><li><b>3</b>Send yourself a preview</li></ol></div></div>
<div class="layout"><section class="card" aria-labelledby="det-h"><div class="card-h"><h2 id="det-h">${icon("user")}Your details</h2></div><div class="card-b">
<p class="muted small">Follow-ups go out under your business name. Replies come straight to the email you enter here.</p>
<form method="post" action="${esc(base)}/setup">
<div class="field"><label for="business">Business name</label><input id="business" name="business" required maxlength="60" autocomplete="organization" placeholder="Smith Roofing" value="${esc(s.business)}"></div>
<div class="field"><label for="replyTo">Where should replies go?</label><input id="replyTo" name="replyTo" type="email" required maxlength="254" autocomplete="email" placeholder="you@yourbusiness.com" value="${esc(s.replyTo)}"></div>
<div class="field"><label for="signoff">How do you sign your emails?</label><input id="signoff" name="signoff" required maxlength="80" placeholder="Pat, Smith Roofing" value="${esc(s.signoff)}"></div>
<div class="field"><label for="timezone">Your time zone</label><select id="timezone" name="timezone">${tzOptions(s.timezone)}</select></div>
<p class="small muted">Follow-ups go out on day ${s.days.map((d) => esc(Number(d))).join(", ")} after you send an estimate, on weekday mornings. You can change the days and every word later.</p>
<button class="btn primary block" type="submit">Save and continue</button>
</form></div></section>
<aside aria-label="Example follow-up"><p class="preview-label">Here's what your customer will get</p>${samplePreview(s)}</aside></div>`;
}

function setupSteps(base, acct) {
  return [
    { done: acct.setupDone, label: "Add your details", hint: "Business name, reply email, sign-off.", href: `${esc(base)}/settings` },
    { done: (acct.items || []).length > 0, label: "Add your first estimate", hint: "One at a time, or paste a list.", href: "#add" },
    { done: Boolean(acct.previewSent), label: "Send yourself a preview", hint: "See exactly what your customers get, and reply to test it.", form: `${esc(base)}/test` },
    { done: Boolean(acct.messagesSeen), label: "Look over your messages (optional)", hint: "They're written for you. Change any word.", href: `${esc(base)}/settings` },
  ];
}

function gettingStarted(base, acct) {
  const steps = setupSteps(base, acct);
  if (steps.slice(0, 3).every((x) => x.done)) return "";
  const done = steps.filter((x) => x.done).length;
  const nextIdx = steps.findIndex((x) => !x.done);
  const li = (x, k) => `<li class="${x.done ? "done" : k === nextIdx ? "next" : ""}"><span class="tick">${x.done ? icon("check", "ic sm") : ""}</span><div><strong>${esc(x.label)}</strong><span class="sub">${esc(x.hint)}</span></div>${x.done ? `<span class="sr">Done</span>` : x.form ? `<form method="post" action="${x.form}"><button class="btn sm" type="submit">Send it</button></form>` : `<a class="btn sm" href="${x.href}">${k === 1 ? "Add" : "Open"}</a>`}</li>`;
  return `<section class="card focus" aria-labelledby="gs-h"><div class="card-h"><h2 id="gs-h">${icon("check")}Getting started</h2><span class="muted small">${done} of ${steps.length} done</span></div><div class="progress p${done}" aria-hidden="true"><i></i></div><ul class="todo">${steps.map(li).join("")}</ul></section>`;
}

const STATUS = { open: "Open", replied: "Replied", won: "Won / paid", lost: "Lost", stopped: "Stopped", bounced: "Bad address", done: "Finished, no reply" };
const STATUS_CLS = { open: "cy", replied: "ok", won: "ok", lost: "", stopped: "", bounced: "warn", done: "" };

const itemForm = (base, i, to, label, cls = "btn sm") => `<form method="post" action="${esc(base)}/item"><input type="hidden" name="id" value="${esc(i.id)}"><input type="hidden" name="to" value="${to}"><button class="${cls}" type="submit">${label}<span class="sr"> for ${esc(i.name || i.email)}</span></button></form>`;
const wonLabel = (i) => (i.kind === "invoice" ? "Paid" : "Won");

function attentionCard(base, acct, now) {
  const list = attention(acct, now);
  const tz = acct.settings.timezone;
  const row = ({ type, at, item: i }) => {
    const who = esc(i.name || i.email);
    const job = i.job ? ` · ${esc(i.job)}` : "";
    if (type === "reply") {
      const how = i.note ? esc(i.note) : `Their reply went to ${esc(acct.settings.replyTo || "your inbox")}.`;
      return `<li><span class="dot ok">${icon("reply")}</span><div class="body"><p class="t">${who} replied</p><p class="d">${how}${job}</p><p class="d">Follow-ups for this job have stopped. Answer them from your inbox, then mark how it went.</p><div class="acts">${itemForm(base, i, "won", wonLabel(i))}${itemForm(base, i, "lost", "Lost")}</div></div><div class="when">${esc(safeDate(at, tz))}</div></li>`;
    }
    if (type === "bounce") return `<li><span class="dot warn">${icon("alert")}</span><div class="body"><p class="t">Couldn't reach ${who}</p><p class="d">${esc(i.email)} didn't accept the email${job}. Check the address, then add them again with the right one.</p></div><div class="when">${esc(safeDate(at, tz))}</div></li>`;
    return `<li><span class="dot bad">${icon("stop")}</span><div class="body"><p class="t">Follow-ups stopped for ${who}</p><p class="d">${esc(i.note)}${job}. Nothing more goes to them about this job.</p></div><div class="when">${esc(safeDate(at, tz))}</div></li>`;
  };
  const replies = list.filter((x) => x.type === "reply").length;
  return `<section class="card" aria-labelledby="att-h"><div class="card-h"><h2 id="att-h">${icon("inbox")}Needs your attention</h2><span class="count${replies ? " hot" : ""}">${list.length}</span></div>${list.length
    ? `<ul class="feed">${list.map(row).join("")}</ul>`
    : `<div class="empty compact">${icon("check")}<p><strong>Nothing needs you right now.</strong><br><span class="muted small">When a customer replies, asks to stop, or an address bounces, it shows up here.</span></p></div>`}</section>`;
}

function upcomingCard(acct, now) {
  const list = upcoming(acct, 5);
  if (!list.length) return "";
  const tz = acct.settings.timezone;
  const state = deskState(acct);
  const row = ({ item: i, due }) => `<li><span class="dot">${icon("send")}</span><div class="body"><p class="t">${esc(i.name || i.email)}</p><p class="d">Follow-up ${Math.min((i.step || 0) + 1, 3)} of 3 · ${esc(KINDS[i.kind] || "")}${i.job ? ` · ${esc(i.job)}` : ""}</p></div><div class="when">${due <= now ? `<b>Due now</b>` : `<b>${esc(safeDate(due, tz))}</b>morning`}</div></li>`;
  const open = (acct.items || []).filter((i) => i.status === "open").length;
  return `<section class="card" aria-labelledby="up-h"><div class="card-h"><h2 id="up-h">${icon("clock")}Coming up</h2><span class="count">${open}</span></div>${state.sending ? "" : `<div class="note warn">${icon("pause")}<p>Nothing goes out while the Desk is ${state.label === "Paused" ? "paused" : "off"}. These dates move once it's running again.</p></div>`}<ul class="feed">${list.map(row).join("")}</ul>${open > list.length ? `<div class="card-f"><a href="#list">See all ${open} open follow-ups</a></div>` : ""}</section>`;
}

function firstRun(base) {
  return `<section class="card focus first" aria-labelledby="first-h"><h2 id="first-h">Your Desk is ready. Add the first estimate you're waiting on.</h2>
<p class="muted">Pick one you sent in the last week or two that hasn't had an answer yet.</p>
<ol><li><span><b>You add</b> the customer's name, email and the job.</span></li><li><span><b>The Desk follows up</b> under your name, on weekday mornings.</span></li><li><span><b>They reply</b>, it comes to your inbox, and the follow-ups stop.</span></li></ol>
<a class="btn primary" href="#add">${icon("plus")}Add your first estimate</a></section>`;
}

function itemRow(base, i, acct) {
  const tz = acct.settings.timezone;
  const due = nextDue(i, acct.settings.days);
  const step = `${i.step || 0} of 3 sent`;
  const next = i.status === "open" ? (due ? safeDate(due, tz) : "") : "";
  const buttons = i.status === "open"
    ? itemForm(base, i, "won", wonLabel(i)) + itemForm(base, i, "lost", "Lost") + itemForm(base, i, "stopped", "Stop")
    : i.status === "replied" ? itemForm(base, i, "won", wonLabel(i)) + itemForm(base, i, "lost", "Lost")
    : ["stopped", "done", "lost"].includes(i.status) ? itemForm(base, i, "open", "Reopen") : "";
  return `<tr><td class="who"><strong>${esc(i.name || "(no name)")}</strong><span class="sub">${esc(i.email)}</span></td><td>${esc(KINDS[i.kind] || "")}${i.job ? `<span class="sub">${esc(i.job)}</span>` : ""}</td><td class="st"><span class="tag ${STATUS_CLS[i.status] || ""}">${esc(STATUS[i.status] || i.status)}</span><span class="sub num">${esc(step)}${next ? ` · next ${esc(next)}` : ""}</span></td><td>${buttons ? `<div class="acts">${buttons}</div>` : ""}</td></tr>`;
}

function addForms(base) {
  const today = new Date().toISOString().slice(0, 10);
  return `<section class="card" id="add" aria-labelledby="add-h"><div class="card-h"><h2 id="add-h">${icon("plus")}Add a follow-up</h2></div><div class="card-b">
<form method="post" action="${esc(base)}/add">
<div class="field"><label for="a-name">Customer name</label><input id="a-name" name="name" maxlength="80" required autocomplete="off" placeholder="Jane Smith"></div>
<div class="field"><label for="a-email">Customer email</label><input id="a-email" name="email" type="email" maxlength="254" required autocomplete="off" placeholder="jane@example.com"></div>
<div class="field"><label for="a-job">What's the job?</label><input id="a-job" name="job" maxlength="100" placeholder="the kitchen remodel" aria-describedby="a-job-h"><span class="hint" id="a-job-h">Used in the message: "Just checking that the estimate for <em>the kitchen remodel</em> reached you."</span></div>
<div class="pair"><div class="field"><label for="a-kind">Type</label><select id="a-kind" name="kind">${kindOptions()}</select></div>
<div class="field"><label for="a-date">Date you sent it</label><input id="a-date" name="date" type="date" value="${today}" max="${today}"></div></div>
<div class="field"><label for="a-amount">Amount <span class="faint">(invoices only, optional)</span></label><input id="a-amount" name="amount" maxlength="20" inputmode="decimal" placeholder="$1,200"></div>
<button class="btn primary block" type="submit">Add follow-up</button>
</form></div>
<details class="more" id="paste"><summary>Paste a list instead</summary><div class="card-b">
<p class="muted small">Have a bunch? Copy rows from QuickBooks, Jobber or a spreadsheet and paste them here. The email column is found on its own, and anyone already on your list is skipped.</p>
<form method="post" action="${esc(base)}/import">
<div class="field"><label for="i-kind">Type</label><select id="i-kind" name="kind">${kindOptions()}</select></div>
<div class="field"><label for="i-list">Your list</label><textarea id="i-list" name="list" required aria-describedby="i-list-h" placeholder="Jane Smith, jane@example.com, Kitchen remodel, 11/3/2026&#10;Bob Lee, bob@example.com, New roof, 11/4/2026"></textarea><span class="hint" id="i-list-h">One per line: name, email, job, date sent. Up to 1,000 at once.</span></div>
<button class="btn block" type="submit">Add list</button>
</form></div></details></section>`;
}

function accountCard(base, acct, portalUrl) {
  const s = acct.settings;
  const chip = statusChip(acct);
  const canPause = acct.billing !== "canceled";
  return `<section class="card" id="account" aria-labelledby="acct-h"><div class="card-h"><h2 id="acct-h">${icon("key")}Your Desk</h2><span class="chip ${chip.cls}">${esc(chip.label)}</span></div>
<ul class="facts"><li><span>Sends</span><span>Weekday mornings, 9 to noon${tzLabel(s.timezone) ? ` ${esc(tzLabel(s.timezone))}` : ""}</span></li><li><span>Follow-up days</span><span class="num">${s.days.map((d) => esc(Number(d))).join(", ")}</span></li><li><span>Replies go to</span><span>${esc(s.replyTo)}</span></li>${chip.trial ? `<li><span>Plan</span><span>Free trial</span></li>` : ""}</ul>
<div class="btn-stack"><a class="btn quiet" href="${esc(base)}/settings">${icon("pen")}Edit your messages</a>
<form method="post" action="${esc(base)}/test"><button class="btn quiet" type="submit">${icon("send")}Send me a preview</button></form>
${canPause ? `<form method="post" action="${esc(base)}/pause"><input type="hidden" name="paused" value="${acct.paused ? "0" : "1"}"><button class="btn quiet" type="submit">${icon(acct.paused ? "play" : "pause")}${acct.paused ? "Resume follow-ups" : "Pause all follow-ups"}</button></form>` : ""}
${portalUrl ? `<a class="btn quiet" href="${esc(portalUrl)}">${icon("card")}Billing and cancel</a>` : ""}</div></section>`;
}

/** The single main action for the dashboard, depending on the account's state. */
export function primaryAction(acct, base, portalUrl) {
  const b = esc(base);
  if (!["active", "trialing"].includes(acct.billing)) {
    const label = acct.billing === "canceled" ? "Restart in Billing" : "Update payment";
    return portalUrl ? `<a class="btn primary" href="${esc(portalUrl)}">${icon("card")}${label}</a>` : `<a class="btn primary" href="mailto:hello@neonkey.tech">Email hello@neonkey.tech</a>`;
  }
  if (acct.paused) return `<form method="post" action="${b}/pause" class="inline"><input type="hidden" name="paused" value="0"><button class="btn primary" type="submit">${icon("play")}Resume follow-ups</button></form>`;
  return `<a class="btn primary" href="#add">${icon("plus")}Add a follow-up</a>`;
}

export function dashboardPage({ acct, base, msg, portalUrl, now = Date.now() }) {
  const items = acct.items || [];
  const open = items.filter((i) => i.status === "open").sort((a, b) => (nextDue(a, acct.settings.days) || 0) - (nextDue(b, acct.settings.days) || 0));
  const closed = items.filter((i) => i.status !== "open").sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0)).slice(0, 50);
  const replied = items.filter((i) => i.repliedAt).length;
  const sent = items.reduce((n, i) => n + (i.sends || []).length, 0);
  const banner = !["active", "trialing"].includes(acct.billing)
    ? `<div class="note bad" role="alert">${icon("alert")}<p>Follow-ups are off because ${acct.billing === "canceled" ? "your subscription has ended" : "the last payment didn't go through"}. ${portalUrl ? `<a href="${esc(portalUrl)}">Manage billing</a>.` : "Reply to any NeonKey email for help."}${acct.billing === "canceled" ? " Your list is kept for 30 days in case you come back." : ""}</p></div>`
    : acct.cancelScheduled ? `<div class="note warn">${icon("alert")}<p>Your subscription is set to end at the close of this billing period. Follow-ups keep going until then. Changed your mind? ${portalUrl ? `<a href="${esc(portalUrl)}">Turn it back on in Billing</a>` : "Reply to any NeonKey email"}. Just need a break? Pause holds every follow-up${acct.paused ? " (you're paused now)" : ""}.</p></div>`
    : acct.paused ? `<div class="note warn">${icon("pause")}<p>Paused. Nothing goes out until you press Resume.</p></div>` : "";
  if (!acct.setupDone) return page("Welcome", [flash(msg), banner, setupForm(base, acct), footer()].join(""), { top: topBar(acct, base, "today", portalUrl) });

  const canAdd = acct.billing !== "canceled";
  const firstTime = canAdd && !items.length && !acct.paused && ["active", "trialing"].includes(acct.billing);
  const stat = (n, label) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`;
  const table = (rows, caption) => `<table class="tbl"><caption class="sr">${caption}</caption><thead><tr><th scope="col">Customer</th><th scope="col">Job</th><th scope="col">Status</th><th scope="col"><span class="sr">Actions</span></th></tr></thead><tbody>${rows.map((i) => itemRow(base, i, acct)).join("")}</tbody></table>`;
  const head = `<div class="head"><div><p class="eyebrow">${esc(longDate(now, acct.settings.timezone))}</p><h1>Today</h1><p class="lede">${esc(todaySummary(acct, now))}</p></div>${firstTime ? "" : `<div class="head-cta">${primaryAction(acct, base, portalUrl)}</div>`}</div>`;
  const listCard = items.length
    ? `<section class="card" id="list" aria-labelledby="list-h"><div class="card-h"><h2 id="list-h">${icon("list")}Open follow-ups</h2><span class="count">${open.length}</span></div>${open.length
      ? table(open, "Open follow-ups") + `<div class="card-f">Got an answer some other way? Press Won, Lost or Stop so they don't get another email.</div>`
      : `<div class="empty"><h3>Nothing open right now.</h3><p>Every job has an answer or has finished. Add the next estimate you send and the Desk takes it from there.</p>${canAdd ? `<a class="btn" href="#add">${icon("plus")}Add a follow-up</a>` : ""}</div>`}
${closed.length ? `<details class="more"><summary><span>Closed recently <span class="count">${closed.length}</span></span></summary>${table(closed, "Closed recently")}<div class="card-f">Closed follow-ups are removed 90 days after they close.</div></details>` : ""}</section>`
    : "";
  const main = [
    firstTime ? firstRun(base) : "",
    gettingStarted(base, acct),
    items.length ? attentionCard(base, acct, now) : "",
    upcomingCard(acct, now),
    items.length ? `<section aria-label="Totals"><h2 class="sr">Totals</h2><div class="stats">${stat(open.length, "open")}${stat(sent, "follow-ups sent")}${stat(replied, "replies")}${stat(items.filter((i) => i.status === "won").length, "won or paid")}</div></section>` : "",
    listCard,
  ].join("");
  const side = [canAdd ? addForms(base) : "", accountCard(base, acct, portalUrl)].join("");
  const body = [
    flash(msg),
    banner,
    head,
    `<div class="layout"><div class="col">${main}</div><div class="col">${side}</div></div>`,
    `<p class="small muted rules">Follow-ups go out on weekday mornings (9 to noon your time), at most 60 a day. A reply, a bad address or a "stop" request ends that job's follow-ups on its own.</p>`,
    footer(),
  ].join("");
  return page("Today", body, { top: topBar(acct, base, "today", portalUrl) });
}

const footer = () => `<footer class="foot">${icon("key", "ic sm")}<p>This page's address is your login, so keep it to yourself. Lost it? <a href="/login">Get a new link</a>. Questions? <a href="mailto:hello@neonkey.tech">hello@neonkey.tech</a></p></footer>`;

export function settingsPage({ acct, base, msg, portalUrl = "" }) {
  const s = acct.settings;
  const tpl = (kind) => [0, 1, 2].map((k) => {
    const t = s.templates?.[kind]?.[k] || DEFAULT_TEMPLATES[kind][k];
    return `<div class="tpl"><h3>Follow-up ${k + 1} <span class="faint small">· day ${esc(s.days[k])}</span></h3><div class="field"><label for="${kind}-s${k}">Subject</label><input id="${kind}-s${k}" name="${kind}_s${k}" maxlength="150" required value="${esc(t.subject)}"></div>
<div class="field"><label for="${kind}-b${k}">Message</label><textarea id="${kind}-b${k}" name="${kind}_b${k}" maxlength="2000" required>${esc(t.body)}</textarea></div></div>`;
  }).join("");
  const body = [
    flash(msg),
    `<a class="back" href="${esc(base)}">${icon("back", "ic sm")}Back to Today</a>`,
    `<div class="head"><div><h1>Messages &amp; settings</h1><p class="lede">How your follow-ups read, when they go out, and where replies land.</p></div></div>`,
    `<form method="post" action="${esc(base)}/settings"><div class="col">
<section class="card" aria-labelledby="s-det"><div class="card-h"><h2 id="s-det">${icon("user")}Your details</h2></div><div class="card-b"><div class="pair">
<div class="field"><label for="business">Business name (shown as the sender)</label><input id="business" name="business" required maxlength="60" autocomplete="organization" value="${esc(s.business)}"></div>
<div class="field"><label for="replyTo">Where replies should go</label><input id="replyTo" name="replyTo" type="email" required maxlength="254" autocomplete="email" value="${esc(s.replyTo)}"></div>
<div class="field"><label for="signoff">How you sign off</label><input id="signoff" name="signoff" required maxlength="80" value="${esc(s.signoff)}"></div>
<div class="field"><label for="timezone">Your time zone</label><select id="timezone" name="timezone">${tzOptions(s.timezone)}</select></div>
</div>
<label class="check"><input type="checkbox" name="bccMe" value="1"${s.bccMe ? " checked" : ""}><span>Send me a copy of every follow-up</span></label></div></section>
<section class="card" aria-labelledby="s-btn"><div class="card-h"><h2 id="s-btn">${icon("reply")}Buttons in your follow-ups</h2></div><div class="card-b">
<label class="check"><input type="checkbox" name="buttons" value="1"${s.buttons !== false ? " checked" : ""}><span>Add "Yes, let's go ahead" and "I have a question" buttons<small>One tap tells you right away and stops that job's follow-ups.</small></span></label>
<div class="field"><label for="payUrl">Payment link (optional)</label><input id="payUrl" name="payUrl" type="url" maxlength="500" placeholder="https://..." aria-describedby="payUrl-h" value="${esc(s.payUrl || "")}"><span class="hint" id="payUrl-h">Paste a link from Stripe, Square, PayPal or your invoicing app. Estimates get a "Pay the deposit" button and unpaid invoices get "Pay the invoice". Money goes straight to you.</span></div></div></section>
<section class="card" aria-labelledby="s-days"><div class="card-h"><h2 id="s-days">${icon("clock")}When follow-ups go out</h2></div><div class="card-b"><p class="small muted">Days after you sent the original. Three increasing numbers, 1 to 60.</p><div class="triple">
${[0, 1, 2].map((k) => `<div class="field"><label for="d${k}">Follow-up ${k + 1}</label><input id="d${k}" name="d${k}" type="number" inputmode="numeric" min="1" max="60" required value="${esc(s.days[k])}"></div>`).join("")}
</div></div></section>
<section class="card" aria-labelledby="s-msg"><div class="card-h"><h2 id="s-msg">${icon("pen")}Your messages</h2></div><div class="card-b"><p class="small muted">These fill in on their own: <code>{first_name}</code> <code>{job}</code> <code>{signoff}</code> <code>{business}</code> <code>{amount}</code>. Keep them short and easy to say no to. A reply always stops the rest.</p></div>
${Object.entries(KINDS).map(([kind, label]) => `<details class="more"${kind === "estimate" ? " open" : ""}><summary>${esc(label)}</summary><div class="card-b">${tpl(kind)}</div></details>`).join("")}
</section></div>
<div class="sticky-save"><p class="small muted">Changes apply to the next follow-up that goes out.</p><button class="btn primary" type="submit">Save settings</button></div>
</form>
<div class="danger-zone"><span>Want the original wording back?</span><form method="post" action="${esc(base)}/reset"><button class="btn danger sm" type="submit">Reset messages to the defaults</button></form></div>`,
    footer(),
  ].join("");
  return page("Settings", body, { top: topBar(acct, base, "settings", portalUrl) });
}

export function loginPage(sent = false) {
  return page("Sign in", `<div class="narrow"><section class="card"><div class="card-b"><h1>${sent ? "Check your inbox" : "Get a link to your Desk"}</h1>
${sent ? `<p role="status">If that email has a Follow-Up Desk, a new link is on its way. Check your inbox (and spam) in a minute or two.</p>` : `<p class="muted">Enter the email you paid with. We'll email you a link that opens your dashboard. There's no password.</p>
<form method="post" action="/login"><div class="field"><label for="email">Email</label><input id="email" name="email" type="email" required maxlength="254" autocomplete="email"></div><button class="btn primary block" type="submit">Email me a link</button></form>`}
</div></section><p class="small muted">Don't have one yet? <a href="https://neonkey.tech/follow-up-desk/">See the Follow-Up Desk</a>.</p></div>`, { top: topBar(null) });
}

export function unsubPage(business, done = false, action = "") {
  const name = esc(business || "this business");
  return page("Stop follow-ups", `<div class="narrow"><section class="card"><div class="card-b"><h1>${done ? "Done" : "Stop these follow-ups?"}</h1>
${done ? `<p>You won't get more follow-up emails from ${name} through this service. To reach them, reply to any of their emails.</p>` : `<p>You'll stop getting follow-up emails from ${name} about this job.</p><form method="post" action="${esc(action)}"><button class="btn primary block" type="submit">Stop the emails</button></form>`}</div></section></div>`, { cls: "cust" });
}

export function notFoundPage() {
  return page("Link not found", `<div class="narrow"><section class="card"><div class="card-b"><h1>That link doesn't work</h1><p class="muted">It may be old or mistyped. Dashboard links can be replaced any time with the email you paid with.</p><a class="btn primary block" href="/login">Get a new link</a></div></section></div>`, { top: topBar(null) });
}

// The customer's side of the one-tap buttons. Light and plain: it belongs to the owner's business, not to NeonKey.
export function actionPage({ business, item, action, path, done = false, error = "" }) {
  const name = esc(business || "the business");
  const labels = ACTIONS[item.kind] || ACTIONS.estimate;
  const job = item.job ? esc(item.job) : "";
  const foot = `<p class="cust-foot">Sent through NeonKey Follow-Up Desk for ${name}.</p>`;
  if (done) {
    return page("Sent", `<div class="narrow"><section class="card"><div class="card-b"><h1>Thanks, it's sent</h1><p>${name} has your message and will get back to you. You won't get more follow-up emails about ${job || "this"}.</p></div></section>${foot}</div>`, { cls: "cust" });
  }
  const yes = action === "yes";
  const title = yes ? (labels.yes || "Yes") : "Ask a question";
  const intro = yes
    ? `Let ${name} know you'd like to go ahead${job ? ` with <strong>${job}</strong>` : ""}. They'll reach out to set things up.`
    : `Send your question to ${name}${job ? ` about <strong>${job}</strong>` : ""}. They'll reply by email.`;
  return page(title, `<div class="narrow"><section class="card"><div class="card-b"><h1>${esc(title)}</h1><p>${intro}</p>
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
<form method="post" action="${esc(path)}">
<div class="field"><label for="note">${yes ? "Anything they should know? (optional)" : "Your question"}</label><textarea id="note" name="note" maxlength="1000"${yes ? "" : " required"}></textarea></div>
${yes ? `<div class="field"><label for="phone">Best phone number (optional)</label><input id="phone" name="phone" type="tel" maxlength="30" autocomplete="tel"></div>` : ""}
<button class="btn primary block" type="submit">${yes ? `Send to ${name}` : "Send my question"}</button>
</form></div></section>${foot}</div>`, { cls: "cust" });
}
