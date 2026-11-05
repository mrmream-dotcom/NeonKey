// Branded Email Lockdown report: a standalone, printable HTML document (Letter size) the buyer keeps for reference.
// renderReport({ a, order }) -> HTML string. `a` is the audit() result, `order` has id, name, business, email, created.
import { esc } from "./email.js";
import { sendersIn } from "./audit.js";

const STATUS = {
  ok: { label: "Passing", color: "#34d399", bg: "rgba(52,211,153,.12)" },
  fix: { label: "Needs a change", color: "#fbbf24", bg: "rgba(251,191,36,.12)" },
  missing: { label: "Missing", color: "#f472b6", bg: "rgba(244,114,182,.12)" },
  unverified: { label: "Not verified", color: "#fbbf24", bg: "rgba(251,191,36,.12)" },
  review: { label: "Under review", color: "#a78bfa", bg: "rgba(167,139,250,.14)" },
};

export function checks(a) {
  const fix = (id) => a.fixes.find((f) => f.id === id);
  const flagged = (re) => a.human.some((h) => re.test(h));
  const spfRec = a.spf?.records?.[0];
  const dmarcRec = a.dmarc?.records?.[0];
  return [
    {
      key: "MX", name: "Mail server", what: "Where your email is delivered.",
      status: a.mx.length ? "ok" : "missing",
      detail: a.mx.length ? `${a.provider?.label || "Email host"} (${a.mx[0]}${a.mx.length > 1 ? ` +${a.mx.length - 1}` : ""})` : "No mail server found",
    },
    {
      key: "SPF", name: "Approved senders", what: "The public list of services allowed to send email as you.",
      status: flagged(/SPF/) ? "review" : fix("spf") ? (fix("spf").action === "add" ? "missing" : "fix") : spfRec ? "ok" : "missing",
      detail: spfRec ? `${spfRec}${(a.senders || sendersIn(spfRec)).length ? `\nAllows: ${(a.senders || sendersIn(spfRec)).join(", ")}` : ""}` : "No SPF record",
    },
    {
      key: "DKIM", name: "Digital signature", what: "A signature that proves a message really came from you.",
      status: a.dkim.length ? "ok" : a.buyerSteps.some((s) => s.id === "dkim") ? "unverified" : "review",
      detail: a.dkim.length ? `Key found: ${a.dkim.join(", ")}` : `Couldn't verify a key at the names ${a.provider?.label || "your provider"} normally uses. It may be off, or set up under a custom name.`,
    },
    {
      key: "DMARC", name: "Spoofing policy", what: "Tells inboxes what to do with mail that fakes your address.",
      status: flagged(/DMARC/) ? "review" : fix("dmarc") ? (fix("dmarc").action === "add" ? "missing" : "fix") : dmarcRec ? "ok" : "missing",
      detail: dmarcRec ? `${dmarcRec}${a.dmarc.policy === "none" ? " \nMonitor mode: reports fakes, not blocking yet" : ""}` : "No DMARC record",
    },
  ];
}

const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Anchorage" });

export function renderReport({ a, order = {}, sample = false }) {
  const cs = checks(a);
  const passing = cs.filter((c) => c.status === "ok").length;
  const pct = Math.round((passing / cs.length) * 100);
  const steps = [...a.fixes.map((f) => ({ kind: "record", f })), ...a.buyerSteps.map((s) => ({ kind: "click", s }))];
  const before = Number.isInteger(order.before) && order.before !== passing ? order.before : null;
  const showFull = sample ? 1 : steps.length; // the public sample shows step 1 only
  const ref = `NK-EL-${String(order.id || "SAMPLE").replace(/^cs_(live|test)_/, "").slice(-8).toUpperCase()}`;
  const who = [order.name, order.business].filter(Boolean).join(", ") || order.email || "";
  const verdict = a.locked ? "Protected" : passing >= 3 ? "Almost there" : "Needs attention";
  const verdictColor = a.locked ? "#34d399" : passing >= 3 ? "#fbbf24" : "#f472b6";
  const R = 46, C = 2 * Math.PI * R, dash = (C * pct) / 100;

  const tile = (c) => {
    const s = STATUS[c.status];
    return `<div class="tile"><div class="tile-top"><span class="k">${c.key}</span><span class="pill" style="color:${s.color};background:${s.bg};border-color:${s.color}55">${s.label}</span></div>
<div class="tn">${esc(c.name)}</div><div class="tw">${esc(c.what)}</div><div class="td">${esc(c.detail)}</div></div>`;
  };

  const stepHtml = (st, i) => {
    if (st.kind === "record") {
      const f = st.f;
      return `<div class="step"><div class="num">${i + 1}</div><div class="sb">
<div class="st">${f.action === "replace" ? "Edit" : "Add"} your ${f.id.toUpperCase()} record</div><p class="sw">${esc(f.why)}</p>
<table class="rec"><tr><th>Type</th><td>${f.type}</td></tr><tr><th>Name / Host</th><td class="mono">${esc(f.host)}</td></tr>
${f.current ? `<tr><th>Current</th><td class="mono old">${esc(f.current)}</td></tr>` : ""}<tr><th>${f.current ? "New value" : "Value"}</th><td class="mono new">${esc(f.value)}</td></tr><tr><th>TTL</th><td>Default (or 1 hour)</td></tr></table></div></div>`;
    }
    const s = st.s;
    return `<div class="step"><div class="num v">${i + 1}</div><div class="sb"><div class="st">${esc(s.title)}</div><p class="sw">${esc(s.text)}</p><p class="sw"><a href="${esc(s.help)}">Official guide</a></p></div></div>`;
  };

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Email Security Report · ${esc(a.domain)} · NeonKey</title>
<style>
:root{--bg:#0b0d17;--panel:#151935;--line:#262b52;--text:#e8eaf6;--muted:#b3b8d6;--cyan:#22d3ee;--violet:#a78bfa;--magenta:#f472b6;--amber:#fbbf24;--green:#34d399}
@page{size:letter;margin:0}
*{box-sizing:border-box}
body{margin:0;background:#1d2033;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--text);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:8.5in;min-height:11in;margin:24px auto;background:var(--bg);position:relative;overflow:hidden}
.grad{height:6px;background:linear-gradient(90deg,var(--cyan),var(--violet),var(--magenta))}
.in{padding:30px 44px 40px}
.top{display:flex;justify-content:space-between;align-items:center}.top img{height:36px}
.meta{text-align:right;font-size:11px;color:var(--muted);letter-spacing:.5px;line-height:1.6}.meta b{color:var(--text);font-weight:600}
.eyebrow{margin:26px 0 2px;color:var(--cyan);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
h1{margin:0;font-size:30px;line-height:1.15;letter-spacing:-.3px}h1 span{color:var(--magenta)}
.sub{color:var(--muted);margin:6px 0 0}
.hero{display:grid;grid-template-columns:150px 1fr;gap:24px;align-items:center;margin:22px 0 18px;padding:18px 22px;background:var(--panel);border:1px solid var(--line);border-radius:14px}
.ring{position:relative;width:130px;height:130px}.ring svg{transform:rotate(-90deg)}
.ring .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ring .n{font-size:30px;font-weight:800}.ring .l{font-size:10px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase}
.verdict{font-size:22px;font-weight:800;margin:0 0 4px}
.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
.fact{border-left:2px solid var(--line);padding-left:10px}.fact .fl{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted)}.fact .fv{font-weight:600;font-size:13px}
.h2{margin:22px 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--violet)}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.tile-top{display:flex;justify-content:space-between;align-items:center}.k{font-weight:800;letter-spacing:1px;color:var(--cyan);font-size:13px}
.pill{font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;border:1px solid}
.tn{font-weight:700;margin-top:6px}.tw{color:var(--muted);font-size:12.5px}.td{white-space:pre-line;margin-top:6px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#cfd3f0;word-break:break-all}
.step{display:grid;grid-template-columns:34px 1fr;gap:12px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:10px;break-inside:avoid}
.num{width:28px;height:28px;border-radius:50%;background:var(--cyan);color:var(--bg);font-weight:800;display:flex;align-items:center;justify-content:center}.num.v{background:var(--violet)}
.st{font-weight:700;font-size:15px}.sw{margin:3px 0 6px;color:var(--muted);font-size:13px}.sw a{color:var(--cyan);font-weight:700;text-decoration:none}
.rec{border-collapse:collapse;width:100%;font-size:12.5px}.rec th{text-align:left;color:var(--muted);font-weight:500;padding:3px 12px 3px 0;width:96px;vertical-align:top}.rec td{padding:3px 0;word-break:break-all}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.old{color:#8f94b8;text-decoration:line-through}.new{color:var(--green)}
.where{color:var(--muted);font-size:13px;margin:0 0 10px}.where a{color:var(--cyan);font-weight:700;text-decoration:none}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.box{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:13px;color:var(--muted)}.box b{color:var(--text)}
.box ul{margin:6px 0 0;padding-left:16px}
.credit{border-left:3px solid var(--magenta)}
.review{border-left:3px solid var(--violet)}
.opt{border-color:var(--violet)}
.step.locked{opacity:.55;border-style:dashed}
.wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5}
.wm span{transform:rotate(-32deg);font-size:190px;font-weight:900;letter-spacing:18px;color:rgba(244,114,182,.13);border:10px solid rgba(244,114,182,.13);padding:0 40px;border-radius:24px}
.sbanner{margin:18px 0 0;padding:14px 18px;border-radius:12px;background:linear-gradient(90deg,rgba(34,211,238,.12),rgba(244,114,182,.12));border:1px solid var(--magenta);font-size:13px;color:var(--muted)}.sbanner b{color:var(--text)}.sbanner ul{margin:6px 0 0;padding-left:18px;columns:2}
.foot{margin-top:22px;padding-top:12px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}.foot a{color:var(--cyan);text-decoration:none}
@media print{body{background:var(--bg)}.page{margin:0;min-height:auto}.tile,.box,.hero,.step{break-inside:avoid}.h2{break-after:avoid}}
@media screen and (max-width:820px){.page{width:auto;margin:0}.in{padding:22px 18px}.hero{grid-template-columns:1fr}.tiles,.cols,.facts{grid-template-columns:1fr}}
</style></head><body>${sample ? `<div class="wm"><span>SAMPLE</span></div>` : ""}<div class="page"><div class="grad"></div><div class="in">
<div class="top"><img src="https://neonkey.tech/email/neonkey-logo.png" alt="NeonKey"><div class="meta">Report <b>${esc(ref)}</b><br>Checked <b>${fmtDate(a.checkedAt)}</b>${who ? `<br>Prepared for <b>${esc(who)}</b>` : ""}</div></div>
<p class="eyebrow">Email Lockdown · Email security report</p>
<h1>${esc(a.domain)}</h1>
<p class="sub">A check of the public records that prove your email is really from you. No logins were used and nothing was changed.</p>
${sample ? `<div class="sbanner"><b>SAMPLE REPORT for a made-up business.</b> Your real report is built for your domain and goes further:<ul><li>Every step written out with the exact value</li><li>Which services are allowed to send as you</li><li>Help links for your exact domain host</li><li>Day 2 and day 5 rechecks with an updated report</li><li>Option to have us put the records in, included</li><li>Your $49 credited toward any package</li></ul></div>` : ""}

<div class="hero">
<div class="ring"><svg width="130" height="130" viewBox="0 0 110 110"><circle cx="55" cy="55" r="${R}" fill="none" stroke="#262b52" stroke-width="10"/><circle cx="55" cy="55" r="${R}" fill="none" stroke="${verdictColor}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}"/></svg>
<div class="c"><div class="n">${passing}/${cs.length}</div><div class="l">checks passing</div></div></div>
<div><p class="verdict" style="color:${verdictColor}">${verdict}</p>
<div style="color:var(--muted)">${a.locked ? "All four records are published and pass our public-records check. Keep this report for your records." : `${passing} of ${cs.length} checks passing. ${steps.length} ${steps.length === 1 ? "step" : "steps"} below bring${steps.length === 1 ? "s" : ""} ${esc(a.domain)} to ${cs.length} of ${cs.length}.`}${before != null ? `<br><b style="color:var(--text)">Up from ${before} of ${cs.length} on your first check.</b>` : ""}</div>
<div class="facts"><div class="fact"><div class="fl">Email provider</div><div class="fv">${esc(a.provider?.label || "Unknown")}</div></div>
<div class="fact"><div class="fl">Domain records at</div><div class="fv">${esc(a.dnsHost?.label || "Your domain host")}</div></div>
<div class="fact"><div class="fl">Next automatic check</div><div class="fv">${a.locked ? "Not needed" : "In 2 days"}</div></div></div></div>
</div>

<div class="h2">Your dashboard</div>
<div class="tiles">${cs.map(tile).join("")}</div>

${steps.length ? `<div class="h2" style="color:var(--cyan)">Two ways to finish</div>
<div class="cols"><div class="box"><b>A. Do it yourself</b><br>Follow the action plan below. Each step has the exact record to paste.</div>
<div class="box opt"><b>B. Have us put them in, included in your $49</b><br>Reply "do it" and we'll walk you through inviting us as a helper at ${esc(a.dnsHost?.label || "your domain host")}. No passwords shared.</div></div>
<div class="h2" style="color:var(--cyan)">Your action plan</div>
<p class="where">${a.dnsHost?.help ? `Sign in at <b>${esc(a.dnsHost.label)}</b>, open the DNS settings for ${esc(a.domain)}, and make each change below. Their guide: <a href="${esc(a.dnsHost.help)}">adding a record at ${esc(a.dnsHost.label)}</a>.` : `Sign in where you manage your domain (usually where you bought it), open its DNS settings, and make each change below.`}</p>
${steps.slice(0, showFull).map(stepHtml).join("")}${sample && steps.length > showFull ? steps.slice(showFull).map((st, i) => `<div class="step locked"><div class="num">${i + 1 + showFull}</div><div class="sb"><div class="st">${st.kind === "record" ? `${st.f.action === "replace" ? "Edit" : "Add"} your ${st.f.id.toUpperCase()} record` : esc(st.s.title)}</div><p class="sw">Exact value, where to paste it and why: in your full report.</p></div></div>`).join("") : ""}` : ""}

${a.human.length ? `<div class="box review" style="margin-top:12px"><b>We're taking a closer look</b><br>Part of your setup needs a person to review it before we suggest a change. We'll email you within 1 business day.</div>` : ""}

<div class="h2">What happens next</div>
<div class="cols">
${a.locked ? `<div class="box"><b>Keep it that way</b><ul><li>When you add a new tool that sends email as you (newsletter, invoicing, booking), turn on its "authenticate your domain" setting</li><li>Keep this report for your records</li><li>Questions any time: reply to our email</li></ul></div>` : `<div class="box"><b>Automatic rechecks</b><ul><li>Day 2: we check again and email you an updated "after" report once all four pass</li><li>Day 5: an updated report of anything still open, and the offer to finish it for you</li><li>Questions any time: reply to our email</li></ul></div>`}
<div class="box credit"><b>Your $49 counts toward any NeonKey package</b><br>${/Google|Microsoft/.test(a.provider?.label || "") ? `You're on ${esc(a.provider.label)}. The Remote Small-Office IT Setup adds 2-step sign-in, a password manager and backups: from $250 after your credit.` : `A full Remote Small-Office IT Setup is from $250 after your credit.`} The Front Office Package is $950 after your credit. Mention report ${esc(ref)} when you reply.</div>
</div>

<div class="foot"><span>Prepared by NeonKey · <a href="mailto:hello@neonkey.tech">hello@neonkey.tech</a> · <a href="https://neonkey.tech/">neonkey.tech</a></span><span>Reflects public DNS on ${fmtDate(a.checkedAt)}. Records can change.</span></div>
</div></div></body></html>`;
}
