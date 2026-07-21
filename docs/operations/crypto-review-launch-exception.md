# Crypto Review Launch Exception

## Purpose

This document preserves the explicit 2026-04-25 crypto-review policy exception
for its historical PR `#59` target. It is not a standing exception for later
native/cross-platform crypto boundaries.

It exists so the launch packet can stay honest:

- third-party review is deferred, not completed
- Codex, repo authors, and internal operators are not mislabeled as external
  reviewers or vendors
- any waiver is scoped, reviewable, and reversible
- the replacement gate is an explicit internal review/fix/review loop, not a
  silent removal of crypto review

## Historical Exception Status (2026-04-25)

- Third-party crypto review is deferred under this exception.
- No real external reviewer, vendor, or third-party verdict is currently
  recorded in the launch packet.
- The recorded Phase 1 and bounded launch decision relied on the internal
  iterative crypto review gate in `docs/operations/crypto-review-gate.md` for
  the exact historical target below.
- The product must not claim that the crypto boundary is independently reviewed
  unless a real external reviewer or vendor later returns a verdict.

## Decision Owner And Review Target

- Decision owner of record: `yuchen`
- Decision date: `2026-04-25`
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

This historical exception does not authorize the later native/cross-platform boundary.
It also does not authorize Pairing V2, whole-product security,
independent-security, paid/public-launch, or future exact-target review claims.

## Why The Exception Exists

- The current launch path has no real external reviewer or vendor.
- Rewriting an internal operator, repo author, or Codex session as a
  third-party reviewer would be false.
- The launch packet already contains the repo-owned verification and manual
  compatibility evidence needed to make a narrower internal release decision.
- The active operating model is owner plus Codex, so the honest replacement is
  repeated repo-backed review, remediation, and re-review until no blocker is
  found in the current scope.

## Replacement Gate

The replacement gate is:

1. Codex performs a repo-backed crypto review of the current scope.
2. Any blocker is fixed in the repo, with focused tests or evidence added where
   practical.
3. Verification is rerun.
4. Codex reviews again.
5. The loop repeats until the current scoped review has no unresolved blocker.

The historical result may remain recorded as `internal iterative review cleared
for current scope`, where "current scope" means the recorded PR `#59` target at
the time of the decision. It must not be expanded or described as
`independently reviewed` or `third-party reviewed`.

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
- Pairing V2 and the later Mac/iOS native substrate are material
  crypto-boundary changes after that target; this exception cannot be silently
  carried forward to them.
- Any renewed exception must name the one exact merged implementation SHA it
  covers and follow the new exact-target cross-platform review.
- Any crypto, unlock, or developer-secret incident should reopen the release
  decision instead of treating this waiver as permanent.
- Any future real external reviewer path should supersede this exception.
- Public-facing copy, release notes, or marketing must not imply independent
  crypto approval.

## Re-Trigger Conditions For Third-Party Review

A real independent third-party crypto review should be reopened before any of
these changes:

- storing broad real-user production password data beyond the current bounded
  launch scope
- paid or large-scale public launch
- enterprise, compliance, or procurement claims about independent security
  review
- material changes to crypto algorithms, envelope formats, key derivation,
  unlock policy, extension autofill trust boundaries, or CLI secret handling
- any incident involving plaintext exposure, key handling, unlock bypass, or
  legacy-format migration

## Result

- For the historical PR `#59` phase-1 launch packet, the third-party
  crypto-review requirement was deferred through this explicit exception.
- The expanded native/cross-platform security gate is blocked pending
  remediation and one exact-target re-review.
- Independent third-party review for the expanded scope is not dispatched.
- No new external contact path, vendor assignment, secret rotation, or wider
  launch approval is implied by this exception alone.
