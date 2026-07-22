# Argon2 SDD Evidence Preservation Implementation Plan

> **Execution record:** All steps below were completed without commit, push, PR, deletion, or modification of product source. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Preserve the four source SDD artifacts from the completed Argon2 policy-clean extraction as a byte-exact, integrity-verifiable evidence bundle without altering product behavior.

**Architecture:** The bundle stores immutable raw copies under the operations evidence tree and pairs them with a human-readable provenance record plus a SHA-256 manifest. The preservation branch is based on the PR #85 merge commit, while the source worktree remains read-only and unchanged.

**Tech Stack:** Git worktrees, POSIX `cp -p`, SHA-256 (`shasum -a 256`), pnpm, ESLint, Vitest.

---

## File structure

- `docs/operations/evidence/argon2-policy-clean-extraction-sdd-2026-07-22/README.md` — provenance, scope, and restoration limitations.
- `docs/operations/evidence/argon2-policy-clean-extraction-sdd-2026-07-22/SHA256SUMS` — canonical SHA-256 manifest for the four raw artifacts.
- `docs/operations/evidence/argon2-policy-clean-extraction-sdd-2026-07-22/raw/` — byte-exact copies of the source artifacts; the source `.gitignore` is stored as `sdd.gitignore` so the evidence remains trackable.

### Task 1: Establish the evidence-preservation baseline

**Files:**
- Create: `docs/superpowers/plans/2026-07-22-argon2-sdd-evidence-preservation.md`
- Create: `docs/operations/evidence/argon2-policy-clean-extraction-sdd-2026-07-22/README.md`
- Create: `docs/operations/evidence/argon2-policy-clean-extraction-sdd-2026-07-22/SHA256SUMS`

- [x] **Step 1: Confirm the exact base and source provenance**

Run: `git rev-parse HEAD && gh pr view 85 --json state,mergedAt,mergeCommit`
Actual: the preservation branch base was `b4bcfbbd2ba2324a6fa237e49b0386c9b02637fc`; the source branch was `codex/argon2-policy-clean-extraction` at `d30ea085581b25796c04dd06d0a14822f60c49e7`; and an exact `main` fetch confirmed the PR #85 merge baseline.

- [x] **Step 2: Record the source-to-destination mapping and preservation limits**

Actual: the provenance record documents the source worktree and all four destinations, byte counts, hashes, non-reproducibility, and that preservation is neither security clearance nor a restoration instruction. The source scan returned zero matches across its configured credential-pattern categories without printing values.

### Task 2: Copy and verify raw evidence

**Files:**
- Create: `docs/operations/evidence/argon2-policy-clean-extraction-sdd-2026-07-22/raw/review-fb6b415..b8a6e91.diff`
- Create: `docs/operations/evidence/argon2-policy-clean-extraction-sdd-2026-07-22/raw/review-fb6b415..b91d12d.diff`
- Create: `docs/operations/evidence/argon2-policy-clean-extraction-sdd-2026-07-22/raw/review-fb6b415..d30ea08.diff`
- Create: `docs/operations/evidence/argon2-policy-clean-extraction-sdd-2026-07-22/raw/sdd.gitignore`

- [x] **Step 1: Copy each source artifact with preserved metadata**

Run: `cp -p <source> <destination>` for each listed artifact.
Actual: all four artifacts were copied with preserved metadata; the source worktree remained unchanged and every destination exists.

- [x] **Step 2: Verify byte identity and manifest integrity**

Run: `cmp -s <source> <destination> && shasum -a 256 -c SHA256SUMS`
Actual: all four source-to-destination `cmp` checks and SHA-256 comparisons passed; `SHA256SUMS` validated 4/4 entries.

### Task 3: Run repository-safe verification

**Files:**
- Verify: all seven created documentation/evidence files

- [x] **Step 1: Inspect the branch-only diff**

Run: `{ git diff --name-only HEAD; git ls-files --others --exclude-standard; } | sort`, then compare the result with the exact seven-file allowlist.

Actual: the comparison matched exactly seven preservation files. Whitespace checks were run only for the non-raw documentation files (this plan, the evidence README, and `SHA256SUMS`). The raw historical diffs contain byte-exact `+ ` lines, so they are intentionally exempt from whitespace checks and were never modified; their integrity was established only by `cmp`, SHA-256, and the manifest.

- [x] **Step 2: Run project validation without changing source behavior**

Run: `pnpm install --frozen-lockfile --offline && pnpm lint && pnpm exec vitest run tests/workspace-entrypoints.spec.ts`
Actual: `pnpm install --frozen-lockfile --offline` exited 0; `pnpm lint` exited 0; and the focused Vitest run passed 25/25 tests. The exact seven-file scope check passed.

- [x] **Step 3: Preserve follow-up boundaries**

Do not commit, push, open a PR, delete a worktree, modify product source, or treat this archived evidence as clearance to restore or execute its contents.

Actual: no commit, push, PR, deletion, or product-source modification occurred. Execution evidence is limited to the recorded source scan, exact-main fetch, copy/integrity checks, scoped validation, and repository-safe commands; it does not prove future lifecycle authorization or authorize restoration.
