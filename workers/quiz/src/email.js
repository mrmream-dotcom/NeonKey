// Plan email + lead copy templates (HTML + plain text). Table-based, inline CSS, email-safe.
// Same banner and colors as workers/welcome/src/email.js.

const C = { outer: "#0b0d17", panel: "#151935", text: "#e8eaf6", muted: "#b3b8d6", accent: "#22d3ee", rule: "#262b52", card: "#0e1129" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SITE = "https://neonkey.tech";

export function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Keep a first name only if it looks like a plausible name (same rule as the welcome worker).
export function cleanFirstName(name) {
  if (!name || typeof name !== "string") return null;
  const n = name.trim().split(/\s+/)[0];
  if (!n || n.length > 40) return null;
  if (/[<>@\/\\:;{}\[\]"=]|https?/i.test(n)) return null;
  return n;
}

const abs = (href) => (/^https?:/.test(href) ? href : SITE + href);
const p = `margin:0 0 16px 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.text};`;
const small = `margin:0 0 12px 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.muted};`;
const h2 = `margin:24px 0 10px 0;font-family:${FONT};font-size:18px;line-height:1.4;color:${C.text};font-weight:700;`;

function bullets(list) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
${list.map((b) => `<tr><td width="20" valign="top" style="padding:0 0 6px 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.accent};">&#8226;</td><td valign="top" style="padding:0 0 6px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.text};">${b}</td></tr>`).join("\n")}
</table>`;
}

function numbered(list) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
${list.map((b, i) => `<tr><td width="26" valign="top" style="padding:0 0 8px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.accent};font-weight:700;">${i + 1}.</td><td valign="top" style="padding:0 0 8px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.text};">${b}</td></tr>`).join("\n")}
</table>`;
}

const label = (t) => `<p style="margin:12px 0 4px 0;font-family:${FONT};font-size:13px;line-height:1.4;letter-spacing:.5px;text-transform:uppercase;color:${C.accent};font-weight:600;">${t}</p>`;
const body15 = `margin:0;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.text};`;

function box(inner) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;"><tr><td bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.rule};border-radius:10px;padding:16px 18px;">${inner}</td></tr></table>`;
}

function button(label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;"><tr><td align="center" bgcolor="${C.accent}" style="border-radius:8px;background-color:${C.accent};"><a href="${escapeHtml(abs(href))}" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:16px;line-height:1.2;font-weight:700;color:${C.outer};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></td></tr></table>`;
}

function shell({ title, preheader, kicker, heading, body, footer }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark light; supported-color-schemes: dark light; }
  body { margin:0; padding:0; }
  a { color:${C.accent}; }
  @media only screen and (max-width:620px) {
    .container { width:100% !important; }
    .px { padding-left:24px !important; padding-right:24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.outer};" bgcolor="${C.outer}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.outer};">${escapeHtml(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.outer}" style="background-color:${C.outer};">
<tr>
<td align="center" style="padding:32px 12px;">
  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
    <tr>
      <td align="center" style="padding:0 0 24px 0;">
        <a href="https://neonkey.tech/" style="text-decoration:none;"><img src="https://neonkey.tech/email/neonkey-logo.png" width="320" height="80" alt="NeonKey" style="display:block;width:320px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;color:${C.text};font-family:${FONT};font-size:24px;font-weight:bold;"></a>
      </td>
    </tr>
    <tr>
      <td class="px" bgcolor="${C.panel}" style="background-color:${C.panel};border-radius:12px;border:1px solid ${C.rule};padding:40px 40px 32px 40px;">
        <p style="margin:0 0 8px 0;font-family:${FONT};font-size:13px;line-height:1.4;letter-spacing:1.5px;text-transform:uppercase;color:${C.accent};font-weight:600;">${escapeHtml(kicker)}</p>
        <h1 style="margin:0 0 24px 0;font-family:${FONT};font-size:26px;line-height:1.3;color:${C.text};font-weight:700;">${escapeHtml(heading)}</h1>
${body}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="border-top:1px solid ${C.rule};padding:20px 0 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
        <p style="margin:0 0 4px 0;font-family:${FONT};font-size:16px;line-height:1.5;color:${C.text};font-weight:700;">NeonKey</p>
        <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};"><a href="https://neonkey.tech/" style="color:${C.accent};text-decoration:none;">neonkey.tech</a> &middot; <a href="mailto:hello@neonkey.tech" style="color:${C.accent};text-decoration:none;">hello@neonkey.tech</a></p>
      </td>
    </tr>
    <tr>
      <td class="px" align="center" style="padding:24px 40px 0 40px;">
${footer.map((f) => `        <p style="margin:0 0 6px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">${f}</p>`).join("\n")}
      </td>
    </tr>
  </table>
</td>
</tr>
</table>
</body>
</html>`;
}

/** The user's plan email, built from the shared PlanView (src/data/quiz.ts). */
export function renderPlanEmail(v, { firstName, newsletter }) {
  const name = cleanFirstName(firstName);
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const e = escapeHtml;
  const H = [];
  const T = [];

  H.push(`<p style="${p}">${e(greeting)}</p>`);
  H.push(`<p style="${p}">Thanks for taking the NeonKey service quiz. ${e(v.intro)}</p>`);
  T.push(greeting, "", `Thanks for taking the NeonKey service quiz. ${v.intro}`, "");

  if (v.price) {
    H.push(`<p style="${p}"><strong>What it costs:</strong> ${e(v.price)}</p>`);
    T.push(`What it costs: ${v.price}`, "");
  }
  if (v.steps && v.steps.length) {
    H.push(`<p style="${h2}">Your plan, step by step</p><p style="${small}">In the order I'd recommend doing them.</p>`);
    T.push("YOUR PLAN, STEP BY STEP (in the order I'd recommend)", "");
    v.steps.forEach((s, i) => {
      H.push(box(`<p style="margin:0 0 2px 0;font-family:${FONT};font-size:13px;line-height:1.4;letter-spacing:1px;text-transform:uppercase;color:${C.muted};font-weight:600;">Step ${i + 1} of ${v.steps.length}</p>
<p style="margin:0 0 4px 0;font-family:${FONT};font-size:17px;line-height:1.4;color:${C.text};font-weight:700;">${e(s.title)}</p>
${label("What it is")}<p style="${body15}">${e(s.what)}</p>
${s.why ? `${label("Why I picked it")}<p style="${body15}">${e(s.why)}</p>` : ""}
${s.ready && s.ready.length ? `${label("Have ready")}${bullets(s.ready.map(e))}` : ""}`));
      T.push(`${i + 1}. ${s.title}`, `   What it is: ${s.what}`);
      if (s.why) T.push(`   Why I picked it: ${s.why}`);
      if (s.ready && s.ready.length) T.push("   Have ready:", ...s.ready.map((r) => `   - ${r}`));
      T.push("");
    });
    if (v.orderNote) { H.push(`<p style="${small}">${e(v.orderNote)}</p>`); T.push(v.orderNote, ""); }
  } else if (v.includes) {
    H.push(`<p style="${h2}">${e(v.includes.title)}</p>${bullets(v.includes.list.map(e))}`);
    T.push(v.includes.title.toUpperCase(), ...v.includes.list.map((x) => `- ${x}`), "");
  }
  if (v.selfHelp) {
    H.push(`<p style="${h2}">Quick things you can do yourself</p><p style="${small}">Start with the first one; each takes a few minutes.</p>${numbered(v.selfHelp.map(e))}`);
    T.push("QUICK THINGS YOU CAN DO YOURSELF", ...v.selfHelp.map((x, i) => `${i + 1}. ${x}`), "");
  }
  if (v.freeLinks) {
    H.push(`<p style="${h2}">Start here (free)</p>${bullets(v.freeLinks.map((l) => `<a href="${e(abs(l.href))}" style="color:${C.accent};font-weight:700;">${e(l.label)}</a>: ${e(l.text)}`))}`);
    T.push("START HERE (FREE)", ...v.freeLinks.map((l) => `- ${l.label}: ${l.text} ${abs(l.href)}`), "");
  }
  if (v.youGet) { H.push(`<p style="${p}">${e(v.youGet)}</p>`); T.push(v.youGet, ""); }
  if (v.note) { H.push(`<p style="${p}">${e(v.note)}</p>`); T.push(v.note, ""); }
  if (v.addon) {
    H.push(box(`<p style="margin:0 0 4px 0;font-family:${FONT};font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${C.accent};font-weight:600;">Optional add-on</p>
<p style="margin:0 0 6px 0;font-family:${FONT};font-size:16px;line-height:1.5;color:${C.text};font-weight:700;">${e(v.addon.name)}</p>
<p style="${small}"><em>${e(v.addon.reason)}</em></p>
<p style="margin:0 0 8px 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.text};">${e(v.addon.text)}</p>
<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.text};font-weight:700;">${e(v.addon.price)} <a href="${e(abs(v.addon.href))}" style="color:${C.accent};font-weight:600;">About the plan</a></p>`));
    T.push(`OPTIONAL ADD-ON: ${v.addon.name} (${v.addon.reason})`, v.addon.text, v.addon.price, abs(v.addon.href), "");
  }
  if (v.demo) {
    H.push(`<p style="${p}">${e(v.demo.text)} <a href="${e(abs(v.demo.href))}" style="color:${C.accent};">${e(abs(v.demo.href).replace(/^https:\/\//, ""))}</a></p>`);
    T.push(`${v.demo.text} ${abs(v.demo.href)}`, "");
  }
  if (v.setupNote) {
    H.push(`<p style="${p}">${e(v.setupNote.text)} <a href="${e(abs(v.setupNote.href))}" style="color:${C.accent};">About the setup</a></p>`);
    T.push(`${v.setupNote.text} ${abs(v.setupNote.href)}`, "");
  }
  if (v.secondary) {
    H.push(box(`<p style="margin:0 0 4px 0;font-family:${FONT};font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${C.accent};font-weight:600;">Also worth a look</p>
<p style="margin:0 0 6px 0;font-family:${FONT};font-size:16px;line-height:1.5;color:${C.text};font-weight:700;">${e(v.secondary.name)} <span style="font-weight:400;color:${C.muted};">(${e(v.secondary.price)})</span></p>
<p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.text};">${e(v.secondary.text)} <a href="${e(abs(v.secondary.href))}" style="color:${C.accent};">Learn more</a></p>`));
    T.push(`ALSO WORTH A LOOK: ${v.secondary.name} (${v.secondary.price})`, v.secondary.text, abs(v.secondary.href), "");
  }
  if (v.tip) { H.push(`<p style="${p}">${e(v.tip)}</p>`); T.push(v.tip, ""); }

  if (v.nextSteps && v.nextSteps.length) {
    H.push(`<p style="${h2}">Next steps</p>${numbered(v.nextSteps.map(e))}`);
    T.push("NEXT STEPS", ...v.nextSteps.map((x, i) => `${i + 1}. ${x}`), "");
  }

  const cta = v.links.find((l) => l.primary) || v.links[0];
  H.push(button(cta.label, cta.href));
  T.push(`${cta.label}: ${abs(cta.href)}`, "");
  if (v.footnote) { H.push(`<p style="${small}">${e(v.footnote)}</p>`); T.push(v.footnote, ""); }
  H.push(`<p style="${p}">Questions? Just reply to this email.</p><p style="${p}">Michael Ream<br>NeonKey</p>`);
  T.push("Questions? Just reply to this email.", "", "Michael Ream", "NeonKey", "neonkey.tech · hello@neonkey.tech", "");

  const footer = [
    "Prices on neonkey.tech are starting points, not quotes. You get a fixed quote after a short scoping call. Results depend on your business, your tools and your data, so no specific outcomes are promised.",
    `You're getting this because you asked for your plan on neonkey.tech. This is a one-time email${newsletter ? ", and you also asked for Unlock the Week: Kit will send a separate email to confirm that" : ""}. <a href="https://neonkey.tech/privacy/" style="color:${C.muted};text-decoration:underline;">Privacy</a>`,
  ];
  T.push("--", footer[0], footer[1].replace(/ <a .*$/, " Privacy: https://neonkey.tech/privacy/"));

  const html = shell({ title: v.subject, preheader: v.preheader, kicker: "Your NeonKey plan", heading: v.heading, body: H.join("\n"), footer });
  return { html, text: T.join("\n") };
}

/** Internal lead copy to hello@neonkey.tech. */
export function renderLeadEmail(v, { email, firstName, newsletter, summary, plan }) {
  const e = escapeHtml;
  const name = cleanFirstName(firstName);
  const rows = [
    ["Email", email],
    ["First name", name || "(not given)"],
    ["Result", `${v.resultName} [${v.type}]`],
    ["Items", plan.items.length && v.items ? v.items.list.map((i) => i.name).join(", ") + (plan.healthCheck ? " (health check default)" : "") : "(none)"],
    ["Support plan", plan.support || "no"],
    ["Also worth a look", v.secondary ? v.secondary.name : "(none)"],
    ["Newsletter opt-in", newsletter ? "yes (Kit double opt-in requested)" : "no"],
  ];
  const H = [
    `<p style="${p}">Someone asked for their plan from the service quiz. Their copy has been sent. Reply to this email to reach them directly.</p>`,
    box(rows.map(([k, val]) => `<p style="margin:0 0 6px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${C.text};"><strong>${e(k)}:</strong> ${e(val)}</p>`).join("")),
    `<p style="${h2}">Answers</p>`,
    bullets(summary.map((s) => `<strong>${e(s.q)}</strong><br>${e(s.a)}`)),
  ];
  const T = [
    "Someone asked for their plan from the service quiz. Their copy has been sent. Reply to reach them directly.",
    "",
    ...rows.map(([k, val]) => `${k}: ${val}`),
    "",
    "ANSWERS",
    ...summary.map((s) => `- ${s.q}\n  ${s.a}`),
  ];
  const html = shell({ title: "Quiz plan request", preheader: `Quiz plan request: ${v.resultName}`, kicker: "Service quiz lead", heading: v.resultName, body: H.join("\n"), footer: ["Internal copy from the neonkey-quiz Worker. Disclosed on neonkey.tech/privacy/ (Service quiz)."] });
  return { html, text: T.join("\n") };
}
