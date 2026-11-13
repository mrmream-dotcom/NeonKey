// Family Shield pages. Server-rendered HTML, plain forms, no JavaScript (the CSP allows none). Every dynamic string
// goes through esc(). A check result page shows the verdict for the text just pasted; the text itself is only echoed
// back in that one response (no-store) and never saved.
import { esc } from "./mail.js";
import { MAX_MEMBERS, MEMBER_DAILY } from "./store.js";

export const CSS = `:root{--bg:#0b0d17;--panel:#151935;--line:#262b52;--text:#e8eaf6;--muted:#b3b8d6;--cyan:#22d3ee;--violet:#a78bfa;--magenta:#f472b6;--green:#34d399;--amber:#fbbf24;--red:#f87171}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:720px;margin:0 auto;padding:24px 16px 64px}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.brand{font-weight:800;font-size:20px}.brand span{color:var(--cyan)}.tag{font-size:12px;letter-spacing:2px;color:var(--muted);text-transform:uppercase}
h1{font-size:28px;line-height:1.25;margin:0 0 12px}h2{font-size:20px;margin:28px 0 10px}p{margin:0 0 14px}a{color:var(--cyan)}
.box{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;margin:16px 0}
textarea,input[type=text],input[type=email]{width:100%;background:#0f1229;color:var(--text);border:1px solid var(--line);border-radius:10px;padding:12px;font:inherit}
textarea{min-height:160px}label{display:block;margin:10px 0 6px;font-weight:600}.check{display:flex;gap:10px;align-items:flex-start;font-weight:400}
.check input{margin-top:6px}button{background:var(--cyan);color:#0b0d17;border:0;border-radius:10px;padding:12px 18px;font:inherit;font-weight:700;cursor:pointer;margin-top:12px}
button.ghost{background:transparent;color:var(--cyan);border:1px solid var(--line);padding:8px 12px;margin:0}
.muted{color:var(--muted);font-size:14px}.verdict{font-size:22px;font-weight:800;margin:0 0 8px}.scam{color:var(--red)}.unsure{color:var(--amber)}.normal{color:var(--green)}
ul{padding-left:20px}li{margin:6px 0}table{width:100%;border-collapse:collapse}td{padding:8px 4px;border-top:1px solid var(--line);vertical-align:top}
.inline{display:inline}.err{color:var(--red);font-weight:600}.ok{color:var(--green);font-weight:600}`;

/** Generic wording for each rule id, used for results shared with the family (no links or text from the message). */
export const SHARE_TEXT = {
  "pay-odd": "Asked for gift cards, crypto or a wire", code: "Asked for a code", login: "Asked to log in or verify an account",
  urgent: "Pushed to act right away", threat: "Threatened a fee, lockout or legal trouble", secret: "Asked to keep it secret",
  "new-number": "Claimed a new phone number", "family-money": "A family member asking for money", "small-fee": "Asked for a small fee",
  package: "A package delivery problem", toll: "An unpaid toll", prize: "A prize or winnings", "tech-support": "Fake tech support",
  infected: "Said a device was infected", "fraud-alert": "A bank or card fraud alert", remote: "Asked to install a remote access app",
  refund: "A refund or overpayment", job: "A job offer", "reply-yes": "Asked to reply YES or NO", "link-ip": "A link that is a bare number",
  "link-punycode": "A link with look-alike letters", "link-short": "A shortened link", "link-lookalike": "A look-alike company link",
  "link-odd-ending": "A link with an unusual ending", "link-hyphens": "A link with extra dashes", "new-number-money": "A new number plus a money request",
  "link-plus-ask": "A link plus a request for money, a login or a code",
};
const LABEL = { scam: "Looks like a scam", unsure: "Can't tell, check it the direct way", normal: "Fits a normal message" };
const when = (t) => new Date(t).toLocaleString("en-US", { timeZone: "America/Anchorage", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${esc(title)} | NeonKey Family Shield</title><link rel="stylesheet" href="/app.css"></head>
<body><main><header><div class="brand">Neon<span>Key</span></div><div class="tag">Family Shield</div></header>${body}
<p class="muted">Family Shield gives advice, not a promise about any message. When money or a login is involved, check the direct way. Questions: <a href="mailto:hello@neonkey.tech">hello@neonkey.tech</a> · <a href="https://neonkey.tech/privacy/#family-shield">Privacy</a></p></main></body></html>`;
}

const TERMS = `<ul>
<li>You are 18 or older. Family Shield is for adults only.</li>
<li>When you check a message, its text is sent to our AI provider, Anthropic, to get a second opinion, and to our rules. NeonKey does not save the text. Don't paste passwords, full card numbers or Social Security numbers: you can remove them and the check still works.</li>
<li>Results are advice, not a promise. The AI can be wrong, so check the direct way before you pay, log in or share a code.</li>
<li>Nothing you check is shown to anyone else unless you press "Share with my family". Sharing shows the verdict, the warning signs and any note you add, never the message.</li>
<li>Up to ${MEMBER_DAILY} checks a day per person.</li>
</ul>`;

export function consentPage({ token, name, error }) {
  return page("Before your first check", `<h1>Before your first check</h1><p>Please read these and confirm.</p>${TERMS}
<form method="post" action="/f/${esc(token)}/consent" class="box">
${error ? `<p class="err">${esc(error)}</p>` : ""}
<label for="name">Your first name (shown to your family)</label><input type="text" id="name" name="name" maxlength="40" value="${esc(name)}" required>
<label class="check"><input type="checkbox" name="adult" value="yes" required> I'm 18 or older.</label>
<label class="check"><input type="checkbox" name="agree" value="yes" required> I understand how my checks are handled, as described above.</label>
<button type="submit">Agree and continue</button></form>`);
}

export function joinPage({ invite, from, token, error }) {
  return page("Join Family Shield", `<h1>Join ${esc(from)}'s Family Shield</h1><p>Paste a text, email or message you aren't sure about and get a quick read on whether it looks like a scam. It's included in their plan.</p>${TERMS}
<form method="post" action="/join/${esc(token)}" class="box">
${error ? `<p class="err">${esc(error)}</p>` : ""}
<label for="name">Your first name (shown to your family)</label><input type="text" id="name" name="name" maxlength="40" value="${esc(invite.name)}" required>
<label class="check"><input type="checkbox" name="adult" value="yes" required> I'm 18 or older.</label>
<label class="check"><input type="checkbox" name="agree" value="yes" required> I understand how my checks are handled, as described above.</label>
<button type="submit">Join</button></form>`);
}

function checkForm(token, text = "") {
  return `<form method="post" action="/f/${esc(token)}/check" class="box"><label for="text">Paste the message you aren't sure about</label>
<textarea id="text" name="text" maxlength="8000" required placeholder="Paste a text, email or social media message. For a phone call, type what the caller said.">${esc(text)}</textarea>
<p class="muted">Not saved. Remove passwords, card numbers or Social Security numbers first.</p><button type="submit">Check it</button></form>`;
}

function sharesList(fam) {
  const shares = fam.shares || [];
  if (!shares.length) return `<p class="muted">Nothing shared yet. After a check, press "Share with my family" to warn everyone.</p>`;
  return `<table>${shares.map((s) => `<tr><td><strong class="${esc(s.verdict)}">${esc(LABEL[s.verdict] || "")}</strong><br><span class="muted">${esc(s.by)} · ${esc(when(s.at))}</span>${s.note ? `<br>${esc(s.note)}` : ""}${s.tells.length ? `<br><span class="muted">${s.tells.map((t) => esc(SHARE_TEXT[t] || "")).filter(Boolean).join(" · ")}</span>` : ""}</td></tr>`).join("")}</table>`;
}

function familyBox(fam, member, token, msg) {
  const owner = member.role === "owner";
  const rows = fam.members.map((m) => `<tr><td>${esc(m.name || m.email)}${m.role === "owner" ? ` <span class="muted">(plan owner)</span>` : ""}${owner ? `<br><span class="muted">${esc(m.email)}</span>` : ""}</td><td>${owner && m.role !== "owner" ? `<form method="post" action="/f/${esc(token)}/remove" class="inline"><input type="hidden" name="member" value="${esc(m.id)}"><button class="ghost" type="submit">Remove</button></form>` : ""}</td></tr>`).join("");
  const pending = (fam.invites || []).map((i) => `<tr><td>${esc(i.name || i.email)} <span class="muted">(invited${owner ? `, ${esc(i.email)}` : ""})</span></td><td></td></tr>`).join("");
  const room = MAX_MEMBERS - fam.members.length - (fam.invites || []).length;
  const invite = owner && fam.status === "active"
    ? room > 0
      ? `<form method="post" action="/f/${esc(token)}/invite"><h2>Invite an adult</h2><p class="muted">Up to ${MAX_MEMBERS} adults, including you. ${room} spot${room === 1 ? "" : "s"} left. They'll get an email and must agree they're 18 or older.</p>
<label for="iname">Their first name</label><input type="text" id="iname" name="name" maxlength="40" required>
<label for="iemail">Their email</label><input type="email" id="iemail" name="email" maxlength="254" required><button type="submit">Send invite</button></form>`
      : `<p class="muted">Your plan is full (${MAX_MEMBERS} adults). Remove someone to invite another person.</p>`
    : "";
  const billing = owner && fam.portal ? `<p class="muted">Billing or cancel: <a href="${esc(fam.portal)}">manage your plan</a>.</p>` : "";
  return `<section class="box"><h2>Your family</h2>${msg ? `<p class="ok">${esc(msg)}</p>` : ""}<table>${rows}${pending}</table>${invite}${billing}</section>`;
}

export function dashboardPage({ fam, member, token, msg, error }) {
  if (fam.status === "canceled") {
    const del = fam.deleteAt ? new Date(fam.deleteAt).toLocaleDateString("en-US", { timeZone: "America/Anchorage", month: "long", day: "numeric", year: "numeric" }) : "soon";
    return page("Plan ended", `<h1>This Family Shield plan has ended</h1><p>Checks are off. Everything for this family is deleted on ${esc(del)}.</p><p>The <a href="https://neonkey.tech/scam-checker/">free scam checker</a> still works for everyone.</p>`);
  }
  const paused = fam.status !== "active" ? `<p class="err">There's a problem with the payment for this plan, so checks use our rules only until it's fixed.</p>` : "";
  return page("Your Family Shield", `<h1>Hi ${esc(member.name || "there")}</h1><p>Paste a message you aren't sure about. Our rules and an AI review both read it, and you get the more cautious answer.</p>
${paused}${error ? `<p class="err">${esc(error)}</p>` : ""}${checkForm(token)}
<section class="box"><h2>Shared with the family</h2>${sharesList(fam)}</section>
${familyBox(fam, member, token, msg)}`);
}

export function resultPage({ token, text, r, left }) {
  const steps = r.verdict === "scam"
    ? `<section class="box"><h2>Already paid, tapped or shared something?</h2><ul><li>Call your bank or card company on the number on your card and tell them what happened.</li><li>Change the password for any account you logged in to, starting with email, from the app or a site you type yourself.</li><li>Report it at <a href="https://reportfraud.ftc.gov/">ReportFraud.ftc.gov</a>. If personal details were shared, follow <a href="https://www.identitytheft.gov/">IdentityTheft.gov</a>.</li></ul></section>`
    : "";
  return page("Result", `<section class="box"><p class="verdict ${esc(r.verdict)}">${esc(r.label)}</p>
${r.reasons.length ? `<h2>What we noticed</h2><ul>${r.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
<h2>What to do</h2><p>${esc(r.nextStep)}</p>
${r.aiNote ? `<p class="muted">${esc(r.aiNote)}</p>` : ""}
${r.rules !== r.ai && r.ai ? `<p class="muted">Our rules and the AI review read this differently, so we show the more cautious answer.</p>` : ""}
<form method="post" action="/f/${esc(token)}/share"><input type="hidden" name="verdict" value="${esc(r.verdict)}"><input type="hidden" name="tells" value="${esc(r.tells.join(","))}">
<label for="note">Share with my family (optional note, no personal details)</label><input type="text" id="note" name="note" maxlength="120" placeholder="Example: fake toll text going around">
<button type="submit">Share with my family</button></form>
<p class="muted">Sharing shows the verdict, the warning signs and your note. Never the message. ${esc(String(left))} checks left today.</p></section>
${steps}
<p><a href="/f/${esc(token)}">Back to my Family Shield</a></p>
${checkForm(token, text)}`);
}

export function loginPage({ sent }) {
  return page("Sign in", `<h1>Get your Family Shield link</h1>${sent ? `<p class="ok">If that email is on a Family Shield plan, a link is on its way. Check your inbox in a minute or two.</p>` : `<p>Enter the email your invite or welcome email went to, and we'll send you a fresh link.</p>`}
<form method="post" action="/login" class="box"><label for="email">Email</label><input type="email" id="email" name="email" maxlength="254" required><button type="submit">Email me a link</button></form>`);
}

export function messagePage(title, text, status = 200) {
  return { status, body: page(title, `<h1>${esc(title)}</h1><p>${esc(text)}</p><p><a href="/login">Get a new link</a> · <a href="https://neonkey.tech/scam-checker/">Free scam checker</a></p>`) };
}
