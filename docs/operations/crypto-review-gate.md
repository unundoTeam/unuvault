# Crypto Review Gate

## Purpose

This gate defines the repo-backed internal iterative crypto review required for
the current `unuvault` launch path. The previous independent third-party crypto
review requirement is now explicitly deferred through
`docs/operations/crypto-review-launch-exception.md`.

This gate does not allow `unuvault` to claim that the crypto boundary is
independently reviewed or third-party reviewed.

## Current Gate State

- Internal implementation work is complete enough to run a launch-facing review
  loop.
- Repo-backed internal preflight and follow-up confirmation replies are recorded
  for the packet.
- The attempted third-party request path did not produce a real independent
  reviewer or vendor verdict.
- The decision owner approved replacing the current third-party requirement with
  an internal iterative review gate on `2026-04-25`.
- Current internal iterative review status: `cleared for current scope`.
- Third-party crypto review status: `deferred by explicit launch exception`.

## Current Review Target

- GitHub PR: `#59` `[codex] finalize unuvault phase-1 launch packet`
- PR URL: `https://github.com/unundoTeam/unuvault/pull/59`
- Current base branch: `main`
- Merge commit on `main`: `46ae0c655deef0ef15cb0cd180b4844a32cac43d`
- The internal iterative review should anchor to the merged `main` state at or
  after that commit, plus any later commits that update this gate or review
  evidence.

## Internal Iterative Review Status

- Review loop status: `completed for current scope`
- Reviewer: `Codex repo-backed review loop`
- Review date: `2026-04-25`
- Verdict: `internal iterative review cleared for current scope`
- Reviewed surfaces:
  - shared helper layer in `packages/security`
  - Web unlock, reveal, copy, and secure rewrite paths
  - browser extension unlock, popup read, autofill-read paths, and packaged
    content-script autofill trigger wiring
  - CLI developer-secret read/import paths
  - launch packet authority and legacy compatibility evidence
- Findings:
  - `packages/security/src/developer-secret-envelope.ts` accepted any secure
    envelope purpose string for developer-secret reads instead of requiring
    `developer-secret-blob`
  - `apps/browser-extension/src/background/runtime.ts` accepted autofill
    candidate page origin from request body instead of binding the read to the
    trusted content-script caller URL
  - no additional blocker was found in active Web writes, extension popup reads,
    CLI stdout/stderr behavior, or legacy compatibility evidence after
    remediation
- Required remediation:
  - developer-secret secure-envelope reads now require
    `purpose: "developer-secret-blob"` before decrypting
  - autofill candidate reads now derive the origin from trusted content caller
    context and fail closed for popup/internal callers
  - focused regression tests were added for both remediations
  - packaged browser-extension autofill now has generated `content_scripts`,
    explicit popup-to-content trigger coverage, and real-page Chrome smoke
    evidence recorded in `docs/operations/secure-crypto-pr-audit-handoff.md`
- Accepted follow-up limits:
  - third-party crypto review remains deferred, not completed
  - public copy must not claim the crypto boundary is independently reviewed or
    third-party reviewed
  - browser-extension page autofill remains an explicit extension trigger, not
    automatic page-load fill
  - manual legacy smoke remains the attached `2026-04-18` evidence because this
    review did not change legacy reader formats or storage keys
- Launch checklist still matches the reviewed crypto boundary: `yes`

As of `2026-04-25`, the replacement internal iterative review loop has completed
for the current scope. It does not create an independent third-party verdict.

## Third-Party Review Deferral

- Deferral authority: `docs/operations/crypto-review-launch-exception.md`
- Deferral date: `2026-04-25`
- Decision owner: `yuchen`
- External request status: `sent but not resolved into a real independent
  verdict`
- External contact path attempted: `email to fengzhendeyu@gmail.com; subject:
  unuvault crypto review request: phase-1 secure crypto boundary for
  GA/public-launch approval`
- GitHub metadata audit on `2026-04-25`: no PR reviews or issue comments on
  `unundoTeam/unuvault#59` can be treated as an external crypto verdict.
- Result: third-party crypto review is deferred, not completed.

## Recorded Thread Reply (2026-04-23)

- Reply type: `repo-backed internal preflight`
- Reviewer: `chen yu (repo-backed internal preflight, not independent third-party)`
- Review date: `2026-04-23`
- Verdict: `blocked`
- Launch checklist still matches the reviewed crypto boundary: `yes`
- Gate effect: `supports phase-1 beta/rehearsal sign-off, but did not clear the
  GA/public-launch review gate before the 2026-04-25 deferral decision`

The recorded reply confirms that repo-owned supporting evidence can continue to
travel with the launch packet. The reply itself used the older phase-1 blocker
framing.

## Recorded Thread Reply (2026-04-25)

- Reply type: `repo-backed internal confirmation`
- Reviewer: `Codex (repo-backed internal confirmation, not independent third-party)`
- Review date: `2026-04-25`
- Verdict: `blocked`
- Launch checklist still matches the reviewed crypto boundary: `yes, for the
  request and packet framing reviewed here; no independent crypto approval is
  granted by this reply`
- Gate effect: `supports packet tracking only; does not clear crypto review by
  itself`

The follow-up reply confirms the request and packet framing after dispatch. It
does not independently verify the cryptographic implementation and cannot be
treated as a third-party verdict.

## Completed Within This Slice

- Internal architecture review of the crypto boundary
- Updated helper contracts and compatibility posture
- Targeted tests for read, write, and failure behavior
- Documentation of residual risks and migration expectations

## Required Internal Review Inputs

The following inputs must travel together for the internal iterative review
loop:

- `docs/operations/secure-crypto-pr-audit-handoff.md`
- `docs/operations/crypto-review-launch-exception.md`
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

## Internal Review Scope

- Review the CLI provider, web unlock paths, and browser extension read paths together
- Confirm failures are fail-closed and do not leak plaintext to stderr or logs
- Confirm new writes only emit the newest secure envelope formats
- Confirm any migration or remediation notes are captured before launch
- Reuse `docs/operations/crypto-legacy-smoke-checklist.md` for the manual legacy
  compatibility pass

## Expected Internal Review Output

The internal iterative review output should record:

- reviewer identity plus review date
- verdict: `internal iterative review cleared for current scope`,
  `cleared with follow-up`, or `blocked`
- reviewed surfaces and call chains
- any findings, required remediation, or accepted follow-up limits
- confirmation that the launch checklist still matches the current crypto
  boundary

Use `docs/operations/secure-crypto-pr-audit-handoff.md` to record each review
pass and any remediation. Copy the final current-scope result back into this
gate.

## Gate Clears For GA/Public Launch When

All of the following are true:

- the internal iterative review loop has completed with no unresolved blockers
- legacy compatibility evidence is attached and still reflects the current
  secure boundary
- no new plaintext, XOR, or custom-hash write path remains on the active launch
  surface
- the launch checklist and audit handoff are updated consistently
- any blocking findings are resolved or an explicit launch exception is
  documented
- third-party review remains deferred under
  `docs/operations/crypto-review-launch-exception.md`
- no outward-facing copy claims that the crypto boundary is independently
  reviewed

## Re-Trigger Conditions For Third-Party Review

Follow `docs/operations/crypto-review-launch-exception.md` when deciding whether
a real independent reviewer or vendor must be reopened. The short rule is:
large-scale public risk, paid/enterprise/compliance claims, material crypto
boundary changes, or crypto incidents should reopen real third-party review.

## Notes

- This gate is narrower than a general incident or observability runbook.
- It exists to separate internal implementation completion from current-scope
  launch approval.
- `docs/operations/third-party-crypto-review-request.md` remains available only
  if a real external reviewer path is reopened under the re-trigger conditions
  in `docs/operations/crypto-review-launch-exception.md`.
