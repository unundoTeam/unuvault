# Web Vault Master Password Setup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-run Web master-password setup flow so the vault can distinguish `needs_setup`, `locked`, and `unlocked` without changing the API or sync contract.

**Architecture:** Add a small shared verifier helper in `packages/security`, then persist only verifier metadata in browser `localStorage` while keeping the actual master password in page memory. Expand the existing Web unlock state to drive first-run setup and later unlock flows, and keep all password actions gated behind that state.

**Tech Stack:** TypeScript, React, Next.js App Router, Vitest, browser `localStorage`, shared `packages/security`

---

## File Structure

- Create: `packages/security/src/master-password-verifier.ts`
  Create and validate browser-local master-password verifier objects.
- Create: `packages/security/tests/master-password-verifier.spec.ts`
  Cover correct, incorrect, and malformed verifier behavior.
- Create: `apps/web/src/components/vault/master-password-storage.ts`
  Isolate browser `localStorage` read/write/parse behavior for the verifier.
- Modify: `apps/web/src/components/vault/use-vault-unlock.ts`
  Expand from simple lock state to `needs_setup` / `locked` / `unlocked`.
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
  Render setup versus unlock UI and keep password actions gated.
- Modify: `apps/web/tests/vault-page.spec.tsx`
  Cover first-run setup, reload-to-locked behavior, and unlock validation.

## Chunk 1: Add a shared master-password verifier helper

### Task 1: Create verifier generation and validation in `packages/security`

**Files:**
- Create: `packages/security/src/master-password-verifier.ts`
- Create: `packages/security/tests/master-password-verifier.spec.ts`

- [ ] **Step 1: Write the failing verifier tests**

Add tests like:

```ts
it("validates the same master password that created the verifier", () => {
  const verifier = createMasterPasswordVerifier("correct horse");
  expect(verifyMasterPassword(verifier, "correct horse")).toBe(true);
});

it("rejects an incorrect master password", () => {
  const verifier = createMasterPasswordVerifier("correct horse");
  expect(verifyMasterPassword(verifier, "wrong battery")).toBe(false);
});
```

- [ ] **Step 2: Run the focused security suite to verify it fails**

Run: `./node_modules/.bin/vitest --run packages/security/tests/master-password-verifier.spec.ts`
Expected: FAIL because the helper does not exist yet

- [ ] **Step 3: Implement the smallest verifier helper**

Implementation notes:
- export a versioned verifier type with `version`, `salt`, and `check`
- generate browser-safe random salt bytes
- derive the `check` value only from `masterPassword + salt`
- fail safely when verifier input is malformed or unsupported
- keep this helper React-free and storage-free

- [ ] **Step 4: Re-run the focused security suite**

Run: `./node_modules/.bin/vitest --run packages/security/tests/master-password-verifier.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the verifier helper**

```bash
git add packages/security/src/master-password-verifier.ts packages/security/tests/master-password-verifier.spec.ts
git commit -m "feat: add master password verifier helper"
```

## Chunk 2: Add browser-local storage for verifier state

### Task 2: Isolate verifier persistence in a small Web helper

**Files:**
- Create: `apps/web/src/components/vault/master-password-storage.ts`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing storage-facing tests**

Add tests that prove:

```tsx
it("shows setup mode when no verifier is stored", async () => {
  window.localStorage.clear();
  render(<VaultPage />);
  expect(await screen.findByRole("button", { name: "Set master password" })).toBeInTheDocument();
});

it("shows locked mode when a verifier is already stored", async () => {
  // seed localStorage with a valid verifier
  render(<VaultPage />);
  expect(await screen.findByRole("button", { name: "Unlock vault" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because there is no persistent verifier layer yet

- [ ] **Step 3: Implement the smallest browser storage helper**

Implementation notes:
- define one localStorage key for the Web vault verifier
- add `readMasterPasswordVerifier`, `writeMasterPasswordVerifier`, and `clearMasterPasswordVerifier`
- return `null` for missing or malformed storage values
- keep all `window` and `localStorage` handling in this one file

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: still FAIL, but now only because the unlock hook does not consume the storage helper yet

- [ ] **Step 5: Commit the storage helper**

```bash
git add apps/web/src/components/vault/master-password-storage.ts apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web master password storage helper"
```

## Chunk 3: Expand unlock state into setup, locked, and unlocked

### Task 3: Teach `use-vault-unlock` about first-run setup

**Files:**
- Modify: `apps/web/src/components/vault/use-vault-unlock.ts`
- Modify: `apps/web/src/components/vault/master-password-storage.ts`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing state-transition tests**

Add tests like:

```tsx
it("unlocks immediately after setting the first master password", async () => {
  render(<VaultPage />);
  // enter password + confirm
  expect(await screen.findByText("Vault unlocked")).toBeInTheDocument();
});

it("shows an error for a wrong master password", async () => {
  // seed verifier, render, enter wrong password
  expect(await screen.findByText("Wrong master password")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because the hook only supports the existing in-memory unlock passphrase

- [ ] **Step 3: Implement the smallest state-machine upgrade**

Implementation notes:
- add explicit modes such as `needs_setup`, `locked`, and `unlocked`
- on mount, read the local verifier to choose initial mode
- during setup:
  - require non-empty password
  - require matching confirmation
  - write verifier to storage
  - keep the entered password only in memory
- during unlock:
  - require non-empty password
  - verify against stored verifier
  - keep the entered password only in memory
- on lock:
  - clear only in-memory password and transient errors
  - keep verifier in storage

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for setup and unlock state transitions

- [ ] **Step 5: Commit the state-machine slice**

```bash
git add apps/web/src/components/vault/use-vault-unlock.ts apps/web/src/components/vault/master-password-storage.ts apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault master password state"
```

## Chunk 4: Update the vault UI to use the new master-password states

### Task 4: Render setup and lock UI while preserving existing password gating

**Files:**
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing UI-behavior tests**

Add or update tests like:

```tsx
it("disables password actions before setup completes", async () => {
  render(<VaultPage />);
  expect(screen.getByRole("button", { name: "Copy password GitHub" })).toBeDisabled();
});

it("returns to locked mode after a remount when a verifier exists", async () => {
  const firstRender = render(<VaultPage />);
  // complete setup
  firstRender.unmount();
  render(<VaultPage />);
  expect(await screen.findByRole("button", { name: "Unlock vault" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because the panel still only renders the older unlock form

- [ ] **Step 3: Implement the smallest UI changes**

Implementation notes:
- render separate form variants for `needs_setup`, `locked`, and `unlocked`
- show `Master password` and `Confirm master password` only during setup
- keep the existing vault list visible in all three states
- continue passing the in-memory unlocked passphrase into existing create/edit/reveal/copy flows
- keep password actions blocked unless the state is `unlocked`

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the panel update**

```bash
git add apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault master password setup flow"
```

## Chunk 5: Run full verification and document completion

### Task 5: Verify the full slice on the feature branch

**Files:**
- Modify: `packages/security/src/master-password-verifier.ts`
- Modify: `packages/security/tests/master-password-verifier.spec.ts`
- Modify: `apps/web/src/components/vault/master-password-storage.ts`
- Modify: `apps/web/src/components/vault/use-vault-unlock.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Run focused verification**

Run: `./node_modules/.bin/vitest --run packages/security/tests/master-password-verifier.spec.ts apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 2: Run repo-wide verification**

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

Run: `git diff --check`
Expected: PASS

- [ ] **Step 3: Commit final verification updates**

```bash
git add packages/security/src/master-password-verifier.ts packages/security/tests/master-password-verifier.spec.ts apps/web/src/components/vault/master-password-storage.ts apps/web/src/components/vault/use-vault-unlock.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault master password setup"
```
