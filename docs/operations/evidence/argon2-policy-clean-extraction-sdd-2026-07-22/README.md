# Argon2 policy-clean extraction SDD evidence

## Provenance

This bundle preserves four files from the clean source worktree at `/Users/yuchen/Code/unu/unuvault/.worktrees/argon2-policy-clean-extraction/.superpowers/sdd`, on source branch `codex/argon2-policy-clean-extraction` at full source HEAD `d30ea085581b25796c04dd06d0a14822f60c49e7`. The preservation branch is based on `b4bcfbbd2ba2324a6fa237e49b0386c9b02637fc`, the merge commit for merged PR [#85](https://github.com/unundoTeam/unuvault/pull/85). Capture occurred on `2026-07-22 Asia/Shanghai (+08:00)`.

After copying, each raw file was rechecked with `cmp` and SHA-256 against its stored copy and the four-entry manifest; all four remained byte-identical and matched `SHA256SUMS`. This evidence records those checks only; it makes no claim about ignored historical files through `git clean`.

## Source-to-destination mapping and integrity

| Source file | Preserved file | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `.gitignore` | `raw/sdd.gitignore` | 2 | `cdbcae15105d6b781e620813c79c7e868740d4e9cc53ce6f5fcbbc12387adf4b` |
| `review-fb6b415..b8a6e91.diff` | `raw/review-fb6b415..b8a6e91.diff` | 62388 | `2e3fb200eaf0eb7ad83e745442c5991b4da50caa2b58d52c20f4c8e007270b7b` |
| `review-fb6b415..b91d12d.diff` | `raw/review-fb6b415..b91d12d.diff` | 62734 | `3a95269cc6a7c7c62fa48d41ed6ab8d32d2e6d721f17b7562e1dca8e2acf52c6` |
| `review-fb6b415..d30ea08.diff` | `raw/review-fb6b415..d30ea08.diff` | 62825 | `3176c31c5e57de544acb38596253b08cc28b9034b0ab8dbce5042fabc50058cb` |

`SHA256SUMS` is the canonical four-entry integrity manifest. The source `.gitignore` is intentionally preserved as `raw/sdd.gitignore`, preventing the evidence file itself from being ignored.

## Sensitive-content scan

Before copying, the four source files were scanned without printing their contents for private-key blocks; GitHub, OpenAI, Supabase, and AWS token formats; Bearer credentials; dotenv-style password/token/secret assignments; and high-entropy credential assignments. All scan categories returned zero matches. This is a narrow pattern scan, not a claim that the artifacts are generally free of sensitive material.

## Scope and non-reproducibility

This is an evidence-preservation bundle only. It does not restore, apply, execute, endorse, or re-review the preserved diffs. The original source worktree and any unrecorded surrounding state are outside the bundle, so its historical process is not reproducible from these four files alone.

Preservation is not a security clearance. Any future use, restoration, or interpretation of a raw artifact requires a fresh scope, security review, and explicit authorization.

## Future cleanup

The bundle must first reach live `main` through an authorized commit and PR. Only after byte-exact bundle and manifest presence on `main` is confirmed may this new evidence branch and worktree enter `discard-candidate` status for independent lifecycle cleanup. The old source line may be deleted only after the bundle is on `main`, authority for candidate remote handling is resolved, and separate deletion approval is granted. The branch is not a long-term authority for the evidence.

Do not delete the source worktree, this evidence bundle, or any Argon2-related branch as part of this preservation task.
