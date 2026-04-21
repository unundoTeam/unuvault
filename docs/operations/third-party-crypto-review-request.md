# Third-Party Crypto Review Request

Use this as the sendable cover note when requesting the phase-1 external crypto
review for `unuvault`.

## Suggested Subject

`unuvault phase-1 crypto review request: Web, browser extension, and CLI shared security boundary`

## Copy/Paste Request

Hello,

We are requesting a third-party crypto review for the `unuvault` phase-1 secure
crypto slice. This review is an explicit pre-launch gate. Phase 1 remains
blocked until the reviewer verdict and any required follow-up are recorded in
the launch packet.

The slice replaced the previous weak placeholder helpers with one shared async
sodium-backed boundary and upgraded the active write formats to:

- vault password envelope `v3`
- master password verifier `v2`
- developer secret blob `v2`

The current implementation keeps server API shape, browser storage keys, and
CLI target shape unchanged while preserving legacy read compatibility.

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

## Send Checklist

- attach or link every file listed under `Launch Packet Attachments`
- include the current verification summary from this request in the message body
- ask for the reviewer output in exactly the requested verdict shape
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

After the reviewer responds, copy the detailed verdict, reviewed surfaces,
findings, and required follow-up into:

- `docs/operations/secure-crypto-pr-audit-handoff.md`
- `docs/operations/crypto-review-gate.md`

Then update `docs/launch/phase1-launch-checklist.md` so the pending external
crypto review item reflects whether the gate is still open or has been cleared.
