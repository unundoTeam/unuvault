# Unuvault Repo Auth Boundary Contract Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `unuvault`'s repo-level auth boundary explicit in the README and architecture docs, then verify that wording against the existing focused Web/API/extension auth tests.

**Architecture:** Keep the runtime behavior unchanged. Tighten the two existing authority docs so they both describe the same three-layer contract: shared identity authority, product bridge at `POST /auth/bootstrap`, and downstream product runtime. Use the current focused tests as the verification shell instead of adding a new repo-level meta-test.

**Tech Stack:** Markdown docs, Vitest, Fastify route tests, browser-extension background auth tests

---

## File Structure

- Modify: `README.md`
  Add a contributor-facing canonical auth boundary section.
- Modify: `docs/architecture/0002-supabase-boundary.md`
  Tighten the architecture-level auth boundary wording.
- Test: `apps/web/tests/finalize-page.spec.tsx`
  Existing Web auth-bridge verification.
- Test: `apps/api/tests/auth-default-route.spec.ts`
  Existing API default bootstrap-route verification.
- Test: `apps/api/tests/auth-bootstrap.spec.ts`
  Existing API bootstrap contract verification.
- Test: `apps/browser-extension/tests/background-auth.spec.ts`
  Existing extension signed-in contract verification.

## Chunk 1: Update the contributor-facing auth boundary docs

### Task 1: Tighten the root README auth contract

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a failing review note for yourself**

Checklist:
- README must stop after the first read with a clear answer to:
  - who authenticates the person
  - what establishes product identity
  - how Web and extension differ only in entry path, not in bridge semantics

- [ ] **Step 2: Update the README with a concise canonical auth boundary section**

Implementation notes:
- keep the repo overview concise
- keep `unuidentity` ownership explicit
- name `POST /auth/bootstrap` directly
- preserve the current local auth loop, but explain where it fits into the larger contract

- [ ] **Step 3: Re-read the updated README section and confirm it stands alone without the architecture doc**

Expected:
- a contributor can read the README and understand the auth boundary without guessing whether `/auth/finalize` or `/vault/sync` is the authority

### Task 2: Tighten the architecture-level boundary doc

**Files:**
- Modify: `docs/architecture/0002-supabase-boundary.md`

- [ ] **Step 1: Update the boundary doc so it names the three layers explicitly**

Required layers:
- shared identity authority
- product bridge
- product runtime

- [ ] **Step 2: Make the client responsibilities explicit**

Checklist:
- Web is a client of the bridge after callback/finalize
- browser extension is a client of the bridge after direct sign-in
- future iOS work is downstream of the same bridge

- [ ] **Step 3: Re-read the doc and confirm it agrees with the README wording**

Expected:
- no contradiction between contributor-facing and architecture-facing explanations

## Chunk 2: Verify the docs contract against the existing auth tests

### Task 3: Re-run the focused auth verification shell

**Files:**
- Test: `apps/web/tests/finalize-page.spec.tsx`
- Test: `apps/api/tests/auth-default-route.spec.ts`
- Test: `apps/api/tests/auth-bootstrap.spec.ts`
- Test: `apps/browser-extension/tests/background-auth.spec.ts`

- [ ] **Step 1: Run the focused Web auth finalize test**

Run: `./node_modules/.bin/pnpm --filter @unuvault/web exec vitest --run tests/finalize-page.spec.tsx`
Expected: PASS

- [ ] **Step 2: Run the focused API auth bootstrap tests**

Run: `./node_modules/.bin/pnpm --filter @unuvault/api exec vitest --run tests/auth-default-route.spec.ts tests/auth-bootstrap.spec.ts`
Expected: PASS

- [ ] **Step 3: Run the focused browser-extension auth contract test**

Run: `./node_modules/.bin/pnpm --filter @unuvault/browser-extension exec vitest --run tests/background-auth.spec.ts`
Expected: PASS

- [ ] **Step 4: Run `git diff --check`**

Run: `git diff --check`
Expected: PASS

- [ ] **Step 5: Commit the repo auth-boundary contract slice**

```bash
git add README.md docs/architecture/0002-supabase-boundary.md
git commit -m "docs: tighten repo auth boundary contract"
```

## Notes For Execution

- Do not refactor Web, API, or extension runtime code in this slice.
- If focused auth tests fail unexpectedly, stop and treat that as a real contract drift rather than papering it over in docs.
- Keep the docs small; the point is to make the existing contract easier to read, not to create a second spec system inside the README.
