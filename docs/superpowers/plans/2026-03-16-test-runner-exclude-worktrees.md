# Test Runner Exclude Worktrees Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the root `test-runner.sh` validate only the current checkout instead of being polluted by `.worktrees/**`.

**Architecture:** Keep the existing two-step runner shape and only narrow the root `vitest` scope by excluding `.worktrees/**`. Add a minimal regression assertion around the script content and verify the runner against the main checkout.

**Tech Stack:** Bash, Vitest, pnpm, TypeScript workspace tests

---

## File Structure

- Modify: `scripts/testing/test-runner.sh`
  Add explicit `.worktrees/**` exclusion to the root `vitest` call.
- Create or Modify: `tests/test-runner.spec.ts`
  Add a small regression check that guards the exclusion.

## Chunk 1: Lock the runner behavior with a failing test

### Task 1: Add regression coverage for the root test runner

**Files:**
- Create: `tests/test-runner.spec.ts`
- Modify: `scripts/testing/test-runner.sh`

- [ ] **Step 1: Write the failing regression test**

Add a test that reads `scripts/testing/test-runner.sh` and asserts the root `vitest` command includes `.worktrees/**` exclusion.

- [ ] **Step 2: Run the focused regression test to verify it fails**

Run: `./node_modules/.bin/vitest --run tests/test-runner.spec.ts`
Expected: FAIL because the current script does not exclude `.worktrees/**`

- [ ] **Step 3: Implement the smallest runner fix**

Implementation notes:
- keep the script shape as-is
- only change the root `vitest` invocation
- leave `pnpm -r test` untouched

- [ ] **Step 4: Re-run the focused regression test**

Run: `./node_modules/.bin/vitest --run tests/test-runner.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the runner fix**

```bash
git add scripts/testing/test-runner.sh tests/test-runner.spec.ts
git commit -m "fix: exclude worktrees from root test runner"
```

## Chunk 2: Full verification

### Task 2: Verify the runner fix against the main checkout

**Files:**
- Modify: `scripts/testing/test-runner.sh`
- Modify: `tests/test-runner.spec.ts`

- [ ] **Step 1: Run focused verification**

Run: `./node_modules/.bin/vitest --run tests/test-runner.spec.ts`
Expected: PASS

- [ ] **Step 2: Run project verification**

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS without picking up `.worktrees/**`

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

Run: `git diff --check`
Expected: PASS

- [ ] **Step 3: Commit the verified slice**

```bash
git add scripts/testing/test-runner.sh tests/test-runner.spec.ts
git commit -m "fix: harden root test runner scope"
```
