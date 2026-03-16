# Web Vault Sync Status Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a page-level sync status area to the Web vault so users can see in-flight feedback, the most recent successful action, and the latest successful sync time without losing the current list during mutation syncs.

**Architecture:** Extend `useVaultSync` with sync lifecycle metadata and split initial bootstrapping from ordinary sync requests. Keep `VaultPanel` responsible for turning that state into small status copy and a deterministic `Last synced at <HH:MM UTC>` label.

**Tech Stack:** Next.js App Router, React, TypeScript, shared `packages/api-client`, Supabase browser session access, Vitest, Testing Library

---

## File Structure

- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
  Add sync lifecycle metadata, preserve item visibility during mutation syncs, and capture `server_time`.
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
  Render the unified status area and stop hiding the full vault UI during non-bootstrap syncs.
- Modify: `apps/web/tests/vault-page.spec.tsx`
  Cover initial sync messaging, last-synced output, and create/update/delete feedback.

## Chunk 1: Track sync lifecycle metadata

### Task 1: Split bootstrap loading from ongoing sync activity

**Files:**
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing initial-sync status test**

Add a test like:

```tsx
it("shows sync status and last synced time after initial load", async () => {
  // session returns a token
  // first sync promise stays pending
  // render page
  // expect "Syncing vault..."
  // resolve with server_time
  // expect "Vault synced"
  // expect "Last synced at 00:00 UTC"
});
```

- [ ] **Step 2: Run the focused Web vault test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because the hook only exposes `isLoading` and no last-synced state

- [ ] **Step 3: Implement the smallest sync metadata refactor**

Implementation notes:
- in `use-vault-sync.ts`, add:
  - `isBootstrapping`
  - `isSyncing`
  - `lastAction`
  - `lastSyncedAt`
- let `runSync(token, payload, action)` capture `response.server_time`
- keep `items` untouched on sync failure
- make `isBootstrapping` only cover session lookup + first authenticated sync

- [ ] **Step 4: Re-run the focused Web vault test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for the new initial-sync status case

- [ ] **Step 5: Commit the hook metadata slice**

```bash
git add apps/web/src/components/vault/use-vault-sync.ts apps/web/tests/vault-page.spec.tsx
git commit -m "feat: track web vault sync status"
```

## Chunk 2: Render a unified status area

### Task 2: Show status copy and last-synced time in the panel

**Files:**
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing panel status tests**

Add tests like:

```tsx
it("shows create success feedback after saving a new item", async () => {
  // initial load success
  // create item
  // expect "Item saved"
  // expect "Last synced at 00:01 UTC"
});

it("shows update success feedback after editing an item", async () => {
  // initial load success
  // edit item title
  // expect "Item updated"
});

it("shows delete success feedback after deleting an item", async () => {
  // initial load success
  // delete item
  // expect "Item deleted"
});
```

- [ ] **Step 2: Run the focused Web vault test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because the panel has no status area yet

- [ ] **Step 3: Implement the smallest status rendering**

Implementation notes:
- in `vault-panel.tsx`, add a status block below the intro copy
- derive copy from:
  - `errorMessage`
  - `isBootstrapping`
  - `isSyncing`
  - `lastAction`
  - `lastSyncedAt`
- format `lastSyncedAt` into deterministic `HH:MM UTC`
- keep existing generic error copy as the highest-priority message

- [ ] **Step 4: Re-run the focused Web vault test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for status rendering and success feedback

- [ ] **Step 5: Commit the panel feedback UI**

```bash
git add apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault sync feedback"
```

## Chunk 3: Preserve the vault UI during mutation syncs

### Task 3: Keep the list visible while save/update/delete requests are in flight

**Files:**
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing in-flight visibility test**

Add a test like:

```tsx
it("keeps the current vault list visible while a mutation sync is pending", async () => {
  // initial load success
  // trigger create or update with a deferred sync promise
  // expect existing item still visible
  // expect "Saving item..." or "Updating item..."
});
```

- [ ] **Step 2: Run the focused Web vault test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because the current panel hides the whole UI behind loading state

- [ ] **Step 3: Implement the smallest visibility fix**

Implementation notes:
- gate the full-page `Loading vault...` experience on `isBootstrapping`, not every sync
- keep form/list rendered after bootstrap has completed
- continue disabling action buttons while `isSyncing`

- [ ] **Step 4: Re-run the focused Web vault test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the in-flight UX fix**

```bash
git add apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: preserve web vault during sync"
```

## Chunk 4: Full verification

### Task 4: Verify the sync-status slice end to end

**Files:**
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Run the focused Web vault suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 2: Run repo-wide verification**

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

Run: `git diff --check`
Expected: PASS

- [ ] **Step 3: Commit the verified slice**

```bash
git add apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault sync status"
```
