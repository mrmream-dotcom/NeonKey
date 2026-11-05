// Turns the branded report HTML into a PDF with Cloudflare Browser Rendering (REST API).
// Needs the BROWSER_TOKEN secret (a Cloudflare API token with "Browser Rendering: Edit") and the CF_ACCOUNT_ID var.
// Returns base64 PDF bytes, or null when it isn't set up or the render fails, so the caller can fall back to HTML.
export async function renderPdf(env, html, fetchImpl = fetch) {
  if (!env.BROWSER_TOKEN || !env.CF_ACCOUNT_ID) return null;
  try {
    const res = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/pdf`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.BROWSER_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ html, pdfOptions: { format: "letter", printBackground: true, preferCSSPageSize: true } }),
    });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.includes("pdf")) {
      console.log("lockdown: pdf render failed", res.status, type);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 500 || String.fromCharCode(...bytes.subarray(0, 4)) !== "%PDF") return null;
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  } catch (e) {
    console.log("lockdown: pdf render error", String(e));
    return null;
  }
}
