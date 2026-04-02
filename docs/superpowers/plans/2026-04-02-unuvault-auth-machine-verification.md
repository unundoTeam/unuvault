# Unuvault Auth Machine Verification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one explicit repo-level machine guard for `unuvault`'s canonical
auth boundary without changing runtime behavior.

**Architecture:** Keep the owning runtime proof in Web, API, and
browser-extension tests. Add a root `tests/auth-boundary-contract.spec.ts` that
ties together authority docs, stable package test entrypoints, and the owning
proof surfaces. Update the root README and the Supabase boundary ADR so both
name the same root guard.

**Tech Stack:** Vitest, Markdown docs, package manifests

---

## File Structure

- Create: `tests/auth-boundary-contract.spec.ts`
  Root meta-test that pins the repo auth contract.
- Modify: `README.md`
  Add a short repo-level auth machine verification note.
- Modify: `docs/architecture/0002-supabase-boundary.md`
  Add the matching architecture-side verification note.

## Chunk 1: Add the root auth contract guard

### Task 1: Write and run the new root contract test first

**Files:**
- Create: `tests/auth-boundary-contract.spec.ts`

- [ ] **Step 1: Add a new root Vitest file that reads repo docs, package manifests, and auth test files**

Required assertions:
- root docs keep the canonical auth boundary language
- root docs name `tests/auth-boundary-contract.spec.ts` as the repo-level guard
- Web/API/browser-extension packages keep stable `vitest --run tests` entrypoints
- key surface tests still cover callback/finalize/bootstrap, bearer bootstrap,
  and bootstrap-backed `signed_in`

- [ ] **Step 2: Run the focused root test and confirm it fails before doc updates**

Run: `./node_modules/.bin/vitest --run tests/auth-boundary-contract.spec.ts`
Expected: FAIL because the docs do not yet mention the new root guard

## Chunk 2: Update the repo authority docs

### Task 2: Add the repo-level auth machine verification note to the README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add one short verification note under the existing verification block**

Required content:
- name `tests/auth-boundary-contract.spec.ts`
- explain that it pins the shared Web/API/browser-extension auth boundary

### Task 3: Add the matching verification note to the Supabase boundary ADR

**Files:**
- Modify: `docs/architecture/0002-supabase-boundary.md`

- [ ] **Step 1: Add a short verification section naming the same root guard**

Required content:
- state that the root guard keeps README/ADR wording aligned with the owning
  Web/API/browser-extension auth tests

## Chunk 3: Turn the new root guard green and re-run standard verification

### Task 4: Re-run focused root verification

**Files:**
- Test: `tests/auth-boundary-contract.spec.ts`

- [ ] **Step 1: Re-run the focused root test**

Run: `./node_modules/.bin/vitest --run tests/auth-boundary-contract.spec.ts`
Expected: PASS

### Task 5: Re-run standard repo verification

**Files:**
- Test: root repo verification surface

- [ ] **Step 1: Run `pnpm lint`**

Run: `./node_modules/.bin/pnpm lint`
Expected: PASS

- [ ] **Step 2: Run `pnpm test`**

Run: `./node_modules/.bin/pnpm test`
Expected: PASS

- [ ] **Step 3: Run `git diff --check`**

Run: `git diff --check`
Expected: PASS

- [ ] **Step 4: Commit the auth machine verification slice**

```bash
git add README.md docs/architecture/0002-supabase-boundary.md tests/auth-boundary-contract.spec.ts docs/superpowers/specs/2026-04-02-unuvault-auth-machine-verification-design.md docs/superpowers/plans/2026-04-02-unuvault-auth-machine-verification.md
git commit -m "test: add auth machine verification contract"
```
