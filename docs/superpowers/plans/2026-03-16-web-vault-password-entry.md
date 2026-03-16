# Web Vault Password Entry Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real password entry to Web vault create/edit flows while keeping the password boundary isolated behind payload helpers.

**Architecture:** Keep the sync contract unchanged and make password behavior real entirely within the Web client. Use helper functions in `login-payload.ts` to centralize reading, writing, and display of the current draft password so a future encryption layer can replace that boundary without rewriting the form and list UI.

**Tech Stack:** Next.js App Router, React, TypeScript, shared `packages/api-client` login payload type, Vitest, Testing Library

---

## File Structure

- Modify: `apps/web/src/components/vault/login-payload.ts`
  Add helper functions for reading, writing, and displaying the current draft password value.
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
  Extend create/update input shapes to carry password and write it through the helper boundary.
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
  Add create/edit password inputs, show/hide toggles, and list reveal of the saved password value.
- Modify: `apps/web/tests/vault-page.spec.tsx`
  Cover password create, edit, form visibility toggles, and list reveal behavior.

## Chunk 1: Add password helper boundary

### Task 1: Centralize draft password reads and writes

**Files:**
- Modify: `apps/web/src/components/vault/login-payload.ts`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing helper-driven tests**

Add tests like:

```tsx
it("reveals the saved password value for a login item", async () => {
  // seeded item has password_ciphertext set
  // click Show password
  // expect actual saved password text
});

it("keeps no-password messaging when password_ciphertext is empty", async () => {
  // seeded item has empty password_ciphertext
  // expect No password saved
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because list reveal still shows a placeholder label, not the saved value

- [ ] **Step 3: Implement the smallest helper expansion**

Implementation notes:
- keep `normalizeVaultLoginPayload(...)`
- add `readDraftPassword(...)`
- add `writeDraftPassword(payload, password)`
- update password display helper(s) to use the saved draft password value when revealed

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for the new helper-driven reveal cases

- [ ] **Step 5: Commit the helper slice**

```bash
git add apps/web/src/components/vault/login-payload.ts apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault password payload helpers"
```

## Chunk 2: Add password input to create flow

### Task 2: Support password entry in the create form

**Files:**
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing create-flow password tests**

Add tests like:

```tsx
it("creates a login item with a password value", async () => {
  // fill title + password
  // save
  // expect changed_items[0].encrypted_payload.password_ciphertext
});

it("resets the create password field and hides it after save", async () => {
  // fill password
  // save
  // expect create password input cleared
  // expect create password input back in hidden mode
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because the create form has no password input yet

- [ ] **Step 3: Implement the smallest create password flow**

Implementation notes:
- extend the local create input shape with `password`
- add `draftPassword`
- add local show/hide state for the create password input
- write the password through `writeDraftPassword(...)`
- keep title as the only required field

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for the new create password cases

- [ ] **Step 5: Commit the create password slice**

```bash
git add apps/web/src/components/vault/login-payload.ts apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault password create flow"
```

## Chunk 3: Add password input to edit flow and real list reveal

### Task 3: Support password editing and row-level reveal of saved value

**Files:**
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing edit-flow password tests**

Add tests like:

```tsx
it("prefills the saved password in edit mode", async () => {
  // click Edit
  // expect password input has saved value
});

it("saves an updated password through changed_items", async () => {
  // edit password
  // save
  // expect changed_items payload includes updated password_ciphertext
});

it("toggles password input visibility during edit mode", async () => {
  // password input starts hidden
  // click Show password
  // expect input type becomes text
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because edit mode has no password field yet

- [ ] **Step 3: Implement the smallest edit and reveal expansion**

Implementation notes:
- extend edit state with `editingPassword`
- add local show/hide state for the edit password input
- prefill password with `readDraftPassword(...)`
- update save flow through `writeDraftPassword(...)`
- change list reveal so `Show password` displays the saved password value for that item
- keep reveal state per item only

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the edit password slice**

```bash
git add apps/web/src/components/vault/login-payload.ts apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault password edit flow"
```

## Chunk 4: Full verification

### Task 4: Verify the password-entry slice end to end

**Files:**
- Modify: `apps/web/src/components/vault/login-payload.ts`
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
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
git add apps/web/src/components/vault/login-payload.ts apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault password entry"
```
