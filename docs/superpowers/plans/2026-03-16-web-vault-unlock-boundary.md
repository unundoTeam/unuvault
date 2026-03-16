# Web Vault Unlock Boundary Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Web-only unlock passphrase boundary so password reveal/copy/edit requires local unlock while the sync and API contracts stay unchanged.

**Architecture:** Expand the shared security helpers to seal/open password envelopes with a passphrase, then add a small in-memory unlock state to the Web vault. Keep non-password fields visible while locked, gate password actions behind unlock, and preserve legacy plaintext compatibility after unlock.

**Tech Stack:** TypeScript, React, Next.js App Router, Vitest, shared `packages/security`, Web vault components under `apps/web`

---

## File Structure

- Modify: `packages/security/src/vault-envelope.ts`
  Add passphrase-aware seal/open helpers and keep legacy storage compatibility.
- Modify: `packages/security/tests/vault-envelope.spec.ts`
  Cover correct and incorrect passphrase behavior plus legacy compatibility.
- Create: `apps/web/src/components/vault/use-vault-unlock.ts`
  Own current-page unlock state and error handling.
- Modify: `apps/web/src/components/vault/login-payload.ts`
  Require explicit unlock context for opening and sealing password values.
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
  Add the unlock UI and gate password-specific actions while locked.
- Modify: `apps/web/tests/vault-page.spec.tsx`
  Cover locked/unlocked UX and wrong-passphrase behavior.

## Chunk 1: Make the security helpers passphrase-aware

### Task 1: Add passphrase-based seal/open behavior in `packages/security`

**Files:**
- Modify: `packages/security/src/vault-envelope.ts`
- Modify: `packages/security/tests/vault-envelope.spec.ts`

- [ ] **Step 1: Write the failing security tests**

Add or update tests like:

```ts
it("round-trips a password with the same unlock passphrase", () => {
  const ciphertext = sealVaultPassword("hunter2", "correct horse");
  expect(openVaultPassword(ciphertext, "correct horse")).toBe("hunter2");
});

it("fails closed with the wrong unlock passphrase", () => {
  const ciphertext = sealVaultPassword("hunter2", "correct horse");
  expect(openVaultPassword(ciphertext, "wrong battery")).toBe("");
});
```

- [ ] **Step 2: Run the focused security suite to verify it fails**

Run: `./node_modules/.bin/vitest --run packages/security/tests/vault-envelope.spec.ts`
Expected: FAIL because the helper contract is not passphrase-aware yet

- [ ] **Step 3: Implement the smallest passphrase-aware helpers**

Implementation notes:
- keep the serialized envelope shape versioned
- add enough metadata to validate passphrase-based opening
- keep legacy plaintext support in the storage helper
- fail closed for invalid or mismatched passphrases

- [ ] **Step 4: Re-run the focused security suite**

Run: `./node_modules/.bin/vitest --run packages/security/tests/vault-envelope.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the security slice**

```bash
git add packages/security/src/vault-envelope.ts packages/security/tests/vault-envelope.spec.ts
git commit -m "feat: add passphrase-based vault unlock helpers"
```

## Chunk 2: Add in-memory unlock state for the Web vault

### Task 2: Create a focused unlock state unit

**Files:**
- Create: `apps/web/src/components/vault/use-vault-unlock.ts`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing unlock-state tests**

Add or update tests like:

```tsx
it("starts locked after the page loads", async () => {
  render(<VaultPage />);
  expect(screen.getByText("Unlock vault")).toBeInTheDocument();
});

it("returns to locked state after a remount", async () => {
  const { unmount } = render(<VaultPage />);
  // unlock once
  unmount();
  render(<VaultPage />);
  expect(screen.getByText("Unlock vault")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because there is no unlock state yet

- [ ] **Step 3: Implement the smallest in-memory unlock state**

Implementation notes:
- keep passphrase only in React state
- expose `isUnlocked`, `unlock`, `lock`, and error state
- do not add `localStorage`, cookies, or server persistence

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the unlock-state slice**

```bash
git add apps/web/src/components/vault/use-vault-unlock.ts apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault unlock state"
```

## Chunk 3: Gate payload access and UI actions behind unlock

### Task 3: Require unlock for reveal, copy, and password editing

**Files:**
- Modify: `apps/web/src/components/vault/login-payload.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing locked/unlocked interaction tests**

Add or update tests like:

```tsx
it("blocks copy password while locked", async () => {
  render(<VaultPage />);
  await user.click(screen.getByRole("button", { name: "Copy password" }));
  expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
});

it("reveals the password after unlock", async () => {
  render(<VaultPage />);
  // unlock with the correct passphrase
  await user.click(screen.getByRole("button", { name: "Show password" }));
  expect(screen.getByText("hunter2")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because password actions are still always available

- [ ] **Step 3: Implement the smallest unlock-aware UI boundary**

Implementation notes:
- show a compact unlock form at the top of the panel
- keep title, username, and notes visible while locked
- disable or short-circuit reveal/copy/password edit while locked
- surface a short wrong-passphrase error and keep the vault locked
- allow create/update only when password sealing has an active unlock passphrase

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the unlock-gating slice**

```bash
git add apps/web/src/components/vault/login-payload.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: gate web vault passwords behind unlock"
```

## Chunk 4: Preserve legacy compatibility and verify the full slice

### Task 4: Keep legacy plaintext behavior intact and run full verification

**Files:**
- Modify: `packages/security/src/vault-envelope.ts`
- Modify: `packages/security/tests/vault-envelope.spec.ts`
- Modify: `apps/web/src/components/vault/use-vault-unlock.ts`
- Modify: `apps/web/src/components/vault/login-payload.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Add focused legacy-compatibility tests**

Add or update tests like:

```tsx
it("opens a legacy plaintext password after unlock", async () => {
  // seeded item has plaintext password_ciphertext
  // unlock
  // reveal password
  // expect plaintext in UI
});

it("reseals a legacy plaintext password on save with the active unlock passphrase", async () => {
  // unlock, edit, save
  // expect outgoing ciphertext not to equal raw plaintext
});
```

- [ ] **Step 2: Run focused suites**

Run: `./node_modules/.bin/vitest --run packages/security/tests/vault-envelope.spec.ts`
Expected: PASS

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 3: Run repo-wide verification**

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

Run: `git diff --check`
Expected: PASS

- [ ] **Step 4: Commit the verified slice**

```bash
git add packages/security/src/vault-envelope.ts packages/security/tests/vault-envelope.spec.ts apps/web/src/components/vault/use-vault-unlock.ts apps/web/src/components/vault/login-payload.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault unlock boundary"
```
