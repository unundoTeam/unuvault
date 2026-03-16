# Web Vault Copy Username And Password Placeholder Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Copy username` and per-item password placeholder show/hide behavior to the Web vault without changing sync or real password handling.

**Architecture:** Keep sync behavior unchanged and implement the new interactions entirely in the Web vault UI. Derive password placeholder behavior from the normalized login payload and keep copy/reveal state local to each rendered item row.

**Tech Stack:** Next.js App Router, React, TypeScript, shared `packages/api-client` login payload type, Vitest, Testing Library

---

## File Structure

- Modify: `apps/web/src/components/vault/login-payload.ts`
  Add small helpers for deriving whether a login item has a saved password and what placeholder text to show.
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
  Add per-item copy state, per-item reveal state, inline action buttons, and the password row.
- Modify: `apps/web/tests/vault-page.spec.tsx`
  Cover copy, copied state, empty-password display, and show/hide behavior.

## Chunk 1: Add payload-derived password placeholder helpers

### Task 1: Extend the login payload helper for password placeholder state

**Files:**
- Modify: `apps/web/src/components/vault/login-payload.ts`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing Web tests for password display states**

Add tests like:

```tsx
it("shows no password saved when password_ciphertext is empty", async () => {
  // seeded item with empty password_ciphertext
  // expect "No password saved"
  // expect no "Show password" button
});

it("shows a masked placeholder and reveal action when password_ciphertext exists", async () => {
  // seeded item with non-empty password_ciphertext
  // expect "••••••••"
  // expect "Show password"
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because the vault row does not render any password state yet

- [ ] **Step 3: Implement the smallest payload helper expansion**

Implementation notes:
- keep `normalizeVaultLoginPayload(...)`
- add a helper like `hasSavedPassword(...)`
- add a helper like `getPasswordPlaceholderLabel(isRevealed, payload)`
- do not introduce real decryption logic

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for the new password-state tests

- [ ] **Step 5: Commit the payload-helper slice**

```bash
git add apps/web/src/components/vault/login-payload.ts apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add vault password placeholder helpers"
```

## Chunk 2: Add copy username behavior

### Task 2: Support per-item username copy with local copied feedback

**Files:**
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing copy-username tests**

Add tests like:

```tsx
it("shows copy username only when username exists", async () => {
  // one item with username, one without
  // expect copy button only for the populated item
});

it("copies the username and shows copied feedback", async () => {
  // mock navigator.clipboard.writeText
  // click copy
  // expect writeText called with username
  // expect button text becomes "Copied"
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because copy controls and clipboard behavior do not exist yet

- [ ] **Step 3: Implement the smallest copy behavior**

Implementation notes:
- keep copy state local in `vault-panel.tsx`
- store copied item id in local state
- use `navigator.clipboard.writeText(...)`
- render `Copy username` only when `username.trim()` is non-empty
- switch button label to `Copied` after success
- clear copied state with a short timeout

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for the copy cases

- [ ] **Step 5: Commit the copy-username slice**

```bash
git add apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault username copy action"
```

## Chunk 3: Add per-item password show/hide behavior

### Task 3: Reveal and hide password placeholder state per item

**Files:**
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing reveal/hide tests**

Add tests like:

```tsx
it("reveals only the targeted item's password placeholder", async () => {
  // two items with non-empty password_ciphertext
  // click Show password on one item
  // expect only one row to show revealed placeholder label
});

it("hides the placeholder again when Hide password is clicked", async () => {
  // reveal first
  // click Hide password
  // expect masked placeholder text restored
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because reveal state does not exist yet

- [ ] **Step 3: Implement the smallest reveal/hide behavior**

Implementation notes:
- track revealed item ids in local component state
- render `Show password` only when `password_ciphertext` is non-empty and item is hidden
- render `Hide password` only when the item is currently revealed
- display `••••••••` while hidden
- display `Encrypted password placeholder` while revealed
- do not affect sync state, edit state, or other items

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the reveal/hide slice**

```bash
git add apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault password placeholder state"
```

## Chunk 4: Full verification

### Task 4: Verify the copy-and-placeholder slice end to end

**Files:**
- Modify: `apps/web/src/components/vault/login-payload.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Run the focused Web suite**

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
git add apps/web/src/components/vault/login-payload.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault copy and password placeholder states"
```
