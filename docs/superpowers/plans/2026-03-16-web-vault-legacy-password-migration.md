# Web Vault Legacy Password Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Web usability for pre-envelope plaintext password items while keeping all new writes on the envelope format.

**Architecture:** Extend the shared password-opening boundary so Web can read legacy plaintext values without changing sync or server contracts. Keep write paths envelope-only, and prove the behavior with focused security and Web tests before running repo-wide verification.

**Tech Stack:** TypeScript, React, Next.js App Router, Vitest, shared `packages/security`, shared `packages/api-client`

---

## File Structure

- Modify: `packages/security/src/vault-envelope.ts`
  Add a legacy-compatible password-opening path while preserving fail-closed behavior for broken envelope data.
- Modify: `packages/security/tests/vault-envelope.spec.ts`
  Cover legacy plaintext compatibility and guardrails.
- Modify: `apps/web/src/components/vault/login-payload.ts`
  Route Web password reads through the compatibility helper while keeping writes sealed.
- Modify: `apps/web/tests/vault-page.spec.tsx`
  Add legacy item fixtures and assert save-time upgrade to envelope storage.

## Chunk 1: Add legacy-compatibility to the security boundary

### Task 1: Teach the security helper to distinguish legacy plaintext from sealed values

**Files:**
- Modify: `packages/security/src/vault-envelope.ts`
- Modify: `packages/security/tests/vault-envelope.spec.ts`

- [ ] **Step 1: Write the failing security tests**

Add tests like:

```ts
it("opens legacy plaintext password values", () => {
  expect(openVaultPassword("hunter2")).toBe("hunter2");
});

it("still returns empty for an empty stored password", () => {
  expect(openVaultPassword("")).toBe("");
});
```

- [ ] **Step 2: Run the focused security suite to verify it fails**

Run: `./node_modules/.bin/vitest --run packages/security/tests/vault-envelope.spec.ts`
Expected: FAIL because raw plaintext currently falls through to `""`

- [ ] **Step 3: Implement the smallest compatibility path**

Implementation notes:
- keep supported envelope parsing first
- if parsing fails and the stored value is a non-empty string, treat it as legacy plaintext
- do not change the envelope shape or version handling
- keep empty strings as “no password saved”

- [ ] **Step 4: Re-run the focused security suite**

Run: `./node_modules/.bin/vitest --run packages/security/tests/vault-envelope.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the security compatibility slice**

```bash
git add packages/security/src/vault-envelope.ts packages/security/tests/vault-envelope.spec.ts
git commit -m "feat: support legacy web vault passwords"
```

## Chunk 2: Keep Web flows usable for legacy data while upgrading on save

### Task 2: Make Web reveal/copy/edit work for legacy plaintext and reseal on save

**Files:**
- Modify: `apps/web/src/components/vault/login-payload.ts`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing Web tests**

Add or update focused tests like:

```tsx
it("reveals a legacy plaintext password value", async () => {
  // seeded item has raw plaintext password_ciphertext
  // click Show password
  // expect plaintext in the UI
});

it("reseals a legacy plaintext password when the item is saved", async () => {
  // seeded item has raw plaintext password_ciphertext
  // enter edit mode and save
  // expect changed_items password_ciphertext to be an envelope string
});
```

- [ ] **Step 2: Run the focused Web suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because current Web reads old plaintext as empty password

- [ ] **Step 3: Implement the smallest Web compatibility swap**

Implementation notes:
- keep `readDraftPassword(...)` on the shared compatibility boundary
- keep `writeDraftPassword(...)` envelope-only
- do not add any background sync-on-load migration
- preserve existing button and placeholder behavior

- [ ] **Step 4: Re-run the focused Web suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the Web migration slice**

```bash
git add apps/web/src/components/vault/login-payload.ts apps/web/tests/vault-page.spec.tsx
git commit -m "feat: migrate legacy web vault passwords on save"
```

## Chunk 3: Full verification

### Task 3: Verify the legacy-password migration slice end to end

**Files:**
- Modify: `packages/security/src/vault-envelope.ts`
- Modify: `packages/security/tests/vault-envelope.spec.ts`
- Modify: `apps/web/src/components/vault/login-payload.ts`
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
git add packages/security/src/vault-envelope.ts packages/security/tests/vault-envelope.spec.ts apps/web/src/components/vault/login-payload.ts apps/web/tests/vault-page.spec.tsx
git commit -m "feat: restore legacy web vault password compatibility"
```
