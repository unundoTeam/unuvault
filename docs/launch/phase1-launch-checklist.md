# unuvault Phase 1 Launch Checklist

Use this as the launch-facing packet checklist for phase-1 beta or rehearsal.
The packet is not clear while any item under `Pending Before Phase 1 Launch`
remains open. Items under `Carry-Forward Before GA/Public Launch` do not block
phase 1.

## Completed Evidence

- [x] Implementation-time internal crypto review is complete for the client-side
  security boundary
- [x] `docs/operations/crypto-review-gate.md` now matches the current launch
  policy and treats the current GA/public-launch crypto gate as an internal
  iterative review loop with third-party review explicitly deferred by
  `docs/operations/crypto-review-launch-exception.md`
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

## Pending Before Phase 1 Launch

- None. The current crypto-review carry-forward requirement lives under
  `Carry-Forward Before GA/Public Launch`.

## Carry-Forward Before GA/Public Launch

- [x] Internal iterative crypto review loop is completed and recorded according
  to `docs/operations/crypto-review-gate.md`
- Third-party crypto review is deferred under
  `docs/operations/crypto-review-launch-exception.md`, not completed.
- The repo-owned launch packet has internal evidence and attempted external
  dispatch history, but no real independent verdict.
- Full review detail lives in:
  - `docs/operations/crypto-review-gate.md`
  - `docs/operations/secure-crypto-pr-audit-handoff.md`
- This section tracks the GA/public-launch crypto approval boundary rather than
  the phase-1 beta or rehearsal gate.
- This checklist tracks that the current internal iterative crypto gate is
  cleared for the current scope.
- A sent third-party request without a real external verdict does not clear this
  checklist item.
- If the internal iterative review returns `cleared with follow-up`, record the
  allowed launch limits in those gate docs before this checklist item is treated
  as closed.

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
