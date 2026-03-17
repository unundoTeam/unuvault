# Extension Background Auth And Cache Hydration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the browser extension sign in with an existing account, hydrate the popup vault cache from `/vault/sync`, and let the popup read that cache after unlock.

**Architecture:** Add a background-owned auth runtime with extension-local session storage and a dedicated vault hydrator that writes `updated_items` into popup cache storage. Add a popup-side background client plus a small auth hook so the popup can switch between signed-out auth UI, existing unlock UI, and a cache-backed vault search surface without holding bearer tokens itself.

**Tech Stack:** TypeScript, React, Vitest, `@supabase/supabase-js`, `chrome.storage.local`, shared `packages/api-client`

---

## File Structure

- Create: `apps/browser-extension/src/background/extension-supabase.ts`
  Create a Supabase client for extension runtime code.
- Create: `apps/browser-extension/src/background/auth-storage.ts`
  Read, write, and clear persisted extension auth state.
- Modify: `apps/browser-extension/src/background/auth.ts`
  Replace the placeholder with real auth runtime functions.
- Create: `apps/browser-extension/src/background/vault-cache.ts`
  Hydrate popup vault cache from `syncVault`.
- Create: `apps/browser-extension/src/background/runtime.ts`
  Register and dispatch background actions that popup callers can invoke.
- Create: `apps/browser-extension/src/background/protocol.ts`
  Shared message/action types between popup and background.
- Create: `apps/browser-extension/src/popup/background-client.ts`
  Popup-side typed caller for background auth and hydrate actions.
- Create: `apps/browser-extension/src/popup/popup-vault-storage.ts`
  Read and write hydrated popup vault cache items from extension storage.
- Create: `apps/browser-extension/src/popup/login-payload.ts`
  Normalize cached login payloads for popup rendering.
- Create: `apps/browser-extension/src/popup/use-popup-auth.ts`
  Manage popup auth form state and initial signed-in bootstrap.
- Create: `apps/browser-extension/src/popup/use-popup-vault-search.ts`
  Read popup vault cache and provide filtered results for rendering.
- Modify: `apps/browser-extension/src/popup/App.tsx`
  Render signed-out auth, signed-in unlock, and unlocked cache-backed results.
- Test: `apps/browser-extension/tests/background-auth.spec.ts`
  Verify auth runtime behavior.
- Test: `apps/browser-extension/tests/vault-cache.spec.ts`
  Verify background hydration behavior.
- Test: `apps/browser-extension/tests/popup-vault-storage.spec.ts`
  Verify popup cache storage behavior.
- Modify: `apps/browser-extension/tests/popup.spec.tsx`
  Cover popup auth transitions, hydration bootstrap, and cache-backed rendering.

## Chunk 1: Add popup cache storage and reader on current master

### Task 1: Add extension-local popup vault cache storage

**Files:**
- Create: `apps/browser-extension/src/popup/popup-vault-storage.ts`
- Create: `apps/browser-extension/tests/popup-vault-storage.spec.ts`

- [ ] **Step 1: Write the failing popup cache storage tests**

Add tests that prove:

```ts
it("reads a cached vault list from extension storage", async () => {
  await seedVaultCache([createVaultItem({ title: "GitHub" })]);
  expect(await readPopupVaultItems()).toHaveLength(1);
});

it("returns an empty list for malformed cached values", async () => {
  await seedRawVaultCache("{bad json");
  expect(await readPopupVaultItems()).toEqual([]);
});
```

- [ ] **Step 2: Run the focused popup cache storage test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup-vault-storage.spec.ts`
Expected: FAIL because `popup-vault-storage.ts` does not exist yet

- [ ] **Step 3: Implement the smallest popup cache storage helper**

Implementation notes:
- use one storage key such as `unuvault.extension.popup-vault-items`
- read from `chrome.storage.local`
- validate stored arrays conservatively against `VaultSyncItem` shape
- return `[]` for missing or malformed values

- [ ] **Step 4: Re-run the focused popup cache storage test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup-vault-storage.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the popup cache storage slice**

```bash
git add apps/browser-extension/src/popup/popup-vault-storage.ts apps/browser-extension/tests/popup-vault-storage.spec.ts
git commit -m "feat: add extension popup vault cache storage"
```

### Task 2: Reintroduce popup cache-backed reading on master

**Files:**
- Create: `apps/browser-extension/src/popup/login-payload.ts`
- Create: `apps/browser-extension/src/popup/use-popup-vault-search.ts`
- Modify: `apps/browser-extension/src/popup/App.tsx`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Extend popup tests with failing cache-backed rendering coverage**

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
  // seed cache, unlock, type in Search vault, verify only matches remain
});
```

- [ ] **Step 2: Run the focused popup test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: FAIL because the popup still renders only the placeholder unlocked shell

- [ ] **Step 3: Implement the smallest cache-backed popup reader**

Implementation notes:
- add popup-local payload normalization helpers
- read cached items from `popup-vault-storage.ts`
- keep sorting simple: `updated_at` descending
- keep search local and case-insensitive across `title`, `username`, and `notes`
- keep the existing unlock boundary intact

- [ ] **Step 4: Re-run the focused popup test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: PASS for cache-backed rendering and search coverage

- [ ] **Step 5: Commit the popup cache-reading slice**

```bash
git add apps/browser-extension/src/popup/login-payload.ts apps/browser-extension/src/popup/use-popup-vault-search.ts apps/browser-extension/src/popup/App.tsx apps/browser-extension/tests/popup.spec.tsx
git commit -m "feat: read popup vault cache after unlock"
```

## Chunk 2: Add background auth runtime

### Task 3: Add persisted extension auth storage

**Files:**
- Create: `apps/browser-extension/src/background/auth-storage.ts`
- Create: `apps/browser-extension/tests/background-auth.spec.ts`

- [ ] **Step 1: Write the failing auth storage/runtime tests**

Add tests that prove:

```ts
it("reads signed-out state when auth storage is missing", async () => {
  expect(await readExtensionAuthState()).toEqual({ status: "signed_out" });
});

it("fails closed for malformed auth storage values", async () => {
  await seedRawAuthState("{bad json");
  expect(await readStoredAuthState()).toBeNull();
});
```

- [ ] **Step 2: Run the focused background auth test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-auth.spec.ts`
Expected: FAIL because the auth storage/runtime files do not exist yet

- [ ] **Step 3: Implement the smallest auth storage helper**

Implementation notes:
- persist only minimum signed-in state
- keep `read`, `write`, and `clear` focused on storage only
- treat malformed values as signed out

- [ ] **Step 4: Re-run the focused background auth test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-auth.spec.ts`
Expected: still FAIL, but only for missing runtime behavior

- [ ] **Step 5: Commit the auth storage slice**

```bash
git add apps/browser-extension/src/background/auth-storage.ts apps/browser-extension/tests/background-auth.spec.ts
git commit -m "feat: add extension auth storage"
```

### Task 4: Implement extension sign-in and sign-out runtime

**Files:**
- Create: `apps/browser-extension/src/background/extension-supabase.ts`
- Modify: `apps/browser-extension/src/background/auth.ts`
- Modify: `apps/browser-extension/tests/background-auth.spec.ts`

- [ ] **Step 1: Extend auth tests with failing sign-in coverage**

Add tests that prove:

```ts
it("signs in with password, bootstraps the profile, and persists signed-in state", async () => {
  // mock Supabase signInWithPassword and bootstrapProfile
  const state = await signInWithPassword({
    email: "user@example.com",
    password: "correct horse",
  });

  expect(state.status).toBe("signed_in");
  expect(bootstrapProfile).toHaveBeenCalledWith(expect.any(Function), "jwt-token");
});

it("clears persisted state on signOut", async () => {
  await signOut();
  expect(await readExtensionAuthState()).toEqual({ status: "signed_out" });
});
```

- [ ] **Step 2: Run the focused background auth test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-auth.spec.ts`
Expected: FAIL because `auth.ts` still exports the placeholder state

- [ ] **Step 3: Implement the smallest extension auth runtime**

Implementation notes:
- create an extension-specific Supabase client helper
- support `signInWithPassword` only
- require an access token after sign-in
- call `bootstrapProfile`
- persist signed-in state only after auth + bootstrap both succeed
- expose `readExtensionAuthState`, `signInWithPassword`, and `signOut`

- [ ] **Step 4: Re-run the focused background auth test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-auth.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the background auth runtime slice**

```bash
git add apps/browser-extension/src/background/extension-supabase.ts apps/browser-extension/src/background/auth-storage.ts apps/browser-extension/src/background/auth.ts apps/browser-extension/tests/background-auth.spec.ts
git commit -m "feat: add extension background auth runtime"
```

## Chunk 3: Add background hydration and popup/background protocol

### Task 5: Implement vault cache hydration in background

**Files:**
- Create: `apps/browser-extension/src/background/vault-cache.ts`
- Create: `apps/browser-extension/tests/vault-cache.spec.ts`

- [ ] **Step 1: Write the failing vault hydration tests**

Add tests that prove:

```ts
it("hydrates popup vault cache from syncVault for a signed-in session", async () => {
  // seed signed-in auth state, mock syncVault response
  await hydratePopupVaultCache();
  expect(await readPopupVaultItems()).toHaveLength(1);
});

it("does not hydrate when the extension is signed out", async () => {
  await expect(hydratePopupVaultCache()).resolves.toEqual({ ok: false });
});
```

- [ ] **Step 2: Run the focused vault hydration test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/vault-cache.spec.ts`
Expected: FAIL because `vault-cache.ts` does not exist yet

- [ ] **Step 3: Implement the smallest vault hydrator**

Implementation notes:
- read current auth state
- no-op or return a controlled failure when signed out
- call `syncVault(fetcher, token, { changed_items: [], deleted_item_ids: [] })`
- write `updated_items` through `popup-vault-storage.ts`

- [ ] **Step 4: Re-run the focused vault hydration test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/vault-cache.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the hydration slice**

```bash
git add apps/browser-extension/src/background/vault-cache.ts apps/browser-extension/tests/vault-cache.spec.ts apps/browser-extension/src/popup/popup-vault-storage.ts
git commit -m "feat: hydrate popup vault cache in background"
```

### Task 6: Add popup/background protocol and popup auth hook

**Files:**
- Create: `apps/browser-extension/src/background/protocol.ts`
- Create: `apps/browser-extension/src/background/runtime.ts`
- Create: `apps/browser-extension/src/popup/background-client.ts`
- Create: `apps/browser-extension/src/popup/use-popup-auth.ts`
- Modify: `apps/browser-extension/src/popup/App.tsx`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Extend popup tests with failing signed-out/auth coverage**

Add tests that prove:

```tsx
it("shows the auth form when the extension is signed out", async () => {
  render(<App />);
  expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
});

it("signs in from the popup and then shows the unlock form", async () => {
  // mock successful background sign-in + hydrate
  render(<App />);
  fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "user@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("button", { name: "Set master password" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused popup test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: FAIL because the popup has no auth state layer or background client

- [ ] **Step 3: Implement the smallest popup/background auth bridge**

Implementation notes:
- define explicit protocol types for popup actions
- keep popup messaging isolated in `background-client.ts`
- let `usePopupAuth.ts` own `signed_out | signing_in | signed_in | error`
- on popup mount, read auth state and request one hydrate if signed in
- render auth form only when signed out
- keep unlock UI untouched once signed in

- [ ] **Step 4: Re-run the focused popup test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx`
Expected: PASS for signed-out, sign-in, and signed-in bootstrap coverage

- [ ] **Step 5: Commit the popup auth bridge slice**

```bash
git add apps/browser-extension/src/background/protocol.ts apps/browser-extension/src/background/runtime.ts apps/browser-extension/src/popup/background-client.ts apps/browser-extension/src/popup/use-popup-auth.ts apps/browser-extension/src/popup/App.tsx apps/browser-extension/tests/popup.spec.tsx
git commit -m "feat: add popup auth flow for extension runtime"
```

## Chunk 4: Verify end-to-end branch state

### Task 7: Run focused and repo-wide verification

**Files:**
- Modify: `apps/browser-extension/src/background/auth.ts`
- Modify: `apps/browser-extension/src/background/vault-cache.ts`
- Modify: `apps/browser-extension/src/popup/App.tsx`
- Modify: `apps/browser-extension/src/popup/use-popup-auth.ts`
- Modify: `apps/browser-extension/src/popup/use-popup-vault-search.ts`
- Modify: `apps/browser-extension/tests/background-auth.spec.ts`
- Modify: `apps/browser-extension/tests/vault-cache.spec.ts`
- Modify: `apps/browser-extension/tests/popup-vault-storage.spec.ts`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Run focused extension verification**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup-vault-storage.spec.ts apps/browser-extension/tests/background-auth.spec.ts apps/browser-extension/tests/vault-cache.spec.ts apps/browser-extension/tests/popup.spec.tsx`
Expected: PASS

- [ ] **Step 2: Run repository verification**

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

Run: `git diff --check`
Expected: PASS

- [ ] **Step 3: Confirm branch status**

Run: `git status --short --branch`
Expected: only intended implementation changes remain before integration steps

- [ ] **Step 4: Prepare for execution wrap-up**

Use `superpowers:verification-before-completion` before claiming the feature is done, then use `superpowers:finishing-a-development-branch` after implementation and verification are complete.
