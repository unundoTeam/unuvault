# Crypto Review Gate

## Purpose

This gate separates the historical PR `#59` JavaScript review record from the
current expanded native/cross-platform security boundary. Historical internal
clearance and its 2026-04-25 exception remain evidence for their exact target;
they do not clear Pairing V2 or the later Mac/iOS boundary.

This gate does not allow `unuvault` to claim that the crypto boundary is
independently reviewed or third-party reviewed.

## Current Gate State

- Current cross-platform internal review status: `blocked pending remediation and exact-target re-review`
- Bounded Argon2 checkpoint: `resolved`
- Pairing target-claim authentication: `pending on main`
- Fresh Mac owner authorization: `pending on main`
- Restart-persistent iOS replay rejection: `pending on main`
- Local bridge authorization: `separate open blocker`
- Exact merged implementation SHA: `not yet assigned`
- Independent third-party review for the expanded scope: `not dispatched`

The current gate requires remediation of the four implementation/security
blockers, then one repo-backed cross-platform review against one exact merged
implementation SHA. A branch, range, or historical target cannot substitute.

## Bounded Argon2 Checkpoint

The current JavaScript security boundary pins password-derived envelopes to
Argon2id13 `opsLimit = 2` and `memLimit = 67_108_864` bytes, and pins verifier
strings to `$argon2id$v=19$m=65536,t=2,p=1`. It also requires canonical
unpadded encodings and exact `16`-byte salts and `24`-byte nonces.

The accepted plaintext and authenticated-ciphertext maxima are `1_048_576` and
`1_048_592` bytes respectively; accepted purpose tags are at most `128` UTF-8
bytes; PHC verifier strings are at most `127` printable ASCII characters; Web
and extension serialized verifier values are at most `512` characters; and
vault/developer-secret envelope JSON is at most `1_400_171` characters.

Envelope metadata, verifier syntax, encoded-field bounds, and runtime-policy
compatibility are rejected before password KDF calls. Vault `v1`/`v2`,
developer-secret `v1`, and master-password verifier `v1` readers remain
supported behind the bounded parsers. No unbounded legacy fallback is allowed.

This checkpoint closes only the implementation gap for hostile Argon2 metadata.
It does not approve Pairing V2 or produce an independent third-party verdict,
and it does not alter the broader gate state recorded in this document. Public
copy must not claim independent or third-party review from this checkpoint.

## Historical PR #59 Review Target

- GitHub PR: `#59` `[codex] finalize unuvault phase-1 launch packet`
- PR URL: `https://github.com/unundoTeam/unuvault/pull/59`
- Recorded base branch: `main`
- Merge commit on `main`: `46ae0c655deef0ef15cb0cd180b4844a32cac43d`
- This exact historical target covers the recorded Web, browser-extension, CLI,
  and `packages/security` JavaScript substrate only. It is not the current
  Pairing V2 or expanded native/cross-platform review target.

## Historical Internal Iterative Review Status

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

As of `2026-04-25`, that internal iterative review loop completed for its
recorded historical scope. It does not create an independent third-party
verdict or clear the expanded cross-platform gate.

## Historical Third-Party Review Deferral

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
- Result: third-party crypto review was deferred for the recorded historical
  scope, not completed. The exception does not authorize the expanded scope.

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

## Required Exact-Target Review Inputs

The following inputs must travel together for the future exact-target
cross-platform review:

- `docs/operations/secure-crypto-pr-audit-handoff.md`
- `docs/operations/crypto-review-launch-exception.md`
- `docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md`
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
- the one exact merged implementation SHA after all required remediation lands
- target-claim, fresh owner-authorization, persistent replay, and local bridge
  authorization evidence for that exact target

## Exact-Target Review Scope

- Review the historical Web/browser-extension/CLI substrate and native Mac/iOS
  P256/HKDF/AES-GCM pairing substrate together without collapsing them into one
  substrate
- Confirm target-claim authentication and fresh owner authorization fail closed
- Confirm replay rejection survives restart and V2 cannot downgrade to V1
- Confirm local bridge authorization is independently resolved or remains a
  blocking finding
- Confirm failures are fail-closed and do not leak plaintext to stderr or logs
- Confirm new writes only emit the newest secure envelope formats
- Confirm any migration or remediation notes are captured before launch
- Reuse `docs/operations/crypto-legacy-smoke-checklist.md` for the manual legacy
  compatibility pass

## Expected Internal Review Output

The exact-target cross-platform review output should record:

- reviewer identity plus review date
- verdict: `cleared`, `cleared with follow-up`, or `blocked`
- reviewed surfaces and call chains
- any findings, required remediation, or accepted follow-up limits
- confirmation that the launch checklist still matches the current crypto
  boundary

Use `docs/operations/secure-crypto-pr-audit-handoff.md` to record each review
pass and any remediation. Copy the exact reviewed SHA and final result back into
this gate.

## Gate Clears For GA/Public Launch When

All of the following are true:

- Pairing target-claim authentication is implemented
- fresh Mac owner authorization protects the single snapshot read
- iOS replay rejection persists across restart and V2 fails closed without a
  V1 downgrade
- the local bridge authorization blocker is resolved
- one exact merged implementation SHA is recorded
- the cross-platform exact-target review has no unresolved blockers
- legacy compatibility evidence is attached and still reflects the current
  secure boundary
- no new plaintext, XOR, or custom-hash write path remains on the active launch
  surface
- the launch checklist and audit handoff are updated consistently
- any blocking findings are resolved; a renewed exception, if proposed, must
  name and justify the same exact target
- a real independent verdict exists before any independent-security or
  higher-risk public/paid launch claim
- no outward-facing copy claims that the crypto boundary is independently
  reviewed before that verdict exists

## Re-Trigger Conditions For Third-Party Review

The expanded native/cross-platform boundary is already a material
crypto-boundary change. A real independent reviewer remains required before
large-scale public risk, paid/enterprise/compliance claims, independent-security
claims, or after a crypto incident.

## Notes

- This gate is narrower than a general incident or observability runbook.
- It exists to separate internal implementation completion from current-scope
  launch approval.
- `docs/operations/third-party-crypto-review-request.md` is preparation only.
  It remains `not dispatched` until one exact merged implementation SHA and the
  local remediation/re-review evidence are attached.
