# Secure Crypto PR And Audit Handoff

## Scope of Change

- Replace the weak shared crypto helpers in `packages/security` with one async sodium-backed core
- Upgrade new write formats to:
  - vault password envelope `v3`
  - master password verifier `v2`
  - developer secret blob `v2`
- Keep server API shape and storage keys unchanged while preserving legacy read compatibility
- Migrate Web, browser extension, and CLI call chains to explicit async crypto helpers
- Remove runtime-exported legacy write helpers so fixed test fixtures own the remaining weak sample generation

## Design / Requirement Link

- `docs/superpowers/plans/2026-04-14-unuvault-secure-crypto-phase1.md`
- `docs/architecture/0005-secure-password-crypto.md`
- `docs/operations/crypto-review-gate.md`
- `docs/operations/crypto-legacy-smoke-checklist.md`

## Launch Packet Status (2026-04-21)

This document is the secure-crypto launch-review packet for phase-1 beta or
rehearsal, and the handoff packet for the later independent review.

- Internal crypto evidence is attached below and remains reusable.
- The reviewer request packet is now assembled and ready for external dispatch.
- Independent third-party crypto review is still pending, so GA/public-launch
  crypto approval is not yet cleared.
- Phase-1 beta/rehearsal now relies on the repo-owned packet plus the recorded
  internal preflight reply below.
- The packet refresh on 2026-04-21 now has fresh repo-owned verification
  evidence for lint, repo-wide tests, focused secure-crypto coverage, the
  iOS gate, and the phase-1 Web/API/browser-extension surface checks.
- The launch packet now has repo-owned proof for the current web
  login/register trust-copy surface as well.
- GitHub metadata checked on `2026-04-21` shows PR `#59` merged on `main`, but
  no PR review or issue-comment artifact is recorded there for the required
  external crypto verdict.

## Current Review Target

- GitHub PR: `#59` `[codex] finalize unuvault phase-1 launch packet`
- PR URL: `https://github.com/unundoTeam/unuvault/pull/59`
- Current base branch: `main`
- Merge commit on `main`: `46ae0c655deef0ef15cb0cd180b4844a32cac43d`
- Use the merged `main` state at or after that commit as the review target for
  the independent crypto verdict.

## External Review Dispatch Record

Fill this as soon as the request leaves the repo so the packet can distinguish
between `not sent yet` and `sent, waiting for verdict`.

- Request packet status: `ready to send`
- Request owner: `yuchen`
- Reviewer or vendor: `pending`
- Contact path: `pending`
- Sent date: `pending`
- Requested reply date: `pending`
- Tracking link: `pending`
- Recording owner for repo updates: `yuchen`

Sending the packet does not clear the launch gate by itself. Keep the
`External Review Result` section below at `pending` until the reviewer returns a
real verdict.
Do not fill `Contact path` or `Tracking link` with repo-local docs, PR URLs, or
launch-packet references alone. Those can support the review, but they do not
prove the request reached a real external reviewer or vendor queue.

## External Review Result
- Reviewer or vendor: `pending`
- Review date: `pending`
- Verdict: `pending`
- Reviewed surfaces: `pending`
- Findings: `pending`
- Required remediation: `pending`
- Accepted follow-up limits: `pending`
- Launch checklist still matches the reviewed crypto boundary: `pending`

As of `2026-04-23`, the checked-in packet still has no independent third-party
verdict attached. GitHub review metadata checked on `2026-04-21` also records
no PR review or issue-comment artifact that can serve as the required external
crypto verdict. The remaining blocker now applies to GA/public launch rather
than the current phase-1 beta/rehearsal packet.

## Recorded Thread Reply (2026-04-23)

The review thread now has one recorded reply, but it is a repo-backed internal
preflight note rather than an independent third-party crypto verdict.

The original reply wording still used the older phase-1 blocker framing. Under
the current launch policy, treat that unresolved requirement as the
GA/public-launch independent review gate.

- Reply type: `repo-backed internal preflight`
- Reviewer: `chen yu (repo-backed internal preflight, not independent third-party)`
- Review date: `2026-04-23`
- Verdict: `blocked`
- Reviewed surfaces:
  - shared helper layer in `packages/security`
  - CLI developer-secret read/import paths
  - browser-extension verifier/unlock/autofill-read packet evidence
  - web verifier/storage and launch-packet evidence for unlock/reveal/copy/rewrite paths
- Findings:
  - no blocker found in the repo-owned secure-crypto helper layer, secure write
    formats, verifier upgrade rules, or CLI failure handling
  - legacy compatibility evidence in the launch packet still matches the
    current secure boundary
  - this reply is not an independent third-party review verdict
  - current web/popup/login jsdom reruns are blocked by a local Vitest
    matcher-harness issue, so those UI-facing packet proofs remain
    packet-backed rather than freshly rerun in this reply
- Required remediation:
  - obtain a real independent third-party crypto review before GA/public launch
    or before claiming independent crypto approval
  - refresh the local jsdom matcher harness and rerun the UI-facing packet
    suites if fresh local UI evidence is required before dispatch
- Accepted follow-up limits:
  - repo-owned internal evidence can continue to travel in the launch packet as
    supporting material
  - phase-1 beta/rehearsal can proceed without a third-party verdict, but
    GA/public launch stays blocked until a real independent reviewer records one
- Launch checklist still matches the reviewed crypto boundary: `yes`

This recorded reply is enough to document the current internal sign-off
boundary for phase 1. It does not clear the independent GA/public-launch review
gate.

## Verification Commands

- `bash scripts/testing/lint-runner.sh`
- `bash scripts/testing/test-runner.sh`
- `bash scripts/testing/run-ios.sh`
- `./node_modules/.bin/vitest --run packages/security/tests/sodium.spec.ts packages/security/tests/vault-envelope.spec.ts packages/security/tests/master-password-verifier.spec.ts packages/security/tests/developer-secret-envelope.spec.ts apps/web/tests/security-sodium-runtime.spec.ts apps/web/tests/master-password-storage.spec.ts apps/web/tests/vault-page.spec.tsx apps/browser-extension/tests/security-sodium-runtime.spec.ts apps/browser-extension/tests/master-password-storage.spec.ts apps/browser-extension/tests/background-unlock.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/packaging-build.spec.ts tests/dev-secrets-provider.spec.ts`
- `./node_modules/.bin/vitest --run apps/web/tests/security-page.spec.tsx apps/web/tests/import-page.spec.tsx apps/api/tests/imports.spec.ts apps/api/tests/devices.spec.ts apps/api/tests/activity.spec.ts apps/api/tests/vault-sync.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/autofill.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/packaging-build.spec.ts`
- `./node_modules/.bin/vitest --run apps/web/tests/login-page.spec.tsx apps/web/tests/register-page.spec.tsx`

## Packet Refresh Result (2026-04-21)

- `bash scripts/testing/lint-runner.sh` passed on 2026-04-21
- `bash scripts/testing/test-runner.sh` passed on 2026-04-21
- Focused secure-crypto matrix passed on 2026-04-21
- Focused phase-1 surface matrix passed on 2026-04-21, covering:
  - Web trust-center entry points on the security page
  - browser import entry UI plus `/imports/browser`
  - `/devices`, `/activity/recent`, and `/vault/sync`
  - browser extension popup, autofill helpers, unlocked-vault reads, and packaging
- `bash scripts/testing/run-ios.sh` passed on 2026-04-21 using the available
  `iPhone 17` simulator:
  - `AutofillOnboardingViewTests.testAutofillOnboardingShowsEnableAutofill`
  - `LoginViewTests.testLoginViewShowsSecureSyncMessage`
- Focused onboarding trust-copy matrix passed on 2026-04-21, pinning the
  current login/register launch copy
- `docs/help/account-recovery.md` and
  `docs/help/import-troubleshooting.md` were reviewed on 2026-04-21 before
  external testing
- Manual legacy smoke checklist was not rerun in this packet refresh; the
  current launch packet still uses the completed 2026-04-18 manual smoke
  evidence below

## Historical Secure-Crypto Evidence (2026-04-18)

- Weak-path sweep on 2026-04-18 confirmed no production caller still depends on exported legacy write helpers
- Hosted local-development Supabase refs were `NXDOMAIN` on 2026-04-18, so manual smoke was rerun against the local dual-stack fallback:
  - shared identity stack at `http://127.0.0.1:54331`
  - local unuvault product stack at `http://127.0.0.1:54341`
- Extension manual smoke was rerun on 2026-04-18:
  - seeded `chrome.storage.local["unuvault.extension.master-password-verifier"]` with the fixed `v1` verifier sample
  - seeded `chrome.storage.local["unuvault.extension.popup-vault-items"]` with the fixed legacy plaintext sample
  - unlock succeeded with `LEGACY_FIXTURE_MASTER_PASSWORD`
  - reveal and copy both returned `hunter2`
  - lock and unlock again restored the default hidden state until reveal
  - wrong-password retry with `LEGACY_FIXTURE_WRONG_MASTER_PASSWORD` failed closed and surfaced `Wrong master password`
  - stored verifier rewrote to `version: 2` with `algorithm: "argon2id13"`
  - after reseeding `LEGACY_FIXTURE_VAULT_ENVELOPE_V2` with the correct `VaultSyncItem.encrypted_payload` shape, the popup loaded the item and copy returned `hunter2`
- Web manual smoke was rerun on 2026-04-18:
  - created a local smoke account through the local `unuidentity` stack and completed `/auth/finalize -> POST /auth/bootstrap`
  - seeded one signed-in vault item with legacy plaintext `password_ciphertext: "hunter2"`
  - seeded `localStorage["unuvault.web.master-password-verifier"]` with the fixed `v1` verifier sample
  - unlock succeeded with `LEGACY_FIXTURE_MASTER_PASSWORD`
  - reveal and copy both returned `hunter2`
  - saving the unchanged legacy item rewrote `password_ciphertext` to JSON with:
    - `version: 3`
    - `cipher: "xchacha20poly1305-ietf"`
    - `keyDerivation: "argon2id13"`
    - `purpose: "vault-password"`
  - Chrome local storage rewrote `unuvault.web.master-password-verifier` to `version: 2` with `algorithm: "argon2id13"`
  - wrong-password retry with `LEGACY_FIXTURE_WRONG_MASTER_PASSWORD` failed closed and surfaced `Wrong master password`
- CLI dev-secrets smoke was rerun on 2026-04-18:
  - seeded `developer_secret_records` with the fixed `v1` blob for `unundo/local/dotenv`
  - `runDevSecretsProvider(["read", "--app", "unundo", "--env", "local"])` returned exit `0`
  - success-path `stdout` contained only dotenv plaintext
  - success-path `stderr` stayed empty
  - wrong-password read returned exit `1` with `stderr: decrypt_failed`
  - wrong-password `stdout` stayed empty and did not leak any dotenv line
  - `runDevSecretsProvider(["import", "--app", "unundo", "--env", "local", "--from", ...])` returned exit `0`
  - import-path `stderr` contained only the safe target/source/size/SHA256 summary
  - stored ciphertext rewrote to JSON with:
    - `version: 2`
    - `cipher: "xchacha20poly1305-ietf"`
    - `keyDerivation: "argon2id13"`
    - `purpose: "developer-secret-blob"`
- Manual legacy smoke checklist is complete for Web, browser extension, and CLI on 2026-04-18

## Docs Impact

- ADR added for the secure crypto boundary
- Internal crypto review gate added
- Launch checklist updated to separate internal completion from third-party audit gate
- Fixed legacy fixture set and manual smoke checklist added for review and audit reuse
- Runtime code now keeps legacy read compatibility without exporting weak helper writers for production reuse

## Risks

- Independent third-party security review is still required before GA/public
  launch
- Legacy compatibility depends on user activity to trigger reseal of old values
- Observability and incident runbook expansion are intentionally not part of this slice

## Rollback Notes

- Do not blindly revert to the pre-migration runtime after new `v3` or `v2` writes have been emitted
- A safe backout path must preserve readers for the new secure formats while stopping additional rollout if needed
- If a rollback is required after rollout begins, prefer a follow-up compatibility patch over reverting to the old weak-helper implementation

## Cross-Repo Impact

- No server API or database schema change
- No browser storage key rename
- No CLI flag or target-shape change
- External audit vendor or reviewer should inspect Web, extension, and CLI call chains together because they now share one crypto substrate

## Launch Packet Attachments

- Algorithm and compatibility ADR: `docs/architecture/0005-secure-password-crypto.md`
- Sendable reviewer request: `docs/operations/third-party-crypto-review-request.md`
- Internal review gate: `docs/operations/crypto-review-gate.md`
- Fixed legacy samples: `tests/fixtures/crypto-legacy-fixtures.ts`
- Manual legacy smoke path: `docs/operations/crypto-legacy-smoke-checklist.md`
- Focused regression evidence from security, Web, extension, and CLI suites
- Phase-1 launch checklist: `docs/launch/phase1-launch-checklist.md`

## Reviewer Watchpoints

- Verify all new writes emit only secure versions
- Verify legacy verifier upgrade happens after successful unlock
- Verify CLI failure paths do not leak plaintext to `stderr`
- Verify render-time decrypt paths were removed from Web and popup surfaces
