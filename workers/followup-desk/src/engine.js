// Pure logic for the Follow-Up Desk: defaults, when a follow-up is due, filling in templates, reading a pasted list.
// Nothing here touches the network or storage, so all of it is unit tested.

export const DAY = 86400000;
export const MAX_OPEN = 500; // open follow-ups per account
export const DAILY_CAP = 60; // follow-up emails per account per day (protects the sending domain)
export const SEND_HOURS = [9, 10, 11]; // local hours (owner's time zone), Monday to Friday
export const REPORT_HOUR = 8; // Monday report, owner's local time

export const TIMEZONES = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Anchorage", "Alaska"],
  ["Pacific/Honolulu", "Hawaii"],
];

export const KINDS = {
  estimate: "Estimate",
  invoice: "Unpaid invoice",
  inquiry: "New inquiry",
};

// Default messages. Short, plain, no pressure, and every one makes it easy to say no (a reply stops the rest).
// Placeholders: {first_name} {job} {business} {signoff} {amount}
export const DEFAULT_TEMPLATES = {
  estimate: [
    { subject: "Your estimate for {job}", body: "Hi {first_name},\n\nJust checking that the estimate for {job} reached you. Happy to answer any questions or adjust anything.\n\n{signoff}" },
    { subject: "Re: Your estimate for {job}", body: "Hi {first_name},\n\nFollowing up on the estimate for {job}. If the timing or scope needs to change, just reply and let me know what would work better.\n\n{signoff}" },
    { subject: "Should I close out your estimate?", body: "Hi {first_name},\n\nI haven't heard back about {job}, so I'll close out the estimate for now. If you'd still like to go ahead, just reply and we'll pick it right back up.\n\n{signoff}" },
  ],
  invoice: [
    { subject: "Invoice for {job}", body: "Hi {first_name},\n\nA friendly reminder that the invoice for {job}{amount_phrase} is still open. If it's already on its way, thank you, and please ignore this.\n\n{signoff}" },
    { subject: "Re: Invoice for {job}", body: "Hi {first_name},\n\nFollowing up on the invoice for {job}{amount_phrase}. If something about it doesn't look right, just reply and we'll sort it out.\n\n{signoff}" },
    { subject: "Open invoice for {job}", body: "Hi {first_name},\n\nThe invoice for {job}{amount_phrase} is still showing as open on our end. Could you reply with an update on when to expect payment?\n\n{signoff}" },
  ],
  inquiry: [
    { subject: "Following up on your request", body: "Hi {first_name},\n\nThanks again for reaching out about {job}. Do you have a minute to reply with a good time to talk, or any details that would help us put together a price?\n\n{signoff}" },
    { subject: "Re: Following up on your request", body: "Hi {first_name},\n\nJust checking in on {job}. If you've already found someone, no problem at all. If not, we'd be glad to help.\n\n{signoff}" },
    { subject: "Still need help with {job}?", body: "Hi {first_name},\n\nI'll stop checking in after this one. If you still need help with {job}, just reply and we'll get back to you.\n\n{signoff}" },
  ],
};

export const DEFAULT_DAYS = [3, 7, 14];

// One-tap buttons under each follow-up (customer -> owner). yes = ready to go ahead, ask = has a question,
// pay = the owner's own payment link (Stripe, Square, PayPal...). Money never passes through NeonKey.
export const ACTIONS = {
  estimate: { yes: "Yes, let's go ahead", ask: "I have a question", pay: "Pay the deposit" },
  invoice: { yes: "", ask: "I have a question", pay: "Pay the invoice" },
  inquiry: { yes: "Yes, let's set up a time", ask: "I have a question", pay: "" },
};

// Trial nudges: days after signup, sent only while the account has no follow-ups yet.
export const NUDGE_DAYS = [1, 3, 10];

// An https link the owner pastes for payments. Anything else is rejected (no javascript:, no http:).
export function validPayUrl(s) {
  const v = String(s ?? "").trim();
  if (!v) return "";
  if (v.length > 500 || /\s/.test(v)) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && u.hostname.includes(".") && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}

export function defaultSettings(business = "") {
  return {
    business: String(business || "").slice(0, 80),
    replyTo: "",
    signoff: "",
    timezone: "America/Chicago",
    days: [...DEFAULT_DAYS],
    templates: structuredClone(DEFAULT_TEMPLATES),
    bccMe: true,
    buttons: true,
    payUrl: "",
  };
}

// ---------- validation ----------
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
export const isEmail = (s) => typeof s === "string" && s.length <= 254 && EMAIL_RE.test(s);
export const clean = (s, max = 200) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
// One line only: subjects and names never carry a newline (header injection).
export const oneLine = (s, max = 200) => clean(s, max).replace(/[\r\n]+/g, " ");

export function validDays(list) {
  const d = list.map((x) => parseInt(x, 10));
  if (d.length !== 3 || d.some((x) => !Number.isInteger(x) || x < 1 || x > 60)) return null;
  if (!(d[0] < d[1] && d[1] < d[2])) return null;
  return d;
}

export function firstName(name) {
  const n = String(name || "").trim().split(/\s+/)[0] || "";
  if (!n || n.length > 30 || /[@\d<>]/.test(n)) return "there";
  return n.charAt(0).toUpperCase() + n.slice(1);
}

// ---------- dates ----------
// "2026-11-03", "11/3/2026", "11/03/26" -> ms at noon UTC that day. Anything else -> null.
export function parseDate(s) {
  s = String(s || "").trim();
  let y, m, d;
  let r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (r) [y, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))) [m, d, y] = [+r[1], +r[2], r[3].length === 2 ? 2000 + +r[3] : +r[3]];
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const t = Date.UTC(y, m - 1, d, 12);
  const back = new Date(t);
  if (back.getUTCMonth() !== m - 1) return null;
  return t;
}

export function localParts(now, timezone) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "numeric", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  return { weekday: p.weekday, hour: parseInt(p.hour, 10), date: `${p.year}-${p.month}-${p.day}` };
}
export const isWeekday = (wd) => !["Sat", "Sun"].includes(wd);
export const inSendWindow = (now, tz) => {
  const l = localParts(now, tz);
  return isWeekday(l.weekday) && SEND_HOURS.includes(l.hour);
};

export function fmtDate(ms, tz = "America/Chicago") {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short", day: "numeric" }).format(new Date(ms));
}

// ---------- the schedule ----------
// Follow-up k (0, 1, 2) is due `days[k]` days after the original was sent, and never sooner than 2 days after
// the previous follow-up (so an estimate added late doesn't get three emails in a row).
export function nextDue(item, days) {
  const k = item.step || 0;
  if (k >= days.length) return null;
  const byPlan = item.sentOn + days[k] * DAY;
  const byGap = item.lastSentAt ? item.lastSentAt + 2 * DAY : 0;
  return Math.max(byPlan, byGap);
}

export function isDue(item, days, now) {
  if (item.status !== "open") return false;
  const due = nextDue(item, days);
  return due !== null && now >= due;
}

// ---------- templates ----------
export function fill(tpl, item, settings) {
  const amount = item.amount ? String(item.amount) : "";
  const vars = {
    first_name: firstName(item.name),
    job: item.job || (item.kind === "invoice" ? "your recent job" : item.kind === "inquiry" ? "your project" : "your project"),
    business: settings.business || "",
    signoff: settings.signoff || settings.business || "",
    amount,
    amount_phrase: amount ? ` (${amount})` : "",
  };
  return String(tpl).replace(/\{(first_name|job|business|signoff|amount_phrase|amount)\}/g, (_, k) => vars[k]);
}

export function message(item, settings) {
  const k = Math.min(item.step || 0, 2);
  const t = (settings.templates?.[item.kind] || DEFAULT_TEMPLATES[item.kind] || DEFAULT_TEMPLATES.estimate)[k];
  return { subject: oneLine(fill(t.subject, item, settings), 150), body: fill(t.body, item, settings) };
}

// ---------- reading a pasted list ----------
// Accepts a CSV/TSV export (QuickBooks "Estimates by Customer", Jobber, a spreadsheet) or plain lines like
// "Jane Smith, jane@example.com, Kitchen remodel, 11/3/2026". The email column is found by content; a header row
// (if any) names the rest. Returns { rows, skipped } where skipped lists lines that had no usable email.
export function splitRow(line) {
  const sep = line.includes("\t") ? "\t" : ",";
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (c === sep && !q) { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const HEAD = {
  name: /^(customer|client|name|customer name|full name|contact)$/i,
  email: /^(e-?mail|email address|customer email|bill email)$/i,
  job: /^(job|project|description|memo|estimate no\.?|estimate #|invoice no\.?|invoice #|num|title|service)$/i,
  date: /^(date|estimate date|invoice date|sent|date sent|txn date|created)$/i,
  amount: /^(amount|total|balance|open balance|amount due)$/i,
};

export function parseList(text, today = Date.now()) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 1001);
  const rows = [];
  const skipped = [];
  let cols = null;
  lines.forEach((line, idx) => {
    const cells = splitRow(line);
    if (idx === 0 && !cells.some((c) => isEmail(c.replace(/^.*<|>.*$/g, "")))) {
      const map = {};
      cells.forEach((c, i) => {
        for (const [k, re] of Object.entries(HEAD)) if (map[k] === undefined && re.test(c.trim())) map[k] = i;
      });
      if (Object.keys(map).length) { cols = map; return; }
    }
    let emailIdx = cells.findIndex((c) => isEmail(c.replace(/^.*<|>.*$/g, "")));
    if (cols && cols.email !== undefined && isEmail(cells[cols.email] || "")) emailIdx = cols.email;
    if (emailIdx < 0) { if (rows.length || idx > 0) skipped.push(line.slice(0, 80)); return; }
    const emailCell = cells[emailIdx];
    const email = emailCell.replace(/^.*<|>.*$/g, "").toLowerCase();
    const angleName = emailCell.includes("<") ? emailCell.split("<")[0].replace(/"/g, "").trim() : "";
    const pick = (k) => (cols && cols[k] !== undefined ? cells[cols[k]] || "" : "");
    const others = cells.filter((_, i) => i !== emailIdx);
    let name = pick("name") || angleName;
    let job = pick("job");
    let date = pick("date");
    let amount = pick("amount");
    if (!cols) {
      // Positional: name, [email], job, date, amount (email can be anywhere).
      const rest = others.filter(Boolean);
      const di = rest.findIndex((c) => parseDate(c) !== null);
      if (di >= 0) { date = rest[di]; rest.splice(di, 1); }
      const ai = rest.findIndex((c) => /^\$?\d[\d,]*(\.\d{2})?$/.test(c));
      if (ai >= 0) { amount = rest[ai]; rest.splice(ai, 1); }
      if (!name) name = rest.shift() || "";
      job = rest.join(", ");
    }
    const sentOn = parseDate(date);
    rows.push({
      name: oneLine(name, 80),
      email,
      job: oneLine(job, 100),
      amount: normAmount(amount),
      sentOn: sentOn && sentOn <= today + DAY ? sentOn : null,
    });
  });
  return { rows: rows.slice(0, 1000), skipped };
}

export function normAmount(s) {
  s = String(s || "").trim();
  if (!s) return "";
  const n = Number(s.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) return "";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

// ---------- ids and tokens ----------
// Rejection sampling: bytes 252-255 are thrown away so each of the 36 characters is equally likely (252 = 7 x 36).
export function randomId(length = 9) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  while (out.length < length) {
    for (const x of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (x < 252 && out.length < length) out += chars[x % 36];
    }
  }
  return out;
}
export function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function sha256(s) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- the Monday report ----------
export function summarize(acct, now, since = now - 7 * DAY) {
  const items = acct.items || [];
  const recent = (field) => items.filter((i) => i[field] && i[field] >= since);
  return {
    open: items.filter((i) => i.status === "open").length,
    sent: items.reduce((n, i) => n + (i.sends || []).filter((t) => t >= since).length, 0),
    replied: recent("repliedAt"),
    won: items.filter((i) => i.status === "won" && i.closedAt >= since),
    lost: items.filter((i) => i.status === "lost" && i.closedAt >= since),
    bounced: items.filter((i) => i.status === "bounced" && i.closedAt >= since),
    finished: items.filter((i) => i.status === "done" && i.closedAt >= since),
  };
}
