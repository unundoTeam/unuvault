# Crypto Review Gate

## Purpose

This gate defines the independent crypto review required before the secure
crypto slice can be treated as GA/public-launch ready. It is no longer the
phase-1 beta or rehearsal blocker.

## Current Gate State

- Internal implementation work is complete enough to prepare a launch-review
  packet.
- The launch-review packet is assembled and ready for external dispatch.
- A repo-backed internal preflight reply is now recorded for the current
  phase-1 beta/rehearsal packet.
- Independent third-party crypto review is still pending, so the GA/public-launch
  gate is not yet cleared.
- Any independent reviewer verdict and required follow-up still need to be
  recorded in the launch packet before GA/public launch or before representing
  the crypto boundary as independently reviewed.

## Current Review Target

- GitHub PR: `#59` `[codex] finalize unuvault phase-1 launch packet`
- PR URL: `https://github.com/unundoTeam/unuvault/pull/59`
- Current base branch: `main`
- Merge commit on `main`: `46ae0c655deef0ef15cb0cd180b4844a32cac43d`
- External review should anchor to the merged `main` state at or after that
  commit.

## Independent Review Status

- Request packet status: `ready to send`
- Reviewer or vendor: `pending`
- Review date: `pending`
- Verdict: `pending`
- Reviewed surfaces: `pending`
- Findings: `pending`
- Required remediation: `pending`
- Accepted follow-up limits: `pending`
- Launch checklist still matches the reviewed crypto boundary: `pending`

As of `2026-04-23`, no independent third-party verdict is recorded in the
checked-in launch packet yet. The thread does have a repo-backed internal
preflight reply, but the remaining blocker now applies to GA/public launch, not
to the current phase-1 beta/rehearsal packet.

## Recorded Thread Reply (2026-04-23)

- Reply type: `repo-backed internal preflight`
- Reviewer: `chen yu (repo-backed internal preflight, not independent third-party)`
- Review date: `2026-04-23`
- Verdict: `blocked`
- Launch checklist still matches the reviewed crypto boundary: `yes`
- Gate effect: `supports phase-1 beta/rehearsal sign-off, but does not clear the independent GA/public-launch review requirement`

The recorded reply confirms that repo-owned supporting evidence can continue to
travel with the launch packet. The reply itself used the older phase-1 blocker
framing, but the current launch policy now carries that unresolved requirement
forward as the GA/public-launch independent review gate.

## Completed Within This Slice

- Internal architecture review of the crypto boundary
- Updated helper contracts and compatibility posture
- Targeted tests for read, write, and failure behavior
- Documentation of residual risks and migration expectations

## Required Launch Packet Inputs

The following inputs must travel together for launch review:

- `docs/operations/third-party-crypto-review-request.md`
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

## Gate Clears For GA/Public Launch When

All of the following are true:

- independent third-party review of the crypto implementation and call chains is
  complete
- legacy compatibility evidence is attached and still reflects the current
  secure boundary
- no new plaintext, XOR, or custom-hash write path remains on the active launch
  surface
- the launch checklist and audit handoff are updated consistently
- any blocking findings are resolved or an explicit launch exception is
  documented

## Notes

- This gate is narrower than a general incident or observability runbook
- It exists to separate internal implementation completion from independent
  GA/public-launch approval
- `docs/operations/third-party-crypto-review-request.md` is the sendable cover
  note for the external reviewer or vendor
