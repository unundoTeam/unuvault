# Third-Party Crypto Review Request

Use this only when a real external reviewer or vendor path is reopened for
`unuvault`'s phase-1 secure crypto slice.

As of `2026-04-25`, the current launch path defers third-party crypto review
under `docs/operations/crypto-review-launch-exception.md` and uses the internal
iterative review gate in `docs/operations/crypto-review-gate.md`. Do not use
this request to imply that the current packet is independently reviewed.

## Suggested Subject

`unuvault crypto review request: phase-1 secure crypto boundary for GA/public-launch approval`

## Forwardable Reviewer Brief

Use this shorter version when you need one message that can be forwarded
directly to a reviewer or vendor without extra editing:

```md
Hello,

We are requesting a third-party crypto review for the `unuvault` phase-1
secure crypto slice. This external review path was deferred for the current
launch wave, but it remains the required path before we describe the crypto
boundary as independently reviewed.

Please review the merged `main` state at or after commit
`46ae0c655deef0ef15cb0cd180b4844a32cac43d` from PR `#59`:
`https://github.com/unundoTeam/unuvault/pull/59`

Review these call chains together because they now share one crypto substrate:
- Web unlock, reveal, copy, and secure rewrite paths
- browser extension unlock, popup read, and autofill-read paths
- CLI developer-secret read/import paths
- shared helper layer in `packages/security`

Please confirm:
- failures are fail-closed and do not leak plaintext to `stderr` or logs
- new writes emit only the newest secure formats
- legacy compatibility evidence still matches the current secure boundary
- any required remediation or accepted launch limits are explicit

Packet attachments:
- `docs/operations/crypto-review-gate.md`
- `docs/operations/secure-crypto-pr-audit-handoff.md`
- `docs/operations/crypto-legacy-smoke-checklist.md`
- `docs/launch/phase1-launch-checklist.md`
- `docs/launch/phase1-qa-matrix.md`
- `docs/architecture/0005-secure-password-crypto.md`

Please return the review result in this exact shape:

Reviewer: <name or vendor>
Review date: <YYYY-MM-DD>
Verdict: cleared | cleared with follow-up | blocked

Reviewed surfaces:
- <surface>

Findings:
- <finding or none>

Required remediation:
- <item or none>

Accepted follow-up limits:
- <item or none>

Launch checklist still matches the reviewed crypto boundary: yes | no
```

## Operator Dispatch Checklist

Before sending the request, confirm that an external review path has been
reopened under `docs/operations/crypto-review-launch-exception.md`.

Then:

1. keep the review target anchored to merged `main` at or after
   `46ae0c655deef0ef15cb0cd180b4844a32cac43d`
2. send either the short brief above or the longer copy below
3. attach or link every file listed under `Launch Packet Attachments`
4. ask for the reviewer output in exactly the requested verdict shape
5. after the reply arrives, record it in:
   - `docs/operations/secure-crypto-pr-audit-handoff.md`
   - `docs/operations/crypto-review-gate.md`
6. then update `docs/launch/phase1-launch-checklist.md` so the crypto review
   carry-forward item reflects whether the external review path is still open
   or has cleared

## Full Copy/Paste Request

Hello,

We are requesting a third-party crypto review for the `unuvault` phase-1 secure
crypto slice. This review is not the current phase-1 beta/rehearsal gate. It is
the required path before we represent the crypto boundary as independently
reviewed.

The slice replaced the previous weak placeholder helpers with one shared async
sodium-backed boundary and upgraded the active write formats to:

- vault password envelope `v3`
- master password verifier `v2`
- developer secret blob `v2`

The current implementation keeps server API shape, browser storage keys, and
CLI target shape unchanged while preserving legacy read compatibility.

## Current Review Target

- GitHub PR: `#59` `[codex] finalize unuvault phase-1 launch packet`
- PR URL: `https://github.com/unundoTeam/unuvault/pull/59`
- Current base branch: `main`
- Merge commit on `main`: `46ae0c655deef0ef15cb0cd180b4844a32cac43d`
- Review against the merged `main` state at or after that commit, not the
  deleted feature branch.

## Current Dispatch Status

- Packet refresh date: `2026-04-21`
- Current third-party review status: `deferred by docs/operations/crypto-review-launch-exception.md`
- Approved dispatch mode if reopened: `email thread or vendor ticket`
- GitHub metadata checked on `2026-04-25` shows PR `#59` merged on `main`
  without any recorded PR review or issue-comment artifact that can serve as
  an external crypto verdict.
- Reviewer or vendor assignment still needs to be recorded outside this repo if
  the external request is reopened.
- Shared chat can help route the packet, but the authoritative reviewer
  handoff for this wave must still resolve to an email thread or vendor
  ticket.

## Requested Review Scope

Please review these call chains together because they now share one crypto
substrate:

- Web unlock, reveal, copy, and secure rewrite paths
- browser extension unlock, popup read, and autofill-read paths
- CLI developer-secret read/import paths
- the shared helper layer in `packages/security`

Please confirm the following:

- failures are fail-closed and do not leak plaintext to `stderr` or logs
- new writes emit only the newest secure formats
- legacy compatibility evidence still matches the current secure boundary
- any required remediation or launch limits are made explicit

## Launch Packet Attachments

- `docs/operations/crypto-review-gate.md`
- `docs/operations/secure-crypto-pr-audit-handoff.md`
- `docs/operations/crypto-legacy-smoke-checklist.md`
- `docs/launch/phase1-launch-checklist.md`
- `docs/launch/phase1-qa-matrix.md`
- `docs/architecture/0005-secure-password-crypto.md`

## Dispatch Worksheet

Fill this block before sending the request so the packet has one consistent
record of who sent it, where it was sent, and when to expect the reply.

- Current send status: `not yet sent`
- Request owner: `yuchen`
- Reviewer or vendor: `<name or company>`
- Contact path: `<email thread subject or vendor ticket reference>`
- Sent date: `<YYYY-MM-DD>`
- Requested reply date: `<YYYY-MM-DD>`
- Tracking link: `<email thread URL / vendor ticket URL / internal case URL>`
- Recording owner for repo updates: `yuchen`
- Attachments sent:
  - `docs/operations/crypto-review-gate.md`
  - `docs/operations/secure-crypto-pr-audit-handoff.md`
  - `docs/operations/crypto-legacy-smoke-checklist.md`
  - `docs/launch/phase1-launch-checklist.md`
  - `docs/launch/phase1-qa-matrix.md`
  - `docs/architecture/0005-secure-password-crypto.md`

Do not treat repo docs, PR links, or the launch packet itself as the external
contact path. `Contact path` and `Tracking link` must point at the real
out-of-repo handoff surface, such as an email thread or vendor ticket. Shared
chat can support coordination, but it is not the packet contact path of record
for this wave.

## Send Checklist

- fill `Dispatch Worksheet` with the actual reviewer / vendor, send date, and
  tracking path before sending
- use an email thread or vendor ticket as the durable reviewer handoff path
- if the handoff starts over email, record the mailbox/thread subject and save
  a durable link or searchable reference in `Tracking link`
- attach or link every file listed under `Launch Packet Attachments`
- keep the review target anchored to merged `main` at or after
  `46ae0c655deef0ef15cb0cd180b4844a32cac43d`
- include the current verification summary from this request in the message body
- ask for the reviewer output in exactly the requested verdict shape
- copy the filled dispatch metadata into
  `docs/operations/secure-crypto-pr-audit-handoff.md` once the request is sent
- record the reply in the docs listed under `Recording The Result`

## Fresh Verification Included In The Packet

- `bash scripts/testing/lint-runner.sh` passed on 2026-04-21
- `bash scripts/testing/test-runner.sh` passed on 2026-04-21
- focused secure-crypto regression matrix passed on 2026-04-21
- focused phase-1 Web/API/browser-extension surface matrix passed on 2026-04-21
- focused web onboarding trust-copy matrix passed on 2026-04-21
- `bash scripts/testing/run-ios.sh` passed on 2026-04-21 using the available
  `iPhone 17` simulator
- manual legacy smoke evidence for Web, browser extension, and CLI was last
  refreshed on 2026-04-18 and remains attached in the packet

## Reviewer Output Requested

Please return the review result in this shape:

```md
Reviewer: <name or vendor>
Review date: <YYYY-MM-DD>
Verdict: cleared | cleared with follow-up | blocked

Reviewed surfaces:
- <surface>

Findings:
- <finding or none>

Required remediation:
- <item or none>

Accepted follow-up limits:
- <item or none>

Launch checklist still matches the reviewed crypto boundary: yes | no
```

## Not In Scope For This Review

- broader incident response or observability runbooks
- unrelated product roadmap work outside the shared crypto boundary
- server API redesign, database schema changes, or storage-key migrations

## Recording The Result

If the external review path is reopened and the reviewer responds, copy the
detailed verdict, reviewed surfaces, findings, and required follow-up into:

- `docs/operations/secure-crypto-pr-audit-handoff.md`
- `docs/operations/crypto-review-gate.md`

Then update `docs/launch/phase1-launch-checklist.md` so the crypto review item
reflects whether the external review path is still open or has been cleared.
