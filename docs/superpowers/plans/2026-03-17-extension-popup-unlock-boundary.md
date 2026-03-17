# Extension Popup Unlock Boundary Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a popup-only master password setup and unlock boundary for the browser extension so it mirrors the Web vault's `needs_setup`, `locked`, and `unlocked` states.

**Architecture:** Reuse the shared verifier helper in `packages/security`, add a small extension-specific verifier storage adapter, then replace the popup placeholder with a focused state machine and UI shell. Keep the unlock passphrase in popup memory only, and keep autofill, sync, and background messaging out of scope.

**Tech Stack:** TypeScript, React, Vitest, browser-extension popup UI, shared `packages/security`

---

## File Structure

- Create: `apps/browser-extension/src/popup/master-password-storage.ts`
  Read and write the popup verifier through an extension-local storage adapter.
- Create: `apps/browser-extension/src/popup/use-popup-unlock.ts`
  Own popup `needs_setup` / `locked` / `unlocked` state.
- Modify: `apps/browser-extension/src/popup/App.tsx`
  Replace placeholder search input with setup, unlock, and unlocked shells.
- Modify: `apps/browser-extension/tests/popup.spec.tsx`
  Cover first-run setup, unlock, remount, and unlocked placeholder view.
- Create: `apps/browser-extension/tests/master-password-storage.spec.ts`
  Verify popup storage helper behavior.
- Reuse: `packages/security/src/master-password-verifier.ts`
  Shared verifier generation and validation.

## Chunk 1: Add popup verifier storage

### Task 1: Create an extension-local verifier storage helper

**Files:**
- Create: `apps/browser-extension/src/popup/master-password-storage.ts`
- Create: `apps/browser-extension/tests/master-password-storage.spec.ts`

- [ ] **Step 1: Write the failing storage tests**

Add tests that prove:

```ts
it("round-trips a stored verifier", async () => {
  const verifier = createMasterPasswordVerifier("correct horse");
  await writeMasterPasswordVerifier(verifier);
  expect(await readMasterPasswordVerifier()).toEqual(verifier);
});

it("fails closed for malformed storage values", async () => {
  // seed malformed value
  expect(await readMasterPasswordVerifier()).toBeNull();
});
```

- [ ] **Step 2: Run the focused popup storage test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/master-password-storage.spec.ts`
Expected: FAIL because the helper does not exist yet

- [ ] **Step 3: Implement the smallest popup storage helper**

Implementation notes:
- add one extension-specific storage key
- expose async `read`, `write`, and `clear` helpers
- isolate browser storage API access in this one file
- fail closed to `null` on malformed or missing data

- [ ] **Step 4: Re-run the focused popup storage test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/master-password-storage.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the popup storage slice**

```bash
git add apps/browser-extension/src/popup/master-password-storage.ts apps/browser-extension/tests/master-password-storage.spec.ts
git commit -m "feat: add extension popup verifier storage"
```

## Chunk 2: Add popup unlock state

### Task 2: Build the popup `needs_setup` / `locked` / `unlocked` state machine

**Files:**
- Create: `apps/browser-extension/src/popup/use-popup-unlock.ts`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Write the failing popup state tests**

Add tests like:

```tsx
it("shows setup mode when no verifier exists", async () => {
  render(<App />);
  expect(await screen.findByRole("button", { name: "Set master password" })).toBeInTheDocument();
});

it("shows locked mode when a verifier exists", async () => {
  // seed verifier
  render(<App />);
  expect(await screen.findByRole("button", { name: "Unlock vault" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused popup test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: FAIL because the popup still renders the placeholder search input

- [ ] **Step 3: Implement the smallest popup unlock hook**

Implementation notes:
- add explicit popup modes: `needs_setup`, `locked`, `unlocked`
- read stored verifier on popup mount
- during setup:
  - require non-empty password
  - require matching confirmation
  - create and persist verifier
  - keep the entered master password only in memory
- during unlock:
  - require non-empty password
  - validate against stored verifier
  - keep the entered master password only in memory
- on lock:
  - clear only in-memory unlock state and transient errors

- [ ] **Step 4: Re-run the focused popup test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: still FAIL, but only because the popup UI has not been updated to consume the hook yet

- [ ] **Step 5: Commit the popup unlock hook**

```bash
git add apps/browser-extension/src/popup/use-popup-unlock.ts apps/browser-extension/tests/popup.spec.tsx
git commit -m "feat: add extension popup unlock state"
```

## Chunk 3: Replace the popup placeholder UI

### Task 3: Render setup, locked, and unlocked popup shells

**Files:**
- Modify: `apps/browser-extension/src/popup/App.tsx`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Extend the failing popup UI tests**

Add coverage for:

```tsx
it("unlocks immediately after setting the first master password", async () => {
  render(<App />);
  // enter password + confirmation
  expect(await screen.findByText("Vault unlocked")).toBeInTheDocument();
});

it("returns to locked mode after remount", async () => {
  const firstRender = render(<App />);
  // complete setup
  firstRender.unmount();
  render(<App />);
  expect(await screen.findByRole("button", { name: "Unlock vault" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused popup test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: FAIL because the placeholder popup UI does not render the new states yet

- [ ] **Step 3: Implement the smallest popup UI**

Implementation notes:
- replace the placeholder search input with stateful popup shells
- `needs_setup` shows:
  - `Master password`
  - `Confirm master password`
  - `Set master password`
- `locked` shows:
  - `Master password`
  - `Unlock vault`
- `unlocked` shows:
  - `Vault unlocked`
  - `Lock vault`
  - `Search vault`
  - `Vault search will connect in the next slice`
- keep styling minimal and follow current repo conventions

- [ ] **Step 4: Re-run the focused popup test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the popup UI update**

```bash
git add apps/browser-extension/src/popup/App.tsx apps/browser-extension/tests/popup.spec.tsx
git commit -m "feat: add extension popup master password flow"
```

## Chunk 4: Run full verification

### Task 4: Verify the popup boundary on the feature branch

**Files:**
- Modify: `apps/browser-extension/src/popup/master-password-storage.ts`
- Modify: `apps/browser-extension/src/popup/use-popup-unlock.ts`
- Modify: `apps/browser-extension/src/popup/App.tsx`
- Modify: `apps/browser-extension/tests/master-password-storage.spec.ts`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Run focused verification**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/master-password-storage.spec.ts apps/browser-extension/tests/popup.spec.tsx`
Expected: PASS

- [ ] **Step 2: Run repo-wide verification**

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

Run: `git diff --check`
Expected: PASS

- [ ] **Step 3: Confirm worktree state is clean**

Run: `git status --short --branch`
Expected: no modified files

- [ ] **Step 4: Prepare for integration**

Use the `superpowers:finishing-a-development-branch` workflow after implementation and verification are complete.
