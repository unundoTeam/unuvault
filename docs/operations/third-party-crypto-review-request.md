# Third-Party Crypto Review Request

This is a prepared future request for the remediated cross-platform UnuVault
security boundary. It is preparation evidence only; it does not prove reviewer
assignment, external contact, dispatch, or a verdict.

- dispatch state: `not dispatched`
- exact merged implementation SHA: `not yet assigned`
- reviewer or vendor: `not assigned`
- contact path: `not assigned`
- verdict: `not available`

The historical PR `#59` target cannot substitute for the future exact merged
implementation SHA. PR `#59` and merge commit
`46ae0c655deef0ef15cb0cd180b4844a32cac43d` remain historical evidence for the
recorded Web/browser-extension/CLI JavaScript substrate only.

Do not dispatch this packet until Pairing V2 and local bridge remediation have
merged, the exact merged `main` SHA is recorded above, and the exact-target
cross-platform internal review evidence is attached.

## Suggested Subject

`unuvault exact-target cross-platform crypto review request`

## Forwardable Reviewer Brief

Use this brief only after the operator checklist is complete:

```md
Hello,

We are requesting an independent security review of the remediated UnuVault
cross-platform crypto boundary at this exact merged implementation SHA:

<EXACT_MERGED_MAIN_SHA>

Please review both distinct substrates and their boundary:

1. The historical JavaScript/Web/browser-extension/CLI password and
   developer-secret substrate using Argon2id and XChaCha20-Poly1305.
2. The native Mac/iOS Pairing V2 substrate using authenticated target claims,
   fresh Mac owner authorization, P256 ECDH, HKDF-SHA256, AES-GCM target-bound
   handoff, persistent replay rejection, and V2 no-downgrade semantics.

Please also review the separate local bridge authorization boundary. Pairing V2
does not implicitly resolve that bearer contract.

Confirm that:

- the QR-secret-bound target claim is canonical and verified in constant time
- invitation-owned fields cannot be replaced by client echoes
- fresh device-owner authentication occurs before exactly one snapshot read
- the handoff is target-bound and exposes no secret, key, capability, or
  plaintext field
- single-use reservation and persistent replay rejection survive restart
- V2 fails closed without downgrade to V1
- terminal cleanup and the 30-second byte-identical retry window are bounded
- password-envelope inputs retain the implemented bounded Argon2 policy
- local bridge authorization is resolved and fail-closed
- logs and public responses contain no vault plaintext or secret material

Packet attachments:

- `docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md`
- `docs/operations/crypto-review-gate.md`
- `docs/operations/secure-crypto-pr-audit-handoff.md`
- `docs/operations/crypto-review-launch-exception.md`
- `docs/operations/crypto-legacy-smoke-checklist.md`
- `docs/launch/phase1-launch-checklist.md`
- `docs/architecture/0005-secure-password-crypto.md`

Please return the result using the requested schema in this packet.
```

## Requested Review Scope

The review target must be one immutable merged `main` SHA containing all
required remediation. A branch name, tag without resolved commit, range,
historical SHA, or "latest main" is not an acceptable target.

In scope:

- canonical Pairing V2 claim transcript and HMAC target authentication
- fresh Mac owner authorization and post-authentication state rechecks
- P256/HKDF-SHA256/AES-GCM target-bound snapshot handoff
- atomic consume, bounded identical retry, persistent iOS replay rejection,
  terminal cleanup, and no downgrade
- local bridge authorization as a separate boundary
- the bounded Argon2 and XChaCha20-Poly1305 JavaScript substrate
- cross-substrate logging, failure, compatibility, and launch claims

Not in scope unless separately added to the exact packet:

- UI layout, Pencil frames, screenshots, or visual approval
- signing, notarization, store submission, or distribution receipts
- a physical-device receipt that is not evidence for the exact implementation
- unrelated product roadmap or hosted production operations

## Operator Dispatch Checklist

Before sending:

1. Confirm Pairing V2 target authentication, fresh owner authorization,
   persistent replay rejection, V1 no-downgrade, and local bridge authorization
   remediation are merged.
2. Replace `not yet assigned` with the one exact merged implementation SHA.
3. Confirm the SHA is reachable from current `main` and record the command
   evidence without expanding the target to a range.
4. Attach the exact-target cross-platform internal review result and fresh
   focused plus repo-wide verification evidence.
5. Confirm the current preliminary `blocked` findings are resolved or carried
   as explicit findings; do not reuse historical PR `#59` clearance.
6. Assign a real independent reviewer/vendor and durable contact path.
7. Attach every file listed in `Launch Packet Attachments`.
8. Send the forwardable brief and request the exact output schema below.
9. Record the real dispatch metadata in this document and the audit handoff.

If any item is incomplete, keep dispatch state `not dispatched`.

## Dispatch Worksheet

- dispatch state: `not dispatched`
- exact merged implementation SHA: `not yet assigned`
- request owner: `yuchen`
- reviewer or vendor: `not assigned`
- contact path: `not assigned`
- sent date: `not sent`
- requested reply date: `not assigned`
- tracking link: `not assigned`
- recording owner: `yuchen`

Repo docs, PR links, shared chat, and this prepared packet are not a durable
external contact path. Record the real email thread, vendor ticket, or other
approved review system only after dispatch occurs.

## Launch Packet Attachments

- `docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md`
- `docs/operations/crypto-review-gate.md`
- `docs/operations/secure-crypto-pr-audit-handoff.md`
- `docs/operations/crypto-review-launch-exception.md`
- `docs/operations/crypto-legacy-smoke-checklist.md`
- `docs/launch/phase1-launch-checklist.md`
- `docs/launch/phase1-qa-matrix.md`
- `docs/architecture/0005-secure-password-crypto.md`

## Reviewer Output Requested

Please return the review result in this exact shape:

```md
Reviewer: <name or vendor>
Review date: <YYYY-MM-DD>
Exact reviewed SHA: <40-character merged main SHA>
Verdict: cleared | cleared with follow-up | blocked

Reviewed surfaces:
- <surface>

Findings:
- <finding or none>

Required remediation:
- <item or none>

Accepted follow-up limits:
- <item or none>

Local bridge authorization boundary resolved: yes | no
Persistent replay rejection verified across restart: yes | no
Launch checklist matches the exact reviewed boundary: yes | no
```

## Recording The Result

After a real response arrives:

1. Verify the reviewer named the same exact merged implementation SHA.
2. Copy the reviewer identity, date, exact SHA, verdict, reviewed surfaces,
   findings, remediation, and accepted limits into
   `docs/operations/secure-crypto-pr-audit-handoff.md`.
3. Update `docs/operations/crypto-review-gate.md` with the same immutable target
   and gate result.
4. Update `docs/launch/phase1-launch-checklist.md` without converting a blocked,
   partial, conditional, or follow-up result into clearance.
5. Preserve the historical PR `#59` and 2026-04-25 exception as historical
   evidence only.

A sent request does not clear any gate. Only the returned verdict for the exact
target, together with resolved required findings and the applicable launch
decision, can change the current status.
