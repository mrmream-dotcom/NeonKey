# Security Policy

Thank you for helping keep NeonKey and its visitors safe.

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public issue,
pull request, or discussion for a suspected vulnerability.

Use either of these channels:

- **GitHub private vulnerability reporting:** on this repository, open the
  **Security** tab and choose **Report a vulnerability**.
- **Email:** hello@neonkey.tech with the subject line `Security report`.

Please include:

- what is affected (URL, endpoint, or file),
- steps to reproduce or a proof of concept,
- the impact you believe it has, and
- whether you would like to be credited.

Do not include real personal data belonging to other people in a report.

## Scope

In scope:

- The website at https://neonkey.tech/ (including `www.neonkey.tech`).
- The Cloudflare Workers that back it: the AI inquiry triage demo
  (`neonkey-triage`) and the newsletter welcome email worker
  (`neonkey-welcome`).
- The source code and configuration in this repository.

Out of scope:

- Third-party services NeonKey uses (for example GitHub, GitHub Pages,
  Cloudflare, Kit, Resend, Web3Forms, Umami, Google Gemini). Please report
  issues in those services to the provider directly.
- Denial-of-service or load testing, spam, social engineering, physical
  attacks, and automated scanner output without a demonstrated impact.
- Missing best-practice headers or settings without a concrete exploit.

## Testing guidelines

- Only test against your own data and accounts.
- Stay within the triage demo's published rate limits; do not try to exhaust
  its daily quota or the AI provider's quota.
- Do not access, modify, or delete data that is not yours, and stop and
  report as soon as you find a way to do so.
- Give a reasonable amount of time to fix an issue before any public
  disclosure.

## What to expect

NeonKey is run by one person, so responses are best effort. The aim is to
acknowledge reports within a few business days and to keep you informed
about a fix, but no specific response or fix time is guaranteed.

There is **no bug bounty program**, and reports are not eligible for payment
or other rewards. If you would like credit, it can be given once the issue is
resolved, at the maintainer's discretion.

## Supported versions

Only the current production deployment (the `main` branch and the live
site) is supported.
