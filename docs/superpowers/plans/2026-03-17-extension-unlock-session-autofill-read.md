# Extension Unlock Session And Autofill Read Path Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move extension unlock state from popup-local memory into background memory, let popup reuse that shared session, and add a narrow autofill readiness path without exposing decrypted vault contents to content scripts.

**Architecture:** Add a background unlock runtime that reads the existing verifier, creates/clears an in-memory passphrase session, and exposes typed unlock actions through the background protocol. Add a background-only unlocked vault reader plus a coarse autofill status action, then update popup unlock and content autofill callers to use those background-owned boundaries.

**Tech Stack:** TypeScript, React, Vitest, `chrome.runtime.sendMessage`, `chrome.storage.local`, shared `packages/security` helpers

---

## File Structure

- Create: `apps/browser-extension/src/background/unlock-session.ts`
  Hold the in-memory unlock passphrase and verifier-driven unlock logic.
- Create: `apps/browser-extension/src/background/unlocked-vault.ts`
  Read cached vault items and decrypt them for background-only consumers.
- Modify: `apps/browser-extension/src/background/protocol.ts`
  Add unlock and autofill request/response types.
- Modify: `apps/browser-extension/src/background/runtime.ts`
  Route unlock and autofill actions to the new background units.
- Modify: `apps/browser-extension/src/popup/background-client.ts`
  Add typed popup callers for unlock-state reads, unlock, and lock.
- Modify: `apps/browser-extension/src/popup/use-popup-unlock.ts`
  Replace popup-local unlock truth with background-driven unlock state.
- Modify: `apps/browser-extension/src/popup/App.tsx`
  Keep the current UI but bind unlock/lock behavior to the new background state.
- Modify: `apps/browser-extension/src/content/autofill.ts`
  Keep password-field detection and add background-backed autofill readiness.
- Test: `apps/browser-extension/tests/background-unlock.spec.ts`
  Verify background unlock runtime behavior.
- Test: `apps/browser-extension/tests/background-unlocked-vault.spec.ts`
  Verify unlocked vault reading and autofill status behavior.
- Modify: `apps/browser-extension/tests/popup.spec.tsx`
  Cover popup/background unlock integration and remount behavior.
- Modify: `apps/browser-extension/tests/autofill.spec.ts`
  Cover background-backed autofill readiness states.

## Chunk 1: Add background unlock runtime and protocol

### Task 1: Add failing tests for background unlock runtime

**Files:**
- Create: `apps/browser-extension/tests/background-unlock.spec.ts`

- [ ] **Step 1: Write the failing unlock runtime tests**

Add tests that prove:

```ts
it("reports needs_setup when no verifier exists", async () => {
  await expect(runtime.readUnlockState()).resolves.toEqual({ mode: "needs_setup" });
});

it("creates a verifier and unlocks on first setup", async () => {
  await expect(runtime.unlockWithPassphrase("correct horse")).resolves.toEqual({
    ok: true,
    unlockState: { mode: "unlocked" },
  });
});

it("returns locked for a stored verifier without an active session", async () => {
  await seedVerifier("correct horse");
  await expect(runtime.readUnlockState()).resolves.toEqual({ mode: "locked" });
});
```

- [ ] **Step 2: Run the focused unlock-runtime test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlock.spec.ts`
Expected: FAIL because `unlock-session.ts` does not exist yet

- [ ] **Step 3: Implement the smallest background unlock runtime**

Implementation notes:
- keep the active passphrase in module-local memory only
- read the existing verifier through `master-password-storage.ts`
- if no verifier exists, `unlockWithPassphrase` should create one and unlock
- if a verifier exists, `unlockWithPassphrase` should verify before unlocking
- `readUnlockState` must return only `needs_setup`, `locked`, or `unlocked`

- [ ] **Step 4: Re-run the focused unlock-runtime test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlock.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the background unlock runtime**

```bash
git add apps/browser-extension/src/background/unlock-session.ts apps/browser-extension/tests/background-unlock.spec.ts
git commit -m "feat: add extension unlock runtime"
```

### Task 2: Extend background protocol and runtime for unlock actions

**Files:**
- Modify: `apps/browser-extension/src/background/protocol.ts`
- Modify: `apps/browser-extension/src/background/runtime.ts`
- Modify: `apps/browser-extension/tests/background-unlock.spec.ts`

- [ ] **Step 1: Extend the unlock tests with failing runtime-dispatch coverage**

Add tests that prove:

```ts
it("routes read_extension_unlock_state through the background runtime", async () => {
  const response = await handleBackgroundRequest({ type: "read_extension_unlock_state" }, deps);
  expect(response).toEqual({ ok: true, unlockState: { mode: "locked" } });
});

it("routes unlock_extension_vault and lock_extension_vault through the background runtime", async () => {
  // assert unlock/lock methods are called with the passphrase and lock clears state
});
```

- [ ] **Step 2: Run the focused unlock-runtime test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlock.spec.ts`
Expected: FAIL because the protocol and runtime do not know about unlock actions yet

- [ ] **Step 3: Implement the smallest typed unlock protocol**

Implementation notes:
- add request types for `read_extension_unlock_state`, `unlock_extension_vault`, and `lock_extension_vault`
- add response shapes with `unlockState`
- keep runtime error messages user-friendly and fail closed

- [ ] **Step 4: Re-run the focused unlock-runtime test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlock.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the unlock protocol slice**

```bash
git add apps/browser-extension/src/background/protocol.ts apps/browser-extension/src/background/runtime.ts apps/browser-extension/tests/background-unlock.spec.ts
git commit -m "feat: add extension unlock protocol"
```

## Chunk 2: Move popup unlock to background ownership

### Task 3: Add popup background-client unlock helpers

**Files:**
- Modify: `apps/browser-extension/src/popup/background-client.ts`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Extend popup tests with failing background unlock calls**

Add tests that prove:

```tsx
it("reads background unlock state on mount", async () => {
  render(<App />);
  expect(sendMessage).toHaveBeenCalledWith({ type: "read_extension_unlock_state" });
});

it("calls background unlock when submitting the master password", async () => {
  await unlockVault("correct horse");
  expect(sendMessage).toHaveBeenCalledWith({
    type: "unlock_extension_vault",
    passphrase: "correct horse",
  });
});
```

- [ ] **Step 2: Run the focused popup test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: FAIL because popup background clients do not expose unlock calls yet

- [ ] **Step 3: Implement the smallest popup unlock client helpers**

Implementation notes:
- keep using the existing `callBackground` helper
- add typed helpers for reading unlock state, unlocking, and locking
- keep response validation strict

- [ ] **Step 4: Re-run the focused popup test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: still FAIL, but only for popup hook/UI behavior

- [ ] **Step 5: Commit the popup background unlock client**

```bash
git add apps/browser-extension/src/popup/background-client.ts apps/browser-extension/tests/popup.spec.tsx
git commit -m "feat: add popup unlock background client"
```

### Task 4: Move popup unlock state to the background runtime

**Files:**
- Modify: `apps/browser-extension/src/popup/use-popup-unlock.ts`
- Modify: `apps/browser-extension/src/popup/App.tsx`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Extend popup tests with failing remount and lock coverage**

Add tests that prove:

```tsx
it("restores unlocked UI after remount when the background session still exists", async () => {
  // render, unlock, unmount, re-render, expect unlocked UI without re-entering password
});

it("locks through background and returns to locked UI", async () => {
  // unlock, click Lock vault, expect locked mode and cleared drafts
});
```

- [ ] **Step 2: Run the focused popup test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: FAIL because `use-popup-unlock.ts` still keeps popup-local session truth

- [ ] **Step 3: Implement the smallest background-driven popup unlock hook**

Implementation notes:
- load unlock mode from background on mount
- keep confirm-password equality validation in popup
- delegate setup/unlock to `unlock_extension_vault`
- delegate lock to `lock_extension_vault`
- stop using popup-local passphrase presence as the authoritative unlocked signal

- [ ] **Step 4: Re-run the focused popup test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the popup unlock migration**

```bash
git add apps/browser-extension/src/popup/use-popup-unlock.ts apps/browser-extension/src/popup/App.tsx apps/browser-extension/tests/popup.spec.tsx
git commit -m "feat: share extension unlock state in background"
```

## Chunk 3: Add background unlocked vault reading and autofill status

### Task 5: Add failing tests for unlocked vault reading

**Files:**
- Create: `apps/browser-extension/tests/background-unlocked-vault.spec.ts`

- [ ] **Step 1: Write the failing unlocked-vault tests**

Add tests that prove:

```ts
it("returns no readable items when signed out", async () => {
  await expect(reader.readUnlockedLoginItems()).resolves.toEqual([]);
});

it("returns no readable items when signed in but locked", async () => {
  await expect(reader.readUnlockedLoginItems()).resolves.toEqual([]);
});

it("returns decrypted login items when signed in and unlocked", async () => {
  await seedVaultCache([createEncryptedVaultItem()]);
  await expect(reader.readUnlockedLoginItems()).resolves.toEqual([
    expect.objectContaining({
      title: "GitHub",
      username: "alice@example.com",
      password: "hunter2",
      hasPassword: true,
    }),
  ]);
});
```

- [ ] **Step 2: Run the focused unlocked-vault test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlocked-vault.spec.ts`
Expected: FAIL because `unlocked-vault.ts` does not exist yet

- [ ] **Step 3: Implement the smallest background unlocked-vault reader**

Implementation notes:
- read auth state and fail closed unless signed in
- read unlock state/session and fail closed unless unlocked
- read cached items from `popup-vault-storage.ts`
- only include `item_type === "login"`
- use `normalizeVaultLoginPayload` and `openStoredVaultPassword`
- return a simplified login-item shape

- [ ] **Step 4: Re-run the focused unlocked-vault test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlocked-vault.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the unlocked-vault reader**

```bash
git add apps/browser-extension/src/background/unlocked-vault.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts
git commit -m "feat: add unlocked vault reader for extension"
```

### Task 6: Add background autofill status action

**Files:**
- Modify: `apps/browser-extension/src/background/protocol.ts`
- Modify: `apps/browser-extension/src/background/runtime.ts`
- Modify: `apps/browser-extension/tests/background-unlocked-vault.spec.ts`

- [ ] **Step 1: Extend unlocked-vault tests with failing autofill-status coverage**

Add tests that prove:

```ts
it("returns signed_out autofill status when auth is missing", async () => {
  const response = await handleBackgroundRequest({ type: "read_autofill_status" }, deps);
  expect(response).toEqual({ ok: true, autofillStatus: { status: "signed_out" } });
});

it("returns ready autofill status when at least one readable login item exists", async () => {
  const response = await handleBackgroundRequest({ type: "read_autofill_status" }, deps);
  expect(response).toEqual({ ok: true, autofillStatus: { status: "ready" } });
});
```

- [ ] **Step 2: Run the focused unlocked-vault test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlocked-vault.spec.ts`
Expected: FAIL because the background protocol/runtime do not expose autofill status yet

- [ ] **Step 3: Implement the narrow autofill status action**

Implementation notes:
- do not expose decrypted item contents through the protocol
- derive only `signed_out`, `locked`, `empty`, or `ready`
- keep this as a thin wrapper over the unlocked-vault reader

- [ ] **Step 4: Re-run the focused unlocked-vault test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlocked-vault.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the autofill status action**

```bash
git add apps/browser-extension/src/background/protocol.ts apps/browser-extension/src/background/runtime.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts
git commit -m "feat: add extension autofill status action"
```

## Chunk 4: Upgrade content autofill to use background readiness

### Task 7: Add failing content autofill readiness tests

**Files:**
- Modify: `apps/browser-extension/tests/autofill.spec.ts`
- Modify: `apps/browser-extension/src/content/autofill.ts`

- [ ] **Step 1: Extend autofill tests with failing readiness coverage**

Add tests that prove:

```ts
it("keeps offering autofill when a password field is detected", () => {
  expect(shouldOfferAutofill({ hasPasswordField: true })).toBe(true);
});

it("reads locked autofill status from background", async () => {
  await expect(readAutofillStatus()).resolves.toEqual({ status: "locked" });
});

it("returns unavailable when the background call fails", async () => {
  await expect(readAutofillStatus()).resolves.toEqual({ status: "unavailable" });
});
```

- [ ] **Step 2: Run the focused autofill test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/autofill.spec.ts`
Expected: FAIL because `autofill.ts` still only exports the placeholder password-field helper

- [ ] **Step 3: Implement the smallest content autofill readiness adapter**

Implementation notes:
- keep `shouldOfferAutofill` synchronous and local
- add a new async `readAutofillStatus` helper
- call the background `read_autofill_status` action
- map background errors to a safe `unavailable` result

- [ ] **Step 4: Re-run the focused autofill test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/autofill.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the content autofill readiness slice**

```bash
git add apps/browser-extension/src/content/autofill.ts apps/browser-extension/tests/autofill.spec.ts
git commit -m "feat: add autofill readiness to extension content"
```

## Chunk 5: Run focused verification and final repo checks

### Task 8: Verify the whole slice end to end

**Files:**
- Modify: none

- [ ] **Step 1: Run the focused browser-extension test set**

Run:

```bash
./node_modules/.bin/vitest --run \
  apps/browser-extension/tests/background-unlock.spec.ts \
  apps/browser-extension/tests/background-unlocked-vault.spec.ts \
  apps/browser-extension/tests/popup.spec.tsx \
  apps/browser-extension/tests/autofill.spec.ts
```

Expected: PASS

- [ ] **Step 2: Run the full workspace lint**

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

- [ ] **Step 3: Run the full workspace test suite**

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

- [ ] **Step 4: Run git diff verification**

Run: `git diff --check`
Expected: PASS with no whitespace or conflict-marker issues

- [ ] **Step 5: Commit any final test-only cleanup**

```bash
git add -A
git commit -m "test: finalize extension unlock autofill read path"
```

Only do this step if verification work required additional tracked changes.
