# Argon2 Policy Clean Extraction Branch Cleanup Review

Date: 2026-07-22 (Asia/Shanghai)

## Line scope

- Local branch: `codex/argon2-policy-clean-extraction@d30ea085581b25796c04dd06d0a14822f60c49e7`.
- Worktree: `/Users/yuchen/Code/unu/unuvault/.worktrees/argon2-policy-clean-extraction`.
- Remote branch: absent. Its configured upstream is `origin/main`; that is not
  a same-name remote branch.
- Immutable reviewed baseline / absorption evidence: `origin/main@6e30688a560f76080fb6f2f70c4a8a9efbca4291`.
- Reviewed-baseline merge-base: `fb6b4159455effdbad520c253d8d0f58e9a923d2`.
- Reviewed-baseline divergence: main-only `10`; branch-only `9`.

These immutable reviewed-baseline values document this absorption comparison;
they are not future deletion-time requirements that live `origin/main` retain
these exact values.

This review records the lifecycle decision for the old local line. It does not
revive the line or authorize extracting implementation from it.

## Final absorption decision

**FULLY ABSORBED** — the branch-only Argon2-policy work is already represented
by current `origin/main`, with current `main` stronger where the historical
implementation did not yet provide the necessary legacy XOR validation.

| Legacy commit | Legacy subject | Verdict on current `origin/main` |
| --- | --- | --- |
| `c775c2543fabf016b2d7232b6645472f9d5151fc` | `security: pin argon2 parameter policy` | semantic absorbed |
| `5c769b85272f93991c4f125b78c1b5d81d4ded46` | `security: reject hostile argon2 metadata before kdf` | blob absorbed |
| `6b10af42a729a6ebf03139666de1f89124322bb1` | `security: bound password-derived envelopes` | semantic absorbed |
| `b54a083f9e7ffcc3a9f8b034e11adb5958f34334` | `security: centralize argon2 verifier policy` | blob absorbed |
| `9b78f24578d4625f92f9873cb999c2d16b3b56bc` | `test: align web verifier fixture with argon2 policy` | semantic absorbed |
| `6db3a42aab7a70d6f33ee9ebca946ca111a190f4` | `docs: record bounded argon2 policy` | semantic absorbed |
| `b8a6e915c39d414a540265d6c54530b640bbd8c4` | `security: close legacy argon2 input bounds` | semantic absorbed; current `main` is stronger |
| `b91d12d291d0352de62eb061107d581eaf4ed11a` | `docs: map argon2 extraction commits` | mapping-only absorbed |
| `d30ea085581b25796c04dd06d0a14822f60c49e7` | `docs: complete argon2 extraction mapping` | mapping-only absorbed |

### Evidence for the decision

- Exact-equal current-main blobs include
  `apps/web/src/components/vault/master-password-storage.ts`
  (`3af1603ef9090a214a20aed3f3b2f00913989ed4`) and
  `apps/web/tests/master-password-storage.spec.ts`
  (`b24cf503055d697e3a44bad727c28ce331264298`) from the historical verifier
  centralization slice.
- Current `main` additionally centralizes `LEGACY_XOR_ENVELOPE_POLICY` in
  `packages/security/src/argon2-policy.ts`. Both
  `developer-secret-envelope.ts` and `vault-envelope.ts` require
  `isSupportedLegacyXorEnvelope`, which validates canonical base64 encoding,
  exact salt shape, payload character and decoded-byte bounds, and the legacy
  tag before decoding. The corresponding tests cover oversize payload and salt
  rejection. This is stronger than the old line's legacy XOR handling.
- The mapping-only commits preserve extraction provenance; they do not identify
  remaining implementation to replay.

## Safety boundary

Do not directly merge, rebase, or cherry-pick
`codex/argon2-policy-clean-extraction`. Future work must start from current
`main`, not this historical line. The old line is not an authorization to
weaken current canonical encoding, legacy XOR size validation, or any other
current security control.

This lifecycle decision does not claim that Pairing V2 is complete, that its
exact-target security re-review is complete, or that overall security work has
been cleared.

## Lifecycle state

- Lifecycle: `discard-candidate`
- Owner: `yuchen`
- Next action: after this note is merged and separate explicit approval is
  received, delete the clean old worktree first and then its local branch.
- Delete-by: `2026-07-29`
- Written source of truth: this note
- Remote action: `none` (the old branch has no remote cleanup action)

## Cleanup gate and plan

Before any deletion, freshly verify all of the following:

1. Fresh live/cached `origin/main` contains this note and is a descendant of
   the immutable reviewed baseline
   `6e30688a560f76080fb6f2f70c4a8a9efbca4291`; the primary `main` worktree is
   clean.
2. `codex/argon2-policy-clean-extraction` and
   `/Users/yuchen/Code/unu/unuvault/.worktrees/argon2-policy-clean-extraction`
   are exactly at `d30ea085581b25796c04dd06d0a14822f60c49e7` and the old worktree
   is clean.
3. If changes after the reviewed baseline touch the Argon2 policy, envelope,
   verifier/storage, or focused test surfaces audited by this note, redo the
   absorption comparison. Otherwise, cite the immutable reviewed-baseline
   evidence (merge-base `fb6b4159455effdbad520c253d8d0f58e9a923d2`; divergence
   main-only `10` / branch-only `9`).
4. This note has merged, separate deletion approval is explicit, there is no
   same-name remote branch or PR, and no new salvage requirement has appeared.

The branch is non-ancestor, so the expected local-only cleanup sequence is:

```bash
git worktree remove /Users/yuchen/Code/unu/unuvault/.worktrees/argon2-policy-clean-extraction
git branch -D -- codex/argon2-policy-clean-extraction
```

The first command must succeed before the second is attempted. No remote is
updated or deleted. Afterward, verify that both the worktree registration and
local branch ref are absent.

## What should not happen

- Do not delete, modify, or dirty the old branch or worktree during this
  review.
- Do not merge, rebase, cherry-pick, or otherwise replay the old line.
- Do not push, open a PR, create a remote branch, or alter any remote ref.
- Do not change other branches, worktrees, Pairing V2 work, or broader security
  review state as part of this lifecycle note.
