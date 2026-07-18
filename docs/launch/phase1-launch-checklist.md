# unuvault Phase 1 Launch Checklist

Use this as the launch-facing packet checklist for phase-1 beta or rehearsal.
The packet is not clear while any item under `Pending Before Phase 1 Launch`
remains open. Items under `Carry-Forward Before GA/Public Launch` do not block
phase 1.

## Completed Evidence

- [x] The historical implementation-time internal crypto review is complete for
  the PR `#59` JavaScript client-side security boundary
- [x] `docs/operations/crypto-review-gate.md` preserves the historical PR `#59`
  internal iterative review and the explicit 2026-04-25 exception without
  extending either record to the later native/cross-platform boundary
- [x] A repo-backed internal preflight reply was recorded on `2026-04-23`, and
  the current phase-1 packet can rely on it for the internal sign-off boundary
- [x] `docs/operations/crypto-legacy-smoke-checklist.md` is complete for Web,
  browser extension, and CLI, with the result recorded in
  `docs/operations/secure-crypto-pr-audit-handoff.md` on 2026-04-18
- [x] `bash scripts/testing/lint-runner.sh` passed on 2026-04-21
- [x] `bash scripts/testing/test-runner.sh` passed on 2026-04-21
- [x] Focused secure-crypto regression matrix passed on 2026-04-21
- [x] Focused phase-1 surface matrix passed on 2026-04-21 via:
  `./node_modules/.bin/vitest --run apps/web/tests/security-page.spec.tsx apps/web/tests/import-page.spec.tsx apps/api/tests/imports.spec.ts apps/api/tests/devices.spec.ts apps/api/tests/activity.spec.ts apps/api/tests/vault-sync.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/autofill.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/packaging-build.spec.ts`
- [x] The focused phase-1 surface matrix confirmed:
  - security page trust entry points (`Devices`, `Recent activity`)
  - browser import UI plus the `/imports/browser` job-creation route
  - `/devices`, `/activity/recent`, and `/vault/sync` payload coverage
  - browser extension popup, autofill helpers, unlocked-vault reads, and the packaged bundle
- [x] `bash scripts/testing/run-ios.sh` passed on 2026-04-21 with the available
  `iPhone 17` simulator, covering iPhone login and AutoFill onboarding tests
- [x] `./node_modules/.bin/vitest --run apps/web/tests/login-page.spec.tsx apps/web/tests/register-page.spec.tsx`
  passed on 2026-04-21, pinning the current web onboarding trust explanations
- [x] `docs/help/account-recovery.md` and
  `docs/help/import-troubleshooting.md` were reviewed on 2026-04-21 before
  external testing
- [x] `docs/operations/incident-observability-authority.md` now gives phase-1
  launch packet readers one explicit incident / observability route without
  adding a new launch blocker
- [x] Real browser-extension page autofill smoke passed on 2026-04-25, covering
  generated MV3 `content_scripts`, the explicit popup autofill action, secure
  `vault-password` item unlock, and real DOM username/password fill on a local
  HTTP login page. Evidence is recorded in
  `docs/operations/secure-crypto-pr-audit-handoff.md`.
- [x] Hosted identity / production landing routing was rechecked on 2026-04-25:
  `docs/operations/runtime-authority.md` routes to the repo-local hosted-pass
  evidence and upstream
  `unuidentity/docs/operations/production-landing-completion.md`. This closes the
  checked-in production-landing route without publishing live hosted inventory,
  callback payloads, or secrets.
- [x] Minimal production-ops / observability closeout was recorded on
  2026-07-07 in
  `docs/operations/production-ops-observability-closeout.md`, covering the
  current phase-1 signal set, first-response owner, rehearsal checklist,
  launch-hold triggers, and upstream escalation route without claiming mature
  telemetry, formal on-call, automated alerting, or live secret publication.

## Pending Before Phase 1 Launch

- None. The current crypto-review carry-forward requirement lives under
  `Carry-Forward Before GA/Public Launch`.

## Carry-Forward Before GA/Public Launch

- Current preliminary cross-platform review verdict: `blocked`.
- [ ] Implement Pairing V2 target-claim authentication.
- [ ] Require fresh Mac owner authorization before the whole-vault snapshot
  read.
- [ ] Persist iOS replay rejection across app/process restart.
- [ ] Resolve the local bridge authorization bearer mismatch as a separate
  security boundary.
- [ ] Review the remediated cross-platform implementation against one exact
  merged `main` SHA.
- [ ] Obtain a real independent third-party verdict for the expanded scope
  before any independent-security or higher-risk public/paid launch claim.
- Historical PR `#59` clearance remains scoped to its recorded target at
  `46ae0c655deef0ef15cb0cd180b4844a32cac43d`; it does not clear the later
  native/cross-platform boundary.
- The 2026-04-25 third-party-review exception is historical. It does not convert
  the current expanded gate into a completed review.
- The repo-owned launch packet retains internal evidence and attempted external
  dispatch history, but no real independent verdict exists for the expanded
  scope.
- Full review detail lives in:
  - `docs/operations/crypto-review-gate.md`
  - `docs/operations/secure-crypto-pr-audit-handoff.md`
- This section tracks the GA/public-launch crypto approval boundary rather than
  the phase-1 beta or rehearsal gate.
- This checklist keeps the historical JavaScript clearance separate from the
  blocked expanded cross-platform gate.
- A sent third-party request without a real external verdict does not clear this
  checklist item.
- If the exact-target review returns `cleared with follow-up`, record the
  allowed launch limits in those gate docs before any current checklist item is
  treated as closed.

## Surface Map

- Web, browser extension, and sync surfaces should stay aligned with
  `docs/launch/phase1-qa-matrix.md` and the repo-owned JS verification path.
- Browser-extension real-page autofill now has repo-owned packaging tests and a
  manual Chrome for Testing smoke record; the content script is injected but
  only fills after an explicit extension trigger.
- iPhone login and AutoFill onboarding use `bash scripts/testing/run-ios.sh` as
  the current explicit launch gate.
- The web onboarding and security/trust-center surfaces now both have
  repo-owned proof in the launch packet.
- Hosted identity production-landing status is a routed authority question:
  current checked-in completion authority lives upstream, while future
  live-target changes must be recorded through the upstream consumer cutover
  checklist and repo-local verification before being called complete.
- Operational readiness for phase-1 or beta rehearsal now routes through
  `docs/operations/production-ops-observability-closeout.md`; it is a minimal
  closeout layer, not a mature telemetry or on-call program.
- If any surface-specific check stays blocked, record the gap in
  `docs/operations/secure-crypto-pr-audit-handoff.md` instead of silently
  treating the launch packet as complete.

## Launch Packet Attachments

- `docs/operations/third-party-crypto-review-request.md`
- `docs/operations/crypto-review-gate.md`
- `docs/operations/crypto-review-launch-exception.md`
- `docs/operations/secure-crypto-pr-audit-handoff.md`
- `docs/operations/crypto-legacy-smoke-checklist.md`
- `docs/launch/phase1-qa-matrix.md`
