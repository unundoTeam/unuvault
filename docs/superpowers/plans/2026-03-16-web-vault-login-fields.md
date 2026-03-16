# Web Vault Login Fields Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Web vault login item into a minimal real record by supporting `title`, `username`, and `notes` in create/edit flows while keeping `password_ciphertext` as a placeholder field.

**Architecture:** Tighten the shared `VaultSyncItem` payload contract around a concrete login payload shape, then expand the Web vault hook and panel to create, edit, and render those fields through the existing sync path.

**Tech Stack:** Next.js App Router, React, TypeScript, shared `packages/api-client`, Supabase browser session access, Vitest, Testing Library

---

## File Structure

- Modify: `packages/api-client/src/vault.ts`
  Define the explicit login payload type used by the Web vault slice.
- Modify: `packages/api-client/tests/vault-client.spec.ts`
  Confirm the payload shape still round-trips correctly through the shared client.
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
  Expand create/update actions to accept and sync `username` and `notes`.
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
  Add the extra create/edit fields and list summaries.
- Modify: `apps/web/tests/vault-page.spec.tsx`
  Cover create, edit, and display behavior for the new fields.

## Chunk 1: Define the login payload contract

### Task 1: Tighten the shared vault payload type for login items

**Files:**
- Modify: `packages/api-client/src/vault.ts`
- Modify: `packages/api-client/tests/vault-client.spec.ts`

- [ ] **Step 1: Write the failing shared client test**

Add a test like:

```ts
it("round-trips a login payload with username and notes", async () => {
  // sync response includes schema_version, username, password_ciphertext, notes
  // expect typed response payload to match the same shape
});
```

- [ ] **Step 2: Run the shared client test to verify it fails**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts`
Expected: FAIL because the shared type is still just `Record<string, unknown>`

- [ ] **Step 3: Implement the smallest shared type change**

Implementation notes:
- add `VaultLoginPayload`
- change `VaultSyncItem.encrypted_payload` to use that explicit type
- keep the transport and `syncVault` call structure unchanged

- [ ] **Step 4: Re-run the shared client test**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the shared payload contract**

```bash
git add packages/api-client/src/vault.ts packages/api-client/tests/vault-client.spec.ts
git commit -m "feat: define web vault login payload"
```

## Chunk 2: Expand create flow for username and notes

### Task 2: Add the real login fields to the create form and sync payload

**Files:**
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing create-flow tests**

Add tests like:

```tsx
it("creates a login item with username and notes", async () => {
  // initial load success
  // fill title, username, notes
  // save
  // expect changed_items[0].encrypted_payload.username and notes
});

it("resets the create form after saving a login item", async () => {
  // fill all fields
  // save
  // expect title, username, and notes inputs cleared
});
```

- [ ] **Step 2: Run the focused Web vault suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because the form only exposes `Title`

- [ ] **Step 3: Implement the smallest create-flow expansion**

Implementation notes:
- add `username` and `notes` draft state in `vault-panel.tsx`
- extend `createItem(...)` to accept the fuller input shape
- create payload with:
  - `schema_version: 1`
  - `username`
  - `password_ciphertext: ""`
  - `notes`
- keep title as the only required field

- [ ] **Step 4: Re-run the focused Web vault suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS for the new create cases

- [ ] **Step 5: Commit the create-flow slice**

```bash
git add apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault login create fields"
```

## Chunk 3: Expand edit flow and list rendering

### Task 3: Edit and display login metadata beyond the title

**Files:**
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing edit and display tests**

Add tests like:

```tsx
it("shows username in the vault list", async () => {
  // synced item includes encrypted_payload.username
  // expect username text in the row
});

it("shows a notes indicator when notes exist", async () => {
  // synced item includes notes
  // expect "Notes added"
});

it("prefills title, username, and notes in edit mode", async () => {
  // click Edit
  // expect all three inputs prefilled
});

it("saves edited username and notes through changed_items", async () => {
  // edit all three fields
  // save
  // expect changed_items payload to include updated username and notes
});
```

- [ ] **Step 2: Run the focused Web vault suite to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because edit mode and row rendering still assume title-only behavior

- [ ] **Step 3: Implement the smallest edit/display expansion**

Implementation notes:
- expand inline edit state to include:
  - `editingUsername`
  - `editingNotes`
- prefill from current `encrypted_payload`
- update the save action to preserve `password_ciphertext` while replacing `username` and `notes`
- render username summary in the default row
- render a lightweight notes indicator when notes are non-empty

- [ ] **Step 4: Re-run the focused Web vault suite**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the edit/display slice**

```bash
git add apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault login edit fields"
```

## Chunk 4: Full verification

### Task 4: Verify the login-fields slice end to end

**Files:**
- Modify: `packages/api-client/src/vault.ts`
- Modify: `packages/api-client/tests/vault-client.spec.ts`
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Run the focused shared and Web tests**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts apps/web/tests/vault-page.spec.tsx`
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
git add packages/api-client/src/vault.ts packages/api-client/tests/vault-client.spec.ts apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add web vault login fields"
```
