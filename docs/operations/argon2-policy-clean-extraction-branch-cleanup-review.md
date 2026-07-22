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

## Candidate-specific tracked closeout authority

This tracked note supersedes only the incomplete candidate closeout fields in
PR85 (#85). It does not change the reviewed absorption decision, deletion
gates, or scope for the older `codex/argon2-policy-clean-extraction` line.

Candidate identity:

- Candidate branch: `codex/argon2-policy-cleanup-review` at
  `6929259c67fd3bf87c0356eb0791667d994f93a9`.
- Candidate worktree:
  `/Users/yuchen/Code/unu/unuvault/.worktrees/argon2-policy-cleanup-review`.
- Merged PR: #85, squash merge
  `b4bcfbbd2ba2324a6fa237e49b0386c9b02637fc`.
- Lifecycle: `discard-candidate`; owner: `yuchen`; delete-by: `2026-07-29`.

The four candidate closeout decisions are:

1. **Worktree:** remove the clean candidate worktree.
2. **Hosted remote CAS:** the hosted target is `origin`'s
   `refs/heads/codex/argon2-policy-cleanup-review`, not the local tracking ref
   `refs/remotes/origin/codex/argon2-policy-cleanup-review`. Freshly query the
   exact hosted ref with `git ls-remote --exit-code origin
   refs/heads/codex/argon2-policy-cleanup-review`. If it is absent, record a
   no-op. If its fresh result is exactly
   `6929259c67fd3bf87c0356eb0791667d994f93a9`, delete it only with this explicit
   expected-SHA lease:

   ```bash
   git push --force-with-lease=refs/heads/codex/argon2-policy-cleanup-review:6929259c67fd3bf87c0356eb0791667d994f93a9 origin :refs/heads/codex/argon2-policy-cleanup-review
   ```

   Freshly rerun that hosted query and require absence. Any mismatch, push
   failure, or reappearance stops cleanup immediately; do not continue to
   tracking or local cleanup. This exact lease is not broad force-push
   authorization.
3. **Tracking:** only after hosted remote deletion has been freshly confirmed,
   skip this step if
   `refs/remotes/origin/codex/argon2-policy-cleanup-review` is already absent.
   Otherwise, delete that single ref only if it still exactly points to
   `6929259c67fd3bf87c0356eb0791667d994f93a9`, using that SHA as the
   expected-old-value; if its value has drifted, stop. Do not run a pruning
   operation or affect any other ref.
4. **Local:** delete the local candidate branch with `git branch -D --
   codex/argon2-policy-cleanup-review`; PR #85 was squash-merged, so the local
   candidate commit is a non-ancestor of the merge commit.

Before any candidate cleanup, freshly verify all of these gates:

1. The local branch and its worktree `HEAD` are exactly
   `6929259c67fd3bf87c0356eb0791667d994f93a9`; if the hosted ref exists, it is
   the same SHA; and the candidate worktree is clean.
2. Resolve the hosted `refs/heads/main` once as the first document gate, and
   pin its non-empty object ID. Current live main is a descendant of both the
   PR #85 merge `b4bcfbbd2ba2324a6fa237e49b0386c9b02637fc` and the merge that
   carries this authority. Immediately before that descendant proof, the byte
   comparison, and every cleanup action, freshly query the hosted ref again;
   any drift from the pinned ID stops cleanup and requires fresh re-review.

   ```bash
   set -euo pipefail
   note_path='docs/operations/argon2-policy-clean-extraction-branch-cleanup-review.md'
   pr85_merge='b4bcfbbd2ba2324a6fa237e49b0386c9b02637fc'
   candidate_heading='## Candidate-specific tracked closeout authority'
   old_line_heading='## What should not happen'
   candidate_heading_marker="${candidate_heading}"$'\n'
   old_line_heading_marker="${old_line_heading}"$'\n'

   live_main_oid="$(git ls-remote --exit-code origin refs/heads/main |
     awk '$2 == "refs/heads/main" && $1 ~ /^[0-9a-f]{40}$/ { print $1 }')"
   live_main_oid_count="$(printf '%s\n' "$live_main_oid" |
     awk 'NF { count++ } END { print count + 0 }')"
   [ "$live_main_oid_count" -eq 1 ] && [ -n "$live_main_oid" ] || {
     echo 'hosted refs/heads/main did not resolve to one object ID' >&2
     exit 1
   }

   require_pinned_live_main() {
     current_live_main_oid="$(git ls-remote --exit-code origin refs/heads/main |
       awk '$2 == "refs/heads/main" && $1 ~ /^[0-9a-f]{40}$/ { print $1 }')"
     current_live_main_oid_count="$(printf '%s\n' "$current_live_main_oid" |
       awk 'NF { count++ } END { print count + 0 }')"
     [ "$current_live_main_oid_count" -eq 1 ] &&
       [ "$current_live_main_oid" = "$live_main_oid" ] || {
       echo 'hosted refs/heads/main drifted or no longer resolves uniquely' >&2
       exit 1
     }
   }

   strip_candidate_subsection() {
     CANDIDATE_HEADING_MARKER="$candidate_heading_marker" \
       OLD_LINE_HEADING_MARKER="$old_line_heading_marker" \
       perl -0777 -e '
         use strict;
         use warnings;

         binmode STDIN, ":raw";
         binmode STDOUT, ":raw";
         binmode STDERR, ":raw";

         my $data = do { local $/; <STDIN> };
         defined $data or die "could not read live blob\\n";
         my $candidate = $ENV{CANDIDATE_HEADING_MARKER};
         my $old = $ENV{OLD_LINE_HEADING_MARKER};
         defined $candidate && length $candidate or die "candidate heading marker is empty\\n";
         defined $old && length $old or die "old-line heading marker is empty\\n";

         my $candidate_offset = index($data, $candidate);
         $candidate_offset >= 0 or die "candidate heading marker is missing\\n";
         index($data, $candidate, $candidate_offset + length $candidate) < 0
           or die "candidate heading marker is repeated\\n";

         my $old_offset = index($data, $old);
         $old_offset >= 0 or die "old-line heading marker is missing\\n";
         index($data, $old, $old_offset + length $old) < 0
           or die "old-line heading marker is repeated\\n";
         $candidate_offset < $old_offset
           or die "candidate and old-line heading markers are out of order\\n";

         print STDOUT substr($data, 0, $candidate_offset), substr($data, $old_offset);
       '
   }

   require_pinned_live_main
   git merge-base --is-ancestor "$pr85_merge" "$live_main_oid"
   # Also prove the merge carrying this authority is an ancestor of $live_main_oid.

   stripped_live_note="$(mktemp)"
   trap 'rm -f "$stripped_live_note"' EXIT
   require_pinned_live_main
   git show "$live_main_oid:$note_path" |
     strip_candidate_subsection > "$stripped_live_note"
   cmp -s <(git show "$pr85_merge:$note_path") "$stripped_live_note" || {
     echo 'old-line prefix or tail differs from PR85; stop for fresh re-review' >&2
     exit 1
   }
   ```

   This compares the complete PR #85 target file byte-for-byte with the pinned
   live blob after removing only the bytes from the exact candidate heading
   marker (including its LF) up to, but not including, the exact `## What
   should not happen` heading marker (including its LF). The Perl process reads
   STDIN once as raw bytes and writes the two retained `substr` byte ranges
   directly, so it preserves that heading and every byte through EOF, including
   whether the final byte is LF. Do not read the live blob from a worktree or a
   cached `origin/main`; every live blob read uses `$live_main_oid`. Any prefix
   or old-tail difference, missing/repeated/out-of-order heading marker, or
   inability to prove this comparison requires a stop and fresh re-review.
3. Inventory non-Git or ignored assets by path and metadata only. Never read,
   print, copy, or commit secret-like content. A `.env*` path, key/token/
   credential-like path, unknown owner, unsafe classification, or any asset
   requiring preservation stops cleanup for owner handling. The three currently
   verified `node_modules` entries are rebuildable exceptions for this cleanup
   only; they do not generalize.
4. This tracked authority note has merged, no new salvage requirement exists,
   and separate explicit user approval for the candidate cleanup has been
   received.

After the gates pass, perform the candidate-only cleanup in this exact order:
worktree, remote, conditional tracking cleanup, then local branch. This record
is not deletion authorization: separate explicit user approval remains required
at execution time. It does not authorize any deletion, modification, or cleanup
of `codex/argon2-policy-clean-extraction` or any other line.

### Old-line prohibitions remain in force

**Rule:** The following `What should not happen` text is the old-line and
current-review prohibition set. Its only related exception is a future,
separately approved candidate-only hosted deletion using the exact lease above;
this note still authorizes no current deletion.

## What should not happen

- Do not delete, modify, or dirty the old branch or worktree during this
  review.
- Do not merge, rebase, cherry-pick, or otherwise replay the old line.
- Do not push, open a PR, create a remote branch, or alter any remote ref.
- Do not change other branches, worktrees, Pairing V2 work, or broader security
  review state as part of this lifecycle note.
