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
      status: a.mx?.length ? "ok" : "missing",
      detail: a.mx?.length ? `${a.provider?.label || "Email host"} (${a.mx[0]}${a.mx.length > 1 ? ` +${a.mx.length - 1}` : ""})` : "No mail server found",
    },
    {
      key: "SPF", name: "Approved senders", what: "The public list of services allowed to send email as you.",
      status: flagged(/SPF/) ? "review" : fix("spf") ? (fix("spf").action === "add" ? "missing" : "fix") : spfRec ? "ok" : "missing",
      detail: spfRec ? `${spfRec}${(a.senders || sendersIn(spfRec)).length ? `\nAllows: ${(a.senders || sendersIn(spfRec)).join(", ")}` : ""}` : "No SPF record",
    },
    {
      key: "DKIM", name: "Digital signature", what: "A signature that proves a message really came from you.",
      status: a.dkim?.length ? "ok" : a.fixes.some((f) => f.id === "dkim") ? "missing" : a.buyerSteps.some((s) => s.id === "dkim") ? "unverified" : "review",
      detail: a.dkim?.length ? `Key found: ${a.dkim.join(", ")}` : `Couldn't verify a key at the names ${a.provider?.label || "your provider"} normally uses. It may be off, or set up under a custom name.`,
    },
    {
      key: "DMARC", name: "Spoofing policy", what: "Tells inboxes what to do with mail that fakes your address.",
      status: flagged(/DMARC/) ? "review" : fix("dmarc") ? (fix("dmarc").action === "add" ? "missing" : "fix") : dmarcRec ? "ok" : "missing",
      detail: dmarcRec ? `${dmarcRec}${a.dmarc.policy === "none" ? " \nMonitor mode: reports fakes, not blocking yet" : ""}` : "No DMARC record",
    },
  ];
}

const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Anchorage" });

// One plain sentence per check (Michael, Nov 5 2026: "a complete report, less a long guide", no jargon).
function finding(c, a) {
  const P = a.provider?.label || "your email provider";
  const senders = a.senders || [];
  const t = {
    MX: { ok: `Your email is delivered by ${P}.`, missing: "We found no mail server for this domain." },
    SPF: {
      ok: senders.length ? `Set up. Approved to send as you: ${senders.join(", ")}.` : "Set up.",
      fix: `Set up, but ${P} isn't on it, so your everyday email can look unverified.`,
      missing: "Not set up. Nothing tells inboxes who is allowed to send as you.",
    },
    DKIM: { ok: "Your email is signed.", unverified: `We couldn't confirm that ${P} is signing your email.` },
    DMARC: {
      ok: a.dmarc?.policy === "none" ? "Set up. It reports fake email in your name but doesn't block it yet." : "Set up and blocking fake email in your name.",
      fix: "Present, but missing the part that makes it work.",
      missing: "Not set up. Inboxes don't know what to do with fake email in your name.",
    },
  };
  return t[c.key]?.[c.status] || "Needs a closer look. We'll follow up by email.";
}

const PLAIN = { MX: "Mail delivery", SPF: "Approved senders", DKIM: "Email signature", DMARC: "Fake-email policy" };

function changes(a) {
  const out = a.fixes.map((f) => ({
    title: f.id === "dkim" ? `Add an email-signing record (${f.host})` : `${f.action === "replace" ? "Update" : "Add"} ${f.id === "spf" ? "your approved-sender list" : "a fake-email policy"}`,
    where: a.dnsHost?.label ? `at ${a.dnsHost.label}` : "where you manage your domain",
    rec: f,
  }));
  for (const s of a.buyerSteps) out.push({ title: s.id === "dkim" ? (s.help ? `Turn on email signing in ${a.provider?.label || "your email provider"}` : s.title) : s.title, where: "one setting", help: s.help, text: s.text });
  return out;
}

export function renderReport({ a, order = {}, sample = false }) {
  const cs = checks(a);
  const passing = cs.filter((c) => c.status === "ok").length;
  const pct = Math.round((passing / cs.length) * 100);
  const ch = changes(a);
  const before = Number.isInteger(order.before) && order.before !== passing ? order.before : null;
  const ref = `NK-EL-${String(order.id || "SAMPLE").replace(/^cs_(live|test)_/, "").slice(-8).toUpperCase()}`;
  const who = [order.name, order.business].filter(Boolean).join(", ") || order.email || "";
  const verdict = a.locked ? "Protected" : passing >= 3 ? "Almost there" : "Needs attention";
  const verdictColor = a.locked ? "#34d399" : passing >= 3 ? "#fbbf24" : "#f472b6";
  const summary = a.locked
    ? "Your email is set up so inboxes can tell your real messages from fakes. Nothing needs to change."
    : `Your email works, but it's easier than it should be for someone to send fake email that looks like it came from you. ${ch.length} ${ch.length === 1 ? "change fixes" : "changes fix"} that.`;
  const R = 46, C = 2 * Math.PI * R, dash = (C * pct) / 100;

  const icon = (status, size = 34) => {
    const col = STATUS[status].color;
    const mark = status === "ok" ? `<path d="M11 18.5l4.5 4.5L25 13" stroke="${col}" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : status === "missing" ? `<path d="M12.5 12.5l11 11M23.5 12.5l-11 11" stroke="${col}" stroke-width="3.2" stroke-linecap="round"/>`
      : `<path d="M18 10.5v9" stroke="${col}" stroke-width="3.2" stroke-linecap="round"/><circle cx="18" cy="25" r="2" fill="${col}"/>`;
    return `<svg width="${size}" height="${size}" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="${col}22" stroke="${col}" stroke-width="2"/>${mark}</svg>`;
  };
  const card = (c) => {
    const st = STATUS[c.status];
    return `<div class="fc">${icon(c.status)}<div><div class="fn">${PLAIN[c.key]} <span class="pill" style="color:${st.color};background:${st.bg};border-color:${st.color}55">${st.label}</span></div><div class="ft">${esc(finding(c, a))}</div></div></div>`;
  };
  // Inbox check flow: the three questions a receiving inbox asks, colored by this domain's result.
  const flow = cs.filter((c) => c.key !== "MX").map((c, i) => {
    const q = { SPF: "Is the sender approved?", DKIM: "Is the message signed?", DMARC: "What happens to fakes?" }[c.key];
    return `${i ? `<div class="arrow">&rarr;</div>` : ""}<div class="fl-step" style="border-color:${STATUS[c.status].color}">${icon(c.status, 26)}<div><b>${q}</b><span>${PLAIN[c.key]}</span></div></div>`;
  }).join("");
  const seg = (n, col) => Array.from({ length: cs.length }, (_, i) => `<span style="background:${i < n ? col : "#262b52"}"></span>`).join("");
  const bars = a.locked ? "" : `<div class="bars"><div class="bar"><span class="bl">Today</span><div class="segs">${seg(passing, verdictColor)}</div><b>${passing}/${cs.length}</b></div>
<div class="bar"><span class="bl">After the changes</span><div class="segs">${seg(cs.length, "#34d399")}</div><b>${cs.length}/${cs.length}</b></div></div>`;
  const row = (c) => {
    const st = STATUS[c.status];
    return `<tr><td><b>${PLAIN[c.key]}</b><span class="tech">${c.key}</span></td><td><span class="pill" style="color:${st.color};background:${st.bg};border-color:${st.color}55">${st.label}</span></td><td>${esc(finding(c, a))}</td></tr>`;
  };
  const XS = { good: { label: "In place", color: "#34d399" }, tip: { label: "Next step", color: "#fbbf24" }, info: { label: "Optional", color: "#a78bfa" } };
  const extra = (e) => { const st = XS[e.status] || XS.info; return `<div class="xr"><span class="dot" style="background:${st.color}"></span><div><div class="xn">${esc(e.label)} <span class="pill" style="color:${st.color};background:${st.color}1f;border-color:${st.color}55">${st.label}</span></div><div class="xt">${esc(e.detail)}</div></div></div>`; };
  const change = (x, i) => {
    const hidden = sample && i > 0;
    const body = hidden
      ? `<div class="hid">Exact record and where to paste it: included in your full report.</div>`
      : x.rec
        ? `<div class="recl"><span>${x.rec.type} record · name <b class="mono">${esc(x.rec.host)}</b></span><div class="mono val">${esc(x.rec.value)}</div>${x.rec.current ? `<div class="was">Replaces: <span class="mono">${esc(x.rec.current)}</span></div>` : ""}</div>`
        : (x.help ? `<div class="recl">A setting in your ${esc(a.provider?.label || "email")} admin. <a href="${esc(x.help)}">Official guide</a></div>` : `<div class="recl">${esc(x.text)}</div>`);
    return `<div class="chg${hidden ? " locked" : ""}"><div class="num">${i + 1}</div><div><div class="ct">${esc(x.title)} <span class="cw">${esc(x.where)}</span></div>${body}</div></div>`;
  };

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Email Security Report · ${esc(a.domain)} · NeonKey</title>
<style>
:root{--bg:#0b0d17;--panel:#151935;--line:#262b52;--text:#e8eaf6;--muted:#b3b8d6;--cyan:#22d3ee;--violet:#a78bfa;--magenta:#f472b6;--green:#34d399}
@page{size:letter;margin:0}
*{box-sizing:border-box}
body{margin:0;background:#1d2033;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--text);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:8.5in;min-height:11in;margin:24px auto;background:var(--bg);position:relative;overflow:hidden}
.grad{height:6px;background:linear-gradient(90deg,var(--cyan),var(--violet),var(--magenta))}
.in{padding:24px 40px 24px}
.top{display:flex;justify-content:space-between;align-items:center}.top img{height:36px}
.meta{text-align:right;font-size:11px;color:var(--muted);line-height:1.6}.meta b{color:var(--text);font-weight:600}
.eyebrow{margin:16px 0 2px;color:var(--cyan);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
h1{margin:0;font-size:30px;line-height:1.15}
.hero{display:grid;grid-template-columns:140px 1fr;gap:22px;align-items:center;margin:12px 0 4px;padding:14px 20px;background:var(--panel);border:1px solid var(--line);border-radius:14px}
.ring{position:relative;width:124px;height:124px}.ring svg{transform:rotate(-90deg)}
.ring .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ring .n{font-size:28px;font-weight:800}.ring .l{font-size:9.5px;color:var(--muted);letter-spacing:1.2px;text-transform:uppercase;text-align:center;line-height:1.3}
.verdict{font-size:22px;font-weight:800;margin:0 0 4px}.sum{color:var(--muted);margin:0}
.facts{display:flex;gap:26px;margin-top:10px;font-size:12px;color:var(--muted)}.facts b{display:block;color:var(--text);font-size:13px}
.h2{margin:14px 0 7px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--violet)}
table.f{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
table.f td{padding:10px 14px;border-top:1px solid var(--line);vertical-align:top;font-size:13px}table.f tr:first-child td{border-top:0}
table.f td:first-child{width:170px}table.f td:nth-child(2){width:120px}
.tech{display:block;font-size:10.5px;color:var(--muted);letter-spacing:1px}
.pill{font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;border:1px solid;white-space:nowrap}
.chg{display:grid;grid-template-columns:30px 1fr;gap:10px;padding:10px 14px;background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-bottom:7px;break-inside:avoid}
.chg.locked{opacity:.55;border-style:dashed}
.num{width:26px;height:26px;border-radius:50%;background:var(--cyan);color:var(--bg);font-weight:800;display:flex;align-items:center;justify-content:center;font-size:13px}
.ct{font-weight:700}.cw{font-weight:400;color:var(--muted);font-size:12px}
.recl{font-size:12.5px;color:var(--muted);margin-top:3px}.recl a{color:var(--cyan);font-weight:700;text-decoration:none}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.val{color:var(--green);word-break:break-all;margin-top:2px}.was{margin-top:2px;word-break:break-all}.was .mono{text-decoration:line-through;color:#8f94b8}
.hid{font-size:12.5px;color:var(--muted);margin-top:3px;font-style:italic}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fc{display:grid;grid-template-columns:34px 1fr;gap:12px;align-items:start;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 14px}
.fn{font-weight:700;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ft{color:var(--muted);font-size:12.5px;margin-top:3px}
.flow{display:flex;align-items:stretch;gap:8px}.arrow{display:flex;align-items:center;color:var(--muted);font-size:18px}
.fl-step{flex:1;display:flex;gap:10px;align-items:center;background:var(--panel);border:1px solid;border-radius:12px;padding:8px 12px;font-size:12.5px}.fl-step span{display:block;color:var(--muted);font-size:11.5px}
.bars{margin-top:10px;display:grid;gap:6px}
.bar{display:grid;grid-template-columns:120px 1fr 36px;gap:12px;align-items:center;font-size:12.5px;color:var(--muted)}.bar b{color:var(--text);text-align:right}
.segs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.segs span{height:12px;border-radius:4px}
.next{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.xs{font-weight:400;letter-spacing:0;text-transform:none;color:var(--muted);font-size:11px;margin-left:6px}.xg{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}.xr{display:grid;grid-template-columns:10px 1fr;gap:9px;align-items:start;padding:6px 0;border-top:1px solid var(--line)}.dot{width:9px;height:9px;border-radius:50%;margin-top:5px}.xn{font-size:12.5px;font-weight:700;color:var(--text)}.xt{font-size:11.5px;color:var(--muted);line-height:1.45;margin-top:2px}
.box{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:13px;color:var(--muted)}.box b{color:var(--text)}
.credit{border-left:3px solid var(--magenta)}
.wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5}
.wm span{transform:rotate(-32deg);font-size:190px;font-weight:900;letter-spacing:18px;color:rgba(244,114,182,.13);border:10px solid rgba(244,114,182,.13);padding:0 40px;border-radius:24px}
.sbanner{margin:16px 0 0;padding:10px 16px;border-radius:12px;border:1px solid var(--magenta);background:rgba(244,114,182,.08);font-size:13px;color:var(--muted)}.sbanner b{color:var(--text)}
.foot{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}.foot a{color:var(--cyan);text-decoration:none}
@media print{body{background:var(--bg)}.page{margin:0;min-height:auto}.in{zoom:.84}.box,.hero,table.f{break-inside:avoid}.h2{break-after:avoid}}
@media screen and (max-width:820px){.page{width:auto;margin:0}.in{padding:22px 18px}.hero,.next,.cards,.xg{grid-template-columns:1fr}.flow{flex-direction:column}.arrow{display:none}table.f td{display:block;width:auto!important;border-top:0;padding:4px 14px}table.f tr{display:block;border-top:1px solid var(--line);padding:6px 0}}
</style></head><body>${sample ? `<div class="wm"><span>SAMPLE</span></div>` : ""}<div class="page"><div class="grad"></div><div class="in">
<div class="top"><img src="https://neonkey.tech/email/neonkey-logo.png" alt="NeonKey"><div class="meta">Report <b>${esc(ref)}</b><br>${fmtDate(a.checkedAt)}${who ? `<br>Prepared for <b>${esc(who)}</b>` : ""}</div></div>
<p class="eyebrow">Email security report</p>
<h1>${esc(a.domain)}</h1>
${sample ? `<div class="sbanner"><b>Sample report for a made-up business.</b> Yours is built for your own domain and includes every record in full.</div>` : ""}

<div class="hero">
<div class="ring"><svg width="124" height="124" viewBox="0 0 110 110"><circle cx="55" cy="55" r="${R}" fill="none" stroke="#262b52" stroke-width="10"/><circle cx="55" cy="55" r="${R}" fill="none" stroke="${verdictColor}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}"/></svg>
<div class="c"><div class="n">${passing}/${cs.length}</div><div class="l">checks<br>passing</div></div></div>
<div><p class="verdict" style="color:${verdictColor}">${verdict}</p><p class="sum">${summary}${before != null ? ` <b style="color:var(--text)">Up from ${before} of ${cs.length} on your first check.</b>` : ""}</p>
${bars}<div class="facts"><span>Email provider<b>${esc(a.provider?.label || "Unknown")}</b></span><span>Domain managed at<b>${esc(a.dnsHost?.label || "Unknown")}</b></span></div></div>
</div>

<div class="h2">How inboxes check your email</div>
<div class="flow">${flow}</div>
<div class="h2">What we found</div>
<div class="cards">${cs.map(card).join("")}</div>

${a.locked && a.extras?.length ? `<div class="h2">Extra checks <span class="xs">${a.extras.filter((e) => e.status === "good").length} of ${a.extras.length} in place · these don't affect your score</span></div><div class="xg">${a.extras.map(extra).join("")}</div>` : ""}

${ch.length ? `<div class="h2" style="color:var(--cyan)">Recommended changes</div>${ch.map(change).join("")}` : ""}
${a.human.length ? `<div class="box" style="margin-top:8px;border-left:3px solid var(--violet)"><b>We're taking a closer look.</b> Part of your setup needs a person to review it. We'll email you within 1 business day.</div>` : ""}

<div class="h2">Next steps</div>
<div class="next">
<div class="box">${a.locked ? "<b>Keep it that way.</b> When you add a new tool that sends email as you, turn on its \"verify your domain\" setting." : "<b>Rather not do it yourself?</b> Reply to our email and we'll make these changes for you, included in your $29. We'll recheck on day 2 and day 5 and send you an updated report."}</div>
<div class="box credit"><b>Your $29 counts toward any NeonKey package.</b> ${/Google|Microsoft/.test(a.provider?.label || "") ? `For example, a full ${esc(a.provider.label)} setup with 2-step sign-in and backups is from $270 after your credit.` : "For example, a full remote IT setup is from $270 after your credit."} Mention report ${esc(ref)}.</div>
</div>

<div class="foot"><span>Prepared by NeonKey · <a href="mailto:hello@neonkey.tech">hello@neonkey.tech</a> · <a href="https://neonkey.tech/">neonkey.tech</a></span><span>Based on public records on ${fmtDate(a.checkedAt)}. No logins used.</span></div>
</div></div></body></html>`;
}
