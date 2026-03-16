# Web Vault Encryption Boundary Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw Web password storage with a client-owned envelope boundary while keeping the sync contract unchanged.

**Architecture:** Add the smallest browser-safe seal/open helper in `packages/security`, then route Web password create/edit/reveal/copy behavior through payload helpers that convert between local plaintext and stored envelope strings. The API continues to treat `password_ciphertext` as opaque string data.

**Tech Stack:** TypeScript, React, Next.js App Router, Vitest, shared `packages/security`, shared `packages/api-client`

---

## File Structure

- Modify: `packages/security/src/vault-envelope.ts`
  Expand the envelope module from a type-only contract into minimal sealing/opening helpers.
- Create or Modify: `packages/security/tests/...`
  Add tests for seal/open round-trips and invalid envelope behavior.
- Modify: `apps/web/src/components/vault/login-payload.ts`
  Route password read/write behavior through seal/open helpers.
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
  Keep form-state plaintext local but seal values before sync writes.
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
  Keep reveal/copy behavior working through opened local values.
- Modify: `apps/web/tests/vault-page.spec.tsx`
  Update expectations so stored payload values are sealed strings while UI behavior remains the same.

## Chunk 1: Add security envelope helpers

### Task 1: Make `packages/security` able to seal and open Web password values

**Files:**
- Modify: `packages/security/src/vault-envelope.ts`
- Create or Modify: `packages/security/tests/vault-envelope.spec.ts`

- [ ] **Step 1: Write the failing security tests**

Add tests like:

```ts
it("round-trips a plaintext password through a vault envelope", () => {
  const ciphertext = sealVaultPassword("hunter2");
  expect(openVaultPassword(ciphertext)).toBe("hunter2");
});

it("fails safely for invalid envelope input", () => {
  expect(openVaultPassword("not-an-envelope")).toBe("");
});
```

- [ ] **Step 2: Run the focused security suite to verify it fails**

Run: `./node_modules/.bin/vitest --run packages/security/tests/vault-envelope.spec.ts`
Expected: FAIL because seal/open helpers do not exist yet

- [ ] **Step 3: Implement the smallest browser-safe helpers**

Implementation notes:
- keep `VaultEnvelope` as the serialized shape source of truth
- use a deliberately small development-stage encoding scheme that still produces a versioned envelope string
- make invalid/unsupported envelopes fail closed
- avoid pulling React or Web-only globals into `packages/security`

- [ ] **Step 4: Re-run the focused security suite**

Run: `./node_modules/.bin/vitest --run packages/security/tests/vault-envelope.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the envelope helper slice**

```bash
git add packages/security/src/vault-envelope.ts packages/security/tests/vault-envelope.spec.ts
git commit -m "feat: add web vault envelope helpers"
```

## Chunk 2: Route Web payload helpers through the envelope boundary

### Task 2: Stop storing raw password strings directly in Web payload helpers

**Files:**
- Modify: `apps/web/src/components/vault/login-payload.ts`
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing Web payload tests**

Add or update focused tests like:

```tsx
it("stores a sealed password string when creating a login item", async () => {
  // save password
  // expect changed_items[0].encrypted_payload.password_ciphertext not to equal raw plaintext
});

it("reveals the original password value from a sealed payload", async () => {
  // seeded item has a sealed ciphertext
  // click Show password
  // expect plaintext in UI
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because current helpers still assume raw string storage

- [ ] **Step 3: Implement the smallest helper boundary swap**

Implementation notes:
- `writeDraftPassword(...)` should seal plaintext before storing it
- `readDraftPassword(...)` should open the stored envelope and return plaintext
- `hasSavedPassword(...)` and reveal/copy helpers should depend on opened values, not raw stored text
- keep `password_ciphertext` as a string in the payload type

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the Web boundary slice**

```bash
git add apps/web/src/components/vault/login-payload.ts apps/web/src/components/vault/use-vault-sync.ts apps/web/tests/vault-page.spec.tsx
git commit -m "feat: seal web vault password payloads"
```

## Chunk 3: Keep Web interactions working through opened local values

### Task 3: Preserve edit, reveal, and copy behavior on top of sealed storage

**Files:**
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing interaction tests**

Add or update tests like:

```tsx
it("prefills edit mode from a sealed password value", async () => {
  // seeded item stores a sealed password
  // click Edit
  // expect plaintext in the local input
});

it("copies the opened password from a sealed payload", async () => {
  // click Copy password
  // expect clipboard to receive plaintext, not envelope text
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL if UI still leaks or expects raw stored strings

- [ ] **Step 3: Implement the smallest interaction adjustments**

Implementation notes:
- keep local form state plaintext-only
- reveal should still show plaintext after local open
- copy should still use the opened plaintext
- do not change sync route shape or API interactions

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the interaction slice**

```bash
git add apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: open sealed web vault passwords locally"
```

## Chunk 4: Full verification

### Task 4: Verify the encryption-boundary slice end to end

**Files:**
- Modify: `packages/security/src/vault-envelope.ts`
- Modify: `packages/security/tests/vault-envelope.spec.ts`
- Modify: `apps/web/src/components/vault/login-payload.ts`
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Run focused suites**

Run: `./node_modules/.bin/vitest --run packages/security/tests/vault-envelope.spec.ts`
Expected: PASS

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
git add packages/security/src/vault-envelope.ts packages/security/tests/vault-envelope.spec.ts apps/web/src/components/vault/login-payload.ts apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault encryption boundary"
```
