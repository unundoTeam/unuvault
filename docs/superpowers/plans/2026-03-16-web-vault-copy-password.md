# Web Vault Copy Password Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a direct `Copy password` action to Web vault login rows without requiring password reveal first.

**Architecture:** Keep the change entirely inside the Web vault row interaction layer. Reuse the existing normalized password helpers to read the saved password value, and keep clipboard feedback state local to `vault-panel.tsx` so no API, sync, or shared-client code changes are needed.

**Tech Stack:** Next.js App Router, React, TypeScript, Testing Library, Vitest

---

## File Structure

- Modify: `apps/web/src/components/vault/vault-panel.tsx`
  Add password-copy state, clipboard interaction, and row actions.
- Modify: `apps/web/tests/vault-page.spec.tsx`
  Cover copy button visibility, clipboard writes, copied feedback, and interaction independence.

## Chunk 1: Add copy-password visibility and clipboard behavior

### Task 1: Show `Copy password` only when a saved password exists

**Files:**
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing visibility and clipboard tests**

Add focused tests like:

```tsx
it("shows copy password only when a saved password exists", async () => {
  // one item has password_ciphertext, one item does not
  // expect Copy password only for the item with a saved password
});

it("copies the saved password without requiring reveal first", async () => {
  // click Copy password on a hidden item
  // expect navigator.clipboard.writeText to receive the saved password
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because no `Copy password` action exists yet

- [ ] **Step 3: Implement the smallest copy-password action**

Implementation notes:
- add local copied-password item state in `vault-panel.tsx`
- add a `copyPassword(itemId, password)` helper next to the existing username-copy helper
- use the existing saved password value from the normalized payload boundary
- render `Copy password <title>` only when the current item has a saved password
- do not send sync requests

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for the new copy visibility and clipboard tests

- [ ] **Step 5: Commit the first slice**

```bash
git add apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault copy password action"
```

## Chunk 2: Add copied feedback and preserve reveal independence

### Task 2: Keep copied feedback local and independent from reveal state

**Files:**
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing local-feedback tests**

Add focused tests like:

```tsx
it("shows copied password feedback only for the targeted item", async () => {
  // click Copy password on one item
  // expect only that row to show Copied password
});

it("copying a password does not reveal it", async () => {
  // click Copy password
  // expect masked password text to remain
  // expect no plain password text in the row
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because copied feedback and copy/reveal independence are not fully implemented yet

- [ ] **Step 3: Implement the smallest local-feedback behavior**

Implementation notes:
- follow the existing per-item success pattern used by username copy
- add a short timeout that clears only the matching copied-password item state
- keep copied-password state separate from `revealedPasswordItemIds`
- do not auto-toggle show/hide when copying

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the feedback slice**

```bash
git add apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault password copy feedback"
```

## Chunk 3: Full verification

### Task 3: Verify the copy-password slice end to end

**Files:**
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
git add apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault copy password"
```
