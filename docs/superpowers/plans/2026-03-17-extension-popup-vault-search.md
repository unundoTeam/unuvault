# Extension Popup Vault Search Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the extension popup's unlocked placeholder shell with a real read-only vault search experience backed by extension-local cached vault items.

**Architecture:** Add an extension-local vault cache storage helper, then layer a popup vault search hook on top of it so the popup can load, sort, and filter cached `VaultSyncItem` records without talking to browser APIs directly. Reuse the existing login payload and password envelope behavior so reveal and copy actions stay consistent with the Web vault, while keeping `usePopupUnlock` as the only unlock source of truth.

**Tech Stack:** TypeScript, React, Vitest, `chrome.storage.local`, shared `packages/api-client` and `packages/security`

---

## File Structure

- Create: `apps/browser-extension/src/popup/popup-vault-storage.ts`
  Read and validate the extension-local cached vault list.
- Create: `apps/browser-extension/src/popup/login-payload.ts`
  Popup-local login payload normalization and password helper functions, parallel to the Web vault helper.
- Create: `apps/browser-extension/src/popup/use-popup-vault-search.ts`
  Load cached items, sort/filter results, and own reveal/copy transient state.
- Modify: `apps/browser-extension/src/popup/App.tsx`
  Replace the unlocked placeholder shell with a real search field, result list, empty states, and password actions.
- Modify: `apps/browser-extension/src/popup/use-popup-unlock.ts`
  Expose whatever signal the popup vault hook needs to reset transient state when the popup locks.
- Create: `apps/browser-extension/tests/popup-vault-storage.spec.ts`
  Verify local vault cache storage behavior.
- Modify: `apps/browser-extension/tests/popup.spec.tsx`
  Drive the popup through real cached item, search, empty-state, and reveal/copy behavior.
- Reuse: `packages/api-client/src/vault.ts`
  Shared `VaultSyncItem` and login payload shape.
- Reuse: `packages/security/src/vault-envelope.ts`
  Shared legacy and envelope-aware password opening behavior.

## Chunk 1: Add the popup vault cache boundary

### Task 1: Create extension-local vault cache storage

**Files:**
- Create: `apps/browser-extension/src/popup/popup-vault-storage.ts`
- Create: `apps/browser-extension/tests/popup-vault-storage.spec.ts`

- [ ] **Step 1: Write the failing popup vault storage tests**

Add tests that prove:

```ts
it("reads a cached vault list from extension storage", async () => {
  await seedVaultCache([
    {
      id: "item-1",
      item_type: "login",
      title: "GitHub",
      encrypted_payload: {
        schema_version: 1,
        username: "alice@example.com",
        password_ciphertext: "",
        notes: "",
      },
      favorite: false,
      source: "manual",
      last_used_at: null,
      created_at: "2026-03-17T00:00:00.000Z",
      updated_at: "2026-03-17T00:00:00.000Z",
    },
  ]);

  expect(await readPopupVaultItems()).toHaveLength(1);
});

it("returns an empty list for malformed cached values", async () => {
  await seedRawVaultCache("not valid json");
  expect(await readPopupVaultItems()).toEqual([]);
});
```

- [ ] **Step 2: Run the focused storage test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup-vault-storage.spec.ts`
Expected: FAIL because `popup-vault-storage.ts` does not exist yet

- [ ] **Step 3: Implement the smallest vault cache storage helper**

Implementation notes:
- use one extension-local storage key for cached vault items
- read through `chrome.storage.local`
- validate array shape conservatively
- return `[]` for missing or malformed values
- keep browser API access isolated to this file

- [ ] **Step 4: Re-run the focused storage test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup-vault-storage.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the storage slice**

```bash
git add apps/browser-extension/src/popup/popup-vault-storage.ts apps/browser-extension/tests/popup-vault-storage.spec.ts
git commit -m "feat: add extension popup vault cache storage"
```

## Chunk 2: Render cached items and search results

### Task 2: Load real cached items into the unlocked popup

**Files:**
- Create: `apps/browser-extension/src/popup/login-payload.ts`
- Create: `apps/browser-extension/src/popup/use-popup-vault-search.ts`
- Modify: `apps/browser-extension/src/popup/App.tsx`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Extend popup tests with failing search-and-list coverage**

Add tests that prove:

```tsx
it("shows cached vault items after unlock", async () => {
  seedVaultCache([
    createVaultItem({ title: "GitHub", username: "alice@example.com" }),
    createVaultItem({ title: "Linear", username: "bob@example.com" }),
  ]);

  render(<App />);
  await setMasterPassword("correct horse");

  expect(await screen.findByText("GitHub")).toBeInTheDocument();
  expect(screen.getByText("alice@example.com")).toBeInTheDocument();
});

it("filters cached items by title, username, and notes", async () => {
  // seed multiple items, unlock, then type into Search vault
  expect(screen.getByText("GitHub")).toBeInTheDocument();
  expect(screen.queryByText("Linear")).not.toBeInTheDocument();
});

it("shows distinct empty states for empty cache and unmatched search", async () => {
  // verify No vault items yet. and No vault items match your search.
});
```

- [ ] **Step 2: Run the focused popup test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: FAIL because the unlocked popup still shows only the placeholder search shell

- [ ] **Step 3: Implement the smallest cached-item search flow**

Implementation notes:
- add popup-local login payload helpers parallel to the Web vault helper
- load cached items from `popup-vault-storage.ts`
- sort items by `updated_at` descending
- keep search case-insensitive across `title`, `username`, and `notes`
- wire the unlocked popup UI to render filtered items and both empty states
- keep locked/setup UI unchanged

- [ ] **Step 4: Re-run the focused popup test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: PASS for the new list/search/empty-state coverage

- [ ] **Step 5: Commit the cached-item search slice**

```bash
git add apps/browser-extension/src/popup/login-payload.ts apps/browser-extension/src/popup/use-popup-vault-search.ts apps/browser-extension/src/popup/App.tsx apps/browser-extension/tests/popup.spec.tsx
git commit -m "feat: add extension popup vault search results"
```

## Chunk 3: Add password reveal and copy behavior

### Task 3: Reuse Web password semantics for popup actions

**Files:**
- Modify: `apps/browser-extension/src/popup/login-payload.ts`
- Modify: `apps/browser-extension/src/popup/use-popup-vault-search.ts`
- Modify: `apps/browser-extension/src/popup/App.tsx`
- Modify: `apps/browser-extension/src/popup/use-popup-unlock.ts`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Extend popup tests with failing password-action coverage**

Add tests that prove:

```tsx
it("shows a masked password placeholder and reveal action for cached passwords", async () => {
  seedVaultCache([createVaultItem({ title: "GitHub", password: storedPassword("hunter2", "correct horse") })]);

  render(<App />);
  await setMasterPassword("correct horse");

  expect(await screen.findByText("••••••••")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Show password GitHub" })).toBeInTheDocument();
});

it("copies a cached password after unlock without requiring reveal first", async () => {
  // mock clipboard, unlock, click Copy password GitHub
  expect(writeText).toHaveBeenCalledWith("hunter2");
});

it("clears revealed password state after locking or remounting", async () => {
  // reveal password, lock, unlock again, confirm plaintext is gone
});
```

- [ ] **Step 2: Run the focused popup test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: FAIL because the popup does not yet expose password placeholders, reveal, copy, or transient reset behavior

- [ ] **Step 3: Implement the smallest password-action behavior**

Implementation notes:
- reuse legacy/envelope-aware password opening logic
- show `No password saved` when `password_ciphertext` is empty
- show `••••••••` until the user reveals the targeted password
- allow copy without reveal first
- keep copied feedback scoped to the targeted item
- clear reveal and copy state on lock and remount
- keep actions unavailable while locked

- [ ] **Step 4: Re-run the focused popup test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: PASS for password placeholder, reveal, copy, and reset coverage

- [ ] **Step 5: Commit the password-action slice**

```bash
git add apps/browser-extension/src/popup/login-payload.ts apps/browser-extension/src/popup/use-popup-vault-search.ts apps/browser-extension/src/popup/App.tsx apps/browser-extension/src/popup/use-popup-unlock.ts apps/browser-extension/tests/popup.spec.tsx
git commit -m "feat: add extension popup password actions"
```

## Chunk 4: Run full verification

### Task 4: Verify the popup vault search branch

**Files:**
- Modify: `apps/browser-extension/src/popup/popup-vault-storage.ts`
- Modify: `apps/browser-extension/src/popup/login-payload.ts`
- Modify: `apps/browser-extension/src/popup/use-popup-vault-search.ts`
- Modify: `apps/browser-extension/src/popup/App.tsx`
- Modify: `apps/browser-extension/src/popup/use-popup-unlock.ts`
- Modify: `apps/browser-extension/tests/popup-vault-storage.spec.ts`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Run focused browser-extension verification**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup-vault-storage.spec.ts apps/browser-extension/tests/popup.spec.tsx`
Expected: PASS

- [ ] **Step 2: Run repository verification**

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

Run: `git diff --check`
Expected: PASS

- [ ] **Step 3: Confirm feature branch state**

Run: `git status --short --branch`
Expected: only the intentional implementation changes remain before final integration steps

- [ ] **Step 4: Prepare for execution wrap-up**

Use `superpowers:verification-before-completion` before claiming the feature is done, then use `superpowers:finishing-a-development-branch` when the implementation is fully verified.
