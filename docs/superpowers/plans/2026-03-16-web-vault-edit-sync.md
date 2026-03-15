# Web Vault Edit Sync Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal inline edit flow to the Web vault page so an existing item title can be updated through the current sync contract.

**Architecture:** Reuse the current Web vault page, state hook, and shared sync API. The hook gets one new `updateItemTitle` action, while the panel owns lightweight row-level edit UI state for one item at a time.

**Tech Stack:** Next.js App Router, React, TypeScript, shared `packages/api-client`, Supabase browser session access, Vitest, Testing Library

---

## File Structure

- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
  Add the title-update action that syncs a changed item with the same id.
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
  Add inline edit mode, save/cancel actions, and local validation for edited titles.
- Modify: `apps/web/tests/vault-page.spec.tsx`
  Cover entering edit mode, saving, canceling, and blank-title rejection.

## Chunk 1: Enter edit mode

### Task 1: Add inline edit-mode UI for one item row

**Files:**
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing edit-mode test**

Add a test like:

```tsx
it("enters inline edit mode for one vault item", async () => {
  // initial sync returns one item
  // click Edit GitHub
  // expect textbox prefilled with GitHub
  // expect Save and Cancel buttons
});
```

- [ ] **Step 2: Run the Web vault test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because the row still only shows title + delete

- [ ] **Step 3: Implement the smallest edit-mode UI**

Implementation notes:
- in `vault-panel.tsx`, add:
  - `editingItemId`
  - `editingTitle`
  - `editingValidationMessage`
- render `Edit <title>` on non-edit rows
- render an input + `Save` + `Cancel` when a row is active
- prefill the input with the current title when edit mode begins

- [ ] **Step 4: Re-run the Web vault test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for the new edit-mode case

- [ ] **Step 5: Commit the edit-mode UI**

```bash
git add apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault inline edit mode"
```

## Chunk 2: Save edited titles through sync

### Task 2: Add title update sync using the existing item id

**Files:**
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing save-edit test**

Add a test like:

```tsx
it("saves an edited title through changed_items", async () => {
  // first sync -> GitHub
  // second sync -> GitHub Personal
  // click Edit GitHub
  // change input value
  // click Save
  // expect second sync called with same id and new title
  // expect row renders GitHub Personal
});
```

- [ ] **Step 2: Run the Web vault test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because there is no update action yet

- [ ] **Step 3: Implement the smallest title update action**

Implementation notes:
- add `updateItemTitle(itemId, title)` to `useVaultSync`
- find the current item in `items`
- copy the item, replace `title` and `updated_at`
- call `runSync(accessToken, { changed_items: [updatedItem], deleted_item_ids: [] })`
- on success, exit edit mode in the panel

- [ ] **Step 4: Re-run the Web vault test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for save-edit flow

- [ ] **Step 5: Commit the save-edit flow**

```bash
git add apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault edit sync flow"
```

## Chunk 3: Cancel and validation behavior

### Task 3: Add cancel and blank-title protection for edited rows

**Files:**
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing cancel and validation tests**

Add tests like:

```tsx
it("cancels inline edit mode without sending sync", async () => {
  // enter edit mode
  // change value
  // click Cancel
  // expect original row display restored
  // expect no second sync call
});

it("blocks empty edited titles before sending sync", async () => {
  // enter edit mode
  // clear input
  // click Save
  // expect local validation message
  // expect sync not called again
});
```

- [ ] **Step 2: Run the Web vault test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because cancel/reset and edit validation are not complete yet

- [ ] **Step 3: Implement the smallest cancel and validation behavior**

Implementation notes:
- `Cancel` should reset edit-mode state only
- blank edited title should set `editingValidationMessage`
- no sync request should be sent when validation fails
- clear the edit validation message when the input becomes valid or mode exits

- [ ] **Step 4: Re-run the Web vault test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the edit polish**

```bash
git add apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault edit validation"
```

## Chunk 4: Full verification

### Task 4: Run repo verification and finalize the edit slice

**Files:**
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Run the focused Web vault test**

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
git commit -m "feat: add web vault title editing"
```
