#!/usr/bin/env bash
# Builds the site and copies ONLY the draft receipt-sorter page (plus the CSS/JS/icons it needs) into ./preview,
# which `wrangler deploy` serves as static assets on the Worker's workers.dev URL for private phone testing.
# Every other path on that URL redirects to https://neonkey.tech (see src/index.js). The page is noindex,
# _headers adds X-Robots-Tag, and /robots.txt disallows everything.
set -euo pipefail
cd "$(dirname "$0")/../../.."          # repo root
PUBLIC_SITE_MODE=live npm run build >/dev/null
out=workers/receipts/preview
rm -rf "$out" && mkdir -p "$out/lab/receipt-sorter" "$out/_astro" "$out/js"
cp dist/lab/receipt-sorter/index.html "$out/lab/receipt-sorter/"
for f in $(grep -oE '/_astro/[^"]+' dist/lab/receipt-sorter/index.html | sort -u); do cp "dist$f" "$out$f"; done
for f in favicon.svg favicon-32x32.png apple-touch-icon.png site.webmanifest js/gtag-init.js; do [ -f "dist/$f" ] && cp "dist/$f" "$out/$f"; done
printf '/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: strict-origin-when-cross-origin\n' > "$out/_headers"
echo "preview built in $out ($(find "$out" -type f | wc -l) files)"
