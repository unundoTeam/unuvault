# CI And Testing Entrypoints Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder workspace test/lint scripts with real commands, add stable testing wrappers, and wire GitHub Actions to those entrypoints.

**Architecture:** Keep `unuvault`'s stable local entrypoints in `scripts/testing/` and make both local development and GitHub Actions call those wrappers. Preserve the existing workspace split by giving each package a real `test` and `lint` script, while the root package becomes the single place that aggregates meta checks and recursive workspace execution.

**Tech Stack:** pnpm workspaces, Vitest, TypeScript (`tsc --noEmit`), GitHub Actions, bash wrappers, xcodebuild

---

## Chunk 1: Lock The Contract With Failing Meta Tests

### Task 1: Add repository-level tests for real scripts and workflows

**Files:**
- Create: `tests/workspace-entrypoints.spec.ts`
- Test: `tests/workspace-entrypoints.spec.ts`

- [ ] **Step 1: Write the failing test**

Add a Vitest spec that reads root/workspace `package.json` files plus `.github/workflows/*.yml` and asserts:
- root `test` uses `bash scripts/testing/test-runner.sh`
- root `lint` uses a real lint entrypoint
- workspace packages no longer contain `No tests yet` / `No lint yet`
- JS CI workflow exists and calls root `pnpm lint` / `pnpm test`
- iOS workflow exists and calls `bash scripts/testing/run-ios.sh`

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest --run tests/workspace-entrypoints.spec.ts`

Expected: FAIL because the root package still fans out to placeholder workspace scripts and workflow files do not exist.

## Chunk 2: Make Local Entrypoints Real

### Task 2: Add stable wrappers and package scripts

**Files:**
- Create: `scripts/testing/test-runner.sh`
- Create: `scripts/testing/lint-runner.sh`
- Create: `tsconfig.json`
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/browser-extension/package.json`
- Modify: `packages/api-client/package.json`
- Modify: `packages/domain/package.json`
- Modify: `packages/security/package.json`

- [ ] **Step 3: Write the minimal implementation**

Implement:
- root `test` => `bash scripts/testing/test-runner.sh`
- root `lint` => `bash scripts/testing/lint-runner.sh`
- `scripts/testing/test-runner.sh` runs the repository-level meta spec first, then `pnpm -r test`
- `scripts/testing/lint-runner.sh` runs the repository-level TypeScript check first, then `pnpm -r lint`
- each workspace `test` script runs `vitest --run tests`
- each workspace `lint` script runs `tsc --noEmit -p tsconfig.json`
- root `tsconfig.json` covers repository-level tests and each workspace gets a local `tsconfig.json` extending `tsconfig.base.json`

- [ ] **Step 4: Run targeted verification**

Run:
- `./node_modules/.bin/vitest --run tests/workspace-entrypoints.spec.ts`
- `bash scripts/testing/lint-runner.sh`
- `bash scripts/testing/test-runner.sh`

Expected: PASS for the new meta test, the TypeScript lint pass, and the full JS suite.

## Chunk 3: Connect GitHub Actions And Document The Entrypoints

### Task 3: Add workflows and sync repository docs

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/ios.yml`
- Modify: `README.md`

- [ ] **Step 5: Write the minimal implementation**

Implement:
- `.github/workflows/ci.yml` to run on push and pull request, install Node/pnpm, run `pnpm install`, then `pnpm lint` and `pnpm test`
- `.github/workflows/ios.yml` to run on workflow dispatch and pull requests touching `apps/ios/**`, then execute `bash scripts/testing/run-ios.sh`
- `README.md` development/status text so it mentions the stable root commands and current CI posture

- [ ] **Step 6: Run verification**

Run:
- `./node_modules/.bin/vitest --run tests/workspace-entrypoints.spec.ts apps/api/tests apps/browser-extension/tests apps/web/tests packages/api-client/tests packages/domain/tests packages/security/tests`
- `bash scripts/testing/lint-runner.sh`
- `bash scripts/testing/run-ios.sh`
- `git diff --check`

Expected: all checks pass, including the iOS wrapper.

- [ ] **Step 7: Commit**

```bash
git add tests/workspace-entrypoints.spec.ts scripts/testing/test-runner.sh scripts/testing/lint-runner.sh tsconfig.json package.json apps/api/package.json apps/web/package.json apps/browser-extension/package.json packages/api-client/package.json packages/domain/package.json packages/security/package.json .github/workflows/ci.yml .github/workflows/ios.yml README.md docs/superpowers/plans/2026-03-15-ci-and-testing-entrypoints.md
git commit -m "feat: add ci and real testing entrypoints"
```
