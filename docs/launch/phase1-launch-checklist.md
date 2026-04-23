# unuvault Phase 1 Launch Checklist

Use this as the launch-facing packet checklist for phase-1 beta or rehearsal.
The packet is not clear while any item under `Pending Before Phase 1 Launch`
remains open. Items under `Carry-Forward Before GA/Public Launch` do not block
phase 1.

## Completed Evidence

- [x] Internal crypto review is complete for the client-side security boundary
- [x] `docs/operations/crypto-review-gate.md` now matches the current launch
  policy and treats independent review as a GA/public-launch carry-forward gate
  rather than a phase-1 beta blocker
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

## Pending Before Phase 1 Launch

- None. The independent third-party crypto review requirement now lives under
  `Carry-Forward Before GA/Public Launch`.

## Carry-Forward Before GA/Public Launch

- [ ] Independent third-party crypto review is cleared and recorded according to
  `docs/operations/crypto-review-gate.md`
- The repo-owned launch packet is assembled and ready for independent review
  dispatch.
- Full reviewer detail lives in:
  - `docs/operations/crypto-review-gate.md`
  - `docs/operations/secure-crypto-pr-audit-handoff.md`
- This section tracks the GA/public-launch crypto approval boundary rather than
  the phase-1 beta or rehearsal gate.

## Surface Map

- Web, browser extension, and sync surfaces should stay aligned with
  `docs/launch/phase1-qa-matrix.md` and the repo-owned JS verification path.
- iPhone login and AutoFill onboarding use `bash scripts/testing/run-ios.sh` as
  the current explicit launch gate.
- The web onboarding and security/trust-center surfaces now both have
  repo-owned proof in the launch packet.
- If any surface-specific check stays blocked, record the gap in
  `docs/operations/secure-crypto-pr-audit-handoff.md` instead of silently
  treating the launch packet as complete.

## Launch Packet Attachments

- `docs/operations/third-party-crypto-review-request.md`
- `docs/operations/crypto-review-gate.md`
- `docs/operations/secure-crypto-pr-audit-handoff.md`
- `docs/operations/crypto-legacy-smoke-checklist.md`
- `docs/launch/phase1-qa-matrix.md`
