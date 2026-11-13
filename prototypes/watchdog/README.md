# Founder Watchdog prototype

**Not a Worker. Not deployed. Sends nothing, stores nothing.** A small engine that shows how Founder Watchdog would
turn daily DNS changes into plain-words alerts, built on the Lockdown audit engine. Design and gates:
`docs/founder-watchdog-mvp.md`.

```sh
npm test                      # 12 tests on synthetic .test domains, no network
npm run demo                  # a 7-day drift timeline and the alert each day would send
npm run own -- neonkey.tech   # live public DNS, only for NeonKey's own domains (anything else is refused)
```

- `src/engine.mjs`: `baseline()` (full Lockdown `audit()`, once), `snapshot()` (daily, known DKIM selectors only),
  `diff()`, `step()` (keeps the last known-good state so a record deleted and put back weaker is still caught),
  `confirmed()` (anti-flap), `ownershipRecord()` / `verifyOwnership()` (TXT proof at `_neonkey-watchdog.<domain>`),
  `renderAlert()`.
- `fixtures/timeline.mjs`: made-up domain `launchpad.test` drifting one change per day.

It imports `workers/lockdown/src/audit.js` in place to prove the reuse. A real Watchdog Worker would vendor its own
pinned copy, because Workers in this repo share nothing.
