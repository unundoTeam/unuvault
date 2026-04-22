# Crypto Review Launch Exception

## Purpose

This document records the explicit phase-1 launch exception used when
`unuvault` does not yet have a real third-party crypto reviewer, vendor, or
contact path of record.

It exists so the launch packet can stay honest:

- third-party review remains pending
- internal operators are not mislabeled as an external reviewer or vendor
- any temporary waiver is scoped, reviewable, and reversible

## Current Exception Status (2026-04-22)

- Third-party crypto review remains pending.
- No real external reviewer, vendor, or contact path is currently recorded in
  the launch packet.
- Phase 1 currently relies on this explicit internal launch exception rather
  than claiming that third-party review has been completed.

## Decision Owner And Review Target

- Decision owner of record: `yuchen`
- Decision date: `2026-04-22`
- Review target:
  - GitHub PR: `#59` `[codex] finalize unuvault phase-1 launch packet`
  - PR URL: `https://github.com/unundoTeam/unuvault/pull/59`
  - Current base branch: `main`
  - Merge commit on `main`: `46ae0c655deef0ef15cb0cd180b4844a32cac43d`
- Scope covered by this exception:
  - Web unlock, reveal, copy, and secure rewrite paths
  - browser extension unlock, popup read, and autofill-read paths
  - CLI developer-secret read/import paths
  - the shared helper layer in `packages/security`

## Why The Exception Exists

- The current launch packet does not have a real external reviewer or vendor.
- Rewriting an internal operator, repo author, or Codex session as a
  third-party reviewer would be false.
- The launch packet already contains the repo-owned verification and manual
  compatibility evidence needed to make a narrower internal release decision.

## Evidence Reused By This Exception

- `docs/operations/secure-crypto-pr-audit-handoff.md`
- `docs/operations/crypto-review-gate.md`
- `docs/operations/crypto-legacy-smoke-checklist.md`
- `docs/launch/phase1-launch-checklist.md`
- `docs/launch/phase1-qa-matrix.md`
- `docs/architecture/0005-secure-password-crypto.md`
- `bash scripts/testing/lint-runner.sh` passed on `2026-04-21`
- `bash scripts/testing/test-runner.sh` passed on `2026-04-21`
- focused secure-crypto regression matrix passed on `2026-04-21`
- focused phase-1 surface matrix passed on `2026-04-21`
- focused onboarding trust-copy matrix passed on `2026-04-21`
- `bash scripts/testing/run-ios.sh` passed on `2026-04-21`
- manual legacy smoke evidence for Web, browser extension, and CLI was last
  refreshed on `2026-04-18`

## Accepted Risk And Limits

- This is not an independent third-party security verdict.
- This exception only covers the merged `main` review target described above.
- Any material crypto-boundary change after that target should force this
  exception to be re-reviewed instead of silently carried forward.
- Any crypto, unlock, or developer-secret incident should reopen the release
  decision instead of treating this waiver as permanent.
- Any future real external reviewer path should supersede this exception.

## Result

- For the current phase-1 launch packet, the secure-crypto release gate is
  satisfied through this explicit internal launch exception.
- Third-party crypto review remains deferred, not completed.
- No new external contact path, vendor assignment, secret rotation, or wider
  launch approval is implied by this exception alone.
