# PR #78 Review Blocker Remediation Design

## Problem

PR #78 correctly hides a recognized raw invite while pairing is in progress,
but its exchange and import failure states make the invite editor visible again
without first clearing the failed attempt. That can put the raw invite back on
screen and leave the parsed invite and recognized Mac summary available after
the attempt has failed. The PR also has two evidence-authority blockers: the
current physical receipt sentinel in `README.md` still says `paired`, and the PR
body says `Cross-Repo Impact: none` even though the promoted iOS frames must be
recorded in `unuOS` portfolio authority.

## Approved design

Adopt option A. After any claim exchange or handoff import failure, immediately
discard the failed attempt's raw invite, parsed invite, recognized Mac summary,
transient handoff, and import receipt. Preserve only the existing safe failure
state, user-facing copy, and allowlisted diagnostic. The same failure view then
shows the existing invite editor empty so the user can paste a fresh invite.

This is a state-reset change, not a new interaction. It adds no control and does
not expand the approved Pencil composition. Existing success, single-flight,
and post-import reload behavior remain unchanged.

## Data and state transition

The failure transition is atomic on `PairingInviteViewModel`'s main-actor
boundary:

1. An accepted invite moves from `ready` to `pairing` using the current parsed
   invite and recognized Mac summary.
2. If exchange fails, clear `inviteText`, the private parsed invite, `handoff`,
   `importReceipt`, `macDisplayName`, `macEndpointText`, and
   `macInviteDetailText` before publishing `invalid` for an expired exchange or
   `failed` for other exchange failures.
3. If import fails after exchange, clear the same failed-attempt fields before
   publishing `importFailed`.
4. Preserve the current safe `statusMessage` and allowlisted
   `pairingFailureDiagnostic`; never copy an underlying error description,
   invite payload, credential value, endpoint, handoff material, or secret into
   UI or logs.
5. In `invalid`, `failed`, and `importFailed`, `canPair` remains false and the
   existing editor is visible with an empty value. Only a newly pasted and
   successfully parsed invite can return the model to `ready`.

The raw invite is never retained after a failed exchange or import. No new
cryptographic primitive, persistence schema, migration, telemetry field, or
secret logging is introduced.

## Authority and docs sync

- Update the current physical receipt harness expectation in `README.md` from
  `UNUVAULT_IOS_PAIRING_RECEIPT paired` to
  `UNUVAULT_IOS_PAIRING_RECEIPT imported`. Keep the recorded 2026-07-08
  `paired` receipt labeled as historical transport-only evidence; do not
  rewrite it as proof of a physical import that has not been recorded.
- In a separate clean `unuOS` worktree, synchronize
  `docs/portfolio/design-operating-index.md` and
  `docs/portfolio/pencil-design-gate.md` so their unuvault current-frame and
  parity records name `current/unuvault/ios-product-composition-v1` and
  `current/unuvault/ios-pairing-invite-receive-v3` consistently.
- Do not touch the currently dirty `unuOS` checkout. The cross-repo docs change
  is a dependency of PR #78, not incidental cleanup.
- Update PR #78's `Cross-Repo Impact` from `none` to the exact `unuOS` authority
  dependency and its isolated-worktree verification status.

## Testing and verification

- Add focused model tests for expired-exchange, other exchange, and import
  failures. Each must assert the safe state/copy/diagnostic is retained while
  raw invite, parsed invite effects, Mac summary, handoff, and receipt are
  cleared, `canPair` is false, and a fresh invite can be entered.
- Add or update view-level coverage proving failure states render the existing
  editor empty and do not render the recognized Mac summary or failed raw
  invite.
- Re-run the focused iOS pairing tests and the repo-owned `pnpm test:ios` gate;
  retain existing success, single-flight, secret-redaction, and post-import
  reload coverage.
- Verify the receipt harness and docs expect the `imported` sentinel while the
  historical `paired` record remains explicitly transport-only.
- In the isolated `unuOS` worktree, run the docs' targeted contract checks and
  inspect the two authority-file diffs before recording the dependency in the
  PR body.
- Run `git diff --check` in each changed repo/worktree before handoff.

The existing `reload-failed` simulator proof and `accessibility3` evidence are
non-blocking follow-up items for this remediation. They are not prerequisites
for clearing the invite-retention and authority blockers.

## Scope and non-goals

In scope are the failure reset, focused regression tests, the current receipt
sentinel wording, the two isolated `unuOS` authority updates, and truthful PR
cross-repo disclosure. No new UI control, Pencil frame, navigation behavior,
crypto primitive, persisted schema, production operation, physical-device
proof claim, or broad documentation cleanup is included. README changes must
not overstate current hardware evidence.

## Rollout and rollback

Land the unuvault remediation and the isolated `unuOS` authority sync as
reviewable, repo-owned commits, then update the PR dependency text with their
actual status. No migration or staged runtime rollout is required because the
change only clears transient failure state and aligns evidence authority.

Rollback is a normal revert of the relevant repo commits. Reverting does not
require data repair or key rotation, but it reopens the raw-invite retention or
authority-drift blocker and must be reflected in the PR status. Push and merge
remain separately approval-gated and are not authorized by this design.
