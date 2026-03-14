# CI Entrypoints PR Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair PR #2 so its GitHub checks pass without expanding scope beyond the CI-specific failures.

**Architecture:** Keep the existing branch shape intact and apply the smallest changes needed to satisfy GitHub's environment. Lock the fix with repository-level meta tests, then update the workflow and Swift test to match those expectations.

**Tech Stack:** GitHub Actions, Vitest, Swift/XCTest, bash wrappers

---

## Chunk 1: Lock The Repair With Failing Regression Tests

### Task 1: Extend meta coverage for the workflow and Swift test contract

**Files:**
- Modify: `tests/workspace-entrypoints.spec.ts`
- Test: `tests/workspace-entrypoints.spec.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that:
- `.github/workflows/ci.yml` does not contain `cache: pnpm`
- `apps/ios/App/Tests/AutofillOnboardingViewTests.swift` contains a main-actor annotation or equivalent main-actor-safe access pattern

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest --run tests/workspace-entrypoints.spec.ts`

Expected: FAIL because the current workflow still contains `cache: pnpm` and the Swift test is not annotated for main-actor-safe access.

## Chunk 2: Apply The Minimal Fix

### Task 2: Update the workflow and Swift test

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `apps/ios/App/Tests/AutofillOnboardingViewTests.swift`

- [ ] **Step 3: Write the minimal implementation**

Implement:
- remove `cache: pnpm` from `.github/workflows/ci.yml`
- make `AutofillOnboardingViewTests` access `view.body` from a main-actor-safe context that preserves the existing assertion intent

- [ ] **Step 4: Run targeted verification**

Run:
- `./node_modules/.bin/vitest --run tests/workspace-entrypoints.spec.ts`
- `bash scripts/testing/test-runner.sh`
- `bash scripts/testing/run-ios.sh`

Expected: all commands pass locally.

## Chunk 3: Final Verification And Commit

### Task 3: Prepare the branch for PR re-check

**Files:**
- Create: `docs/superpowers/specs/2026-03-15-ci-entrypoints-pr-fix-design.md`
- Create: `docs/superpowers/plans/2026-03-15-ci-entrypoints-pr-fix.md`

- [ ] **Step 5: Run final verification**

Run:
- `git diff --check`
- `git status --short --branch`

Expected: only intended changes remain and the diff is clean.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml apps/ios/App/Tests/AutofillOnboardingViewTests.swift tests/workspace-entrypoints.spec.ts docs/superpowers/specs/2026-03-15-ci-entrypoints-pr-fix-design.md docs/superpowers/plans/2026-03-15-ci-entrypoints-pr-fix.md
git commit -m "fix: repair ci entrypoint checks"
```
