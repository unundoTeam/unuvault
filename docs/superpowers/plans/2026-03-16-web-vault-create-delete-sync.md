# Web Vault Create/Delete Sync Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Web vault page into a small authenticated sync surface that can load items, create one, and delete one through the existing sync contract.

**Architecture:** Keep the page thin by introducing a small client hook for session-aware sync orchestration and a small presentational component for the vault UI. Reuse the existing `packages/api-client` sync contract and the browser Supabase client so the Web app exercises the same backend path that already powers read/write/delete sync.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase browser auth, shared `packages/api-client`, Vitest, Testing Library

---

## File Structure

- Modify: `apps/web/src/app/vault/page.tsx`
  Replace the placeholder page with the new vault panel entrypoint.
- Create: `apps/web/src/components/vault/use-vault-sync.ts`
  Hold session lookup, sync orchestration, create, delete, loading, and error state.
- Create: `apps/web/src/components/vault/vault-panel.tsx`
  Render the title form, item list, status, and action buttons.
- Create: `apps/web/tests/vault-page.spec.tsx`
  Cover unauthenticated, load, create, delete, and failure states.
- Optionally modify: `apps/web/src/lib/supabase-browser.ts`
  Only if a small helper extraction is needed for testability.
- Optionally modify: `README.md`
  Add a short note if the local product walkthrough needs to mention the live vault page.

## Chunk 1: Load and render real vault items

### Task 1: Replace the placeholder vault page with an authenticated sync read path

**Files:**
- Modify: `apps/web/src/app/vault/page.tsx`
- Create: `apps/web/src/components/vault/use-vault-sync.ts`
- Create: `apps/web/src/components/vault/vault-panel.tsx`
- Create: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing vault page tests for unauthenticated and initial-load states**

Add tests that cover:

```tsx
it("shows sign-in guidance when there is no active session", async () => {
  // mock getSession -> null
  // expect "Sign in from the register flow first."
});

it("loads vault items on first render for an authenticated session", async () => {
  // mock getSession -> access token
  // mock syncVault -> one returned item
  // expect sync called with empty changed/deleted arrays
  // expect item title rendered
});
```

- [ ] **Step 2: Run the Web vault test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because the vault page is still a placeholder and the hook/component files do not exist

- [ ] **Step 3: Implement the smallest read-only vault page**

Implementation notes:
- keep `page.tsx` minimal and render a client component
- `useVaultSync` should:
  - call `createBrowserSupabaseClient().auth.getSession()`
  - if no token, set an unauthenticated state
  - if token exists, call `syncVault(fetch, token, { changed_items: [], deleted_item_ids: [] })`
  - store `updated_items` as `items`
- `vault-panel.tsx` should render:
  - page title
  - loading state
  - unauthenticated guidance
  - read-only list of titles

- [ ] **Step 4: Re-run the Web vault test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for the unauthenticated and initial-load tests

- [ ] **Step 5: Commit the read path**

```bash
git add apps/web/src/app/vault/page.tsx apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault sync read flow"
```

## Chunk 2: Create items through sync

### Task 2: Add the minimal create form and changed-item sync

**Files:**
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing create-flow tests**

Add tests like:

```tsx
it("creates a vault item from the title form", async () => {
  // mock authenticated session
  // first sync -> empty list
  // second sync -> list with one new item
  // type title, submit
  // expect sync called with one changed_item and no deleted ids
  // expect rendered list to include the new title
});

it("blocks blank titles before sending sync", async () => {
  // submit empty form
  // expect inline validation message
  // expect sync not called again
});
```

- [ ] **Step 2: Run the Web vault test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because the form and create handler do not exist yet

- [ ] **Step 3: Implement the smallest create flow**

Implementation notes:
- add local `draftTitle` state
- validate `draftTitle.trim().length > 0`
- generate a client id with `crypto.randomUUID()` if available, else a small fallback
- create a minimal `VaultSyncItem` with:
  - `item_type: "login"`
  - `title`
  - placeholder `encrypted_payload`
  - current timestamps
- call `syncVault(fetch, token, { changed_items: [item], deleted_item_ids: [] })`
- replace local `items` with the returned `updated_items`

- [ ] **Step 4: Re-run the Web vault test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for create + blank-title validation

- [ ] **Step 5: Commit the create flow**

```bash
git add apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault create sync flow"
```

## Chunk 3: Delete items through sync

### Task 3: Add delete buttons and deleted-item sync

**Files:**
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing delete-flow test**

Add a test like:

```tsx
it("deletes a vault item through deleted_item_ids", async () => {
  // initial sync -> one item
  // delete sync -> empty updated_items and deleted_item_ids containing that id
  // click Delete
  // expect sync called with deleted_item_ids: [id]
  // expect item disappears from the rendered list
});
```

- [ ] **Step 2: Run the Web vault test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because delete actions are not wired yet

- [ ] **Step 3: Implement the smallest delete flow**

Implementation notes:
- add a delete button per list row
- disable delete while sync is in flight
- call `syncVault(fetch, token, { changed_items: [], deleted_item_ids: [id] })`
- replace local `items` with returned `updated_items`
- optionally show a small success status like `Synced just now`

- [ ] **Step 4: Re-run the Web vault test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for delete flow

- [ ] **Step 5: Commit the delete flow**

```bash
git add apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault delete sync flow"
```

## Chunk 4: Failure handling and repo verification

### Task 4: Add failure-state coverage and run the repo verification suite

**Files:**
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`
- Optionally modify: `README.md`

- [ ] **Step 1: Write the failing failure-state test**

Add a test like:

```tsx
it("preserves the last successful list when sync fails", async () => {
  // initial sync succeeds with one item
  // delete or create sync rejects
  // expect error message
  // expect existing item still rendered
});
```

- [ ] **Step 2: Run the Web vault test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because the hook does not yet preserve the prior list on failure

- [ ] **Step 3: Implement the smallest failure handling**

Implementation notes:
- wrap sync calls in `try/catch`
- keep the last successful `items` state on request failure
- set a compact generic error message
- clear the error on the next successful sync

- [ ] **Step 4: Re-run the focused Web vault test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Run repo-wide verification**

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

Run: `git diff --check`
Expected: PASS

- [ ] **Step 6: Commit the verified Web vault slice**

```bash
git add apps/web/src/app/vault/page.tsx apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx README.md
git commit -m "feat: wire web vault create and delete sync"
```
