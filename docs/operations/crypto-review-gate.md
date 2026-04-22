# Crypto Review Gate

## Purpose

This gate defines the secure-crypto release review path required before the
phase-1 launch packet can be treated as launch-ready.

The default path is third-party crypto review. If no real external reviewer,
vendor, or contact path exists, the packet may instead rely on an explicit
internal launch exception that is recorded honestly and kept narrower than an
independent external verdict.

## Current Gate State

- Internal implementation work is complete enough to prepare a launch-review
  packet.
- Third-party crypto review is still pending and no real external reviewer,
  vendor, or contact path is currently recorded.
- The current phase-1 launch packet now uses the explicit internal launch
  exception recorded in `docs/operations/crypto-review-launch-exception.md`
  instead of pretending that external review has already happened.

## Current Review Target

- GitHub PR: `#59` `[codex] finalize unuvault phase-1 launch packet`
- PR URL: `https://github.com/unundoTeam/unuvault/pull/59`
- Current base branch: `main`
- Merge commit on `main`: `46ae0c655deef0ef15cb0cd180b4844a32cac43d`
- External review should anchor to the merged `main` state at or after that
  commit.

## External Review Status

- Reviewer or vendor: `pending`
- Review date: `pending`
- Verdict: `pending`
- Reviewed surfaces: `pending`
- Findings: `pending`
- Required remediation: `pending`
- Accepted follow-up limits: `pending`
- Launch checklist still matches the reviewed crypto boundary: `pending`

## Launch Exception Status

- Exception type:
  `internal operator-reviewed launch exception for missing third-party path`
- Decision owner of record: `yuchen`
- Decision date: `2026-04-22`
- Current decision: `accepted for the current phase-1 launch packet`
- Reason:
  `no real external reviewer, vendor, or contact path is currently recorded`
- Follow-up expectation:
  `replace or retire this exception when a real external review path exists`

## Completed Within This Slice

- Internal architecture review of the crypto boundary
- Updated helper contracts and compatibility posture
- Targeted tests for read, write, and failure behavior
- Documentation of residual risks and migration expectations

## Required Launch Packet Inputs

The following inputs must travel together for launch review:

- `docs/operations/third-party-crypto-review-request.md`
- `docs/operations/crypto-review-launch-exception.md`
- `docs/operations/secure-crypto-pr-audit-handoff.md`
- `docs/operations/crypto-legacy-smoke-checklist.md`
- the current phase-1 launch checklist under `docs/launch/phase1-launch-checklist.md`
- fresh repo-owned verification evidence for:
  - `bash scripts/testing/lint-runner.sh`
  - `bash scripts/testing/test-runner.sh`
  - `./node_modules/.bin/vitest --run ...` secure-crypto matrix
  - `bash scripts/testing/run-ios.sh` when the iPhone surface is in scope
- any additional launch-surface evidence recorded in
  `docs/launch/phase1-launch-checklist.md`
- any current repo-wide verification blocker discovered while refreshing the
  packet

## External Review Scope

- Review the CLI provider, web unlock paths, and browser extension read paths together
- Confirm failures are fail-closed and do not leak plaintext to stderr or logs
- Confirm new writes only emit the newest secure envelope formats
- Confirm any migration or remediation notes are captured before launch
- Reuse `docs/operations/crypto-legacy-smoke-checklist.md` for the manual legacy compatibility pass

## Expected Sign-Off Output

The external review output should record:

- reviewer identity or vendor plus review date
- verdict: `cleared`, `cleared with follow-up`, or `blocked`
- reviewed surfaces and call chains
- any findings, required remediation, or accepted follow-up limits
- confirmation that the launch checklist still matches the current crypto
  boundary

## Gate Clears When

One of the following review outcomes must be true, and the supporting packet
must stay current:

- third-party review of the crypto implementation and call chains is complete
  and recorded
- or the explicit launch exception in
  `docs/operations/crypto-review-launch-exception.md` is accepted and still
  matches the current reviewed target

In all cases, the following must also be true:

- legacy compatibility evidence is attached and still reflects the current
  secure boundary
- no new plaintext, XOR, or custom-hash write path remains on the active launch
  surface
- the launch checklist and audit handoff are updated consistently
- any blocking findings are resolved or an explicit launch exception is
  documented

## Notes

- This gate is narrower than a general incident or observability runbook
- It exists to separate internal implementation completion from external launch approval
- `docs/operations/third-party-crypto-review-request.md` is the sendable cover
  note for the external reviewer or vendor
- `docs/operations/crypto-review-launch-exception.md` is the honest fallback
  when no real external reviewer path exists yet
