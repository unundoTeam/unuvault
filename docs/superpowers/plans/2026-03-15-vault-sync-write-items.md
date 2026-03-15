# Vault Sync Write Items Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authenticated `POST /vault/sync` upsert full-record `changed_items` into the caller's `vault_items`, then return the caller's refreshed full vault.

**Architecture:** Reuse the current authenticated sync path and extend it in three thin layers. First, make the shared request contract typed. Second, teach the Supabase dependency adapter how to bulk-upsert rows scoped to one `user_profile_id`. Third, pass typed `changed_items` through the route into the vault service so the service can write, then re-read, the caller's vault before returning the existing sync response shape.

**Tech Stack:** TypeScript, Fastify, Supabase Auth, Supabase Data API, Vitest

---

## File Structure

- Modify: `packages/api-client/src/vault.ts`
  Type `changed_items` with the same stable item shape used in `updated_items`.
- Modify: `packages/api-client/tests/vault-client.spec.ts`
  Cover typed `changed_items` on the shared sync request contract.
- Modify: `apps/api/src/lib/supabase.ts`
  Add a bulk upsert helper for `vault_items` scoped to one `user_profile_id`.
- Modify: `apps/api/tests/supabase-bootstrap.spec.ts`
  Cover bulk upsert behavior in the Supabase adapter.
- Modify: `apps/api/src/services/vault-service.ts`
  Accept typed sync payloads, upsert incoming items, then return the refreshed full vault.
- Modify: `apps/api/tests/vault-service.spec.ts`
  Cover empty-write, new-item, and overwrite flows.
- Modify: `apps/api/src/routes/vault-sync.ts`
  Pass the typed request body into the vault service.
- Modify: `apps/api/tests/vault-sync.spec.ts`
  Keep auth behavior intact and align the happy path with a write-then-read sync call.

## Chunk 1: Typed sync write contract

### Task 1: Type `changed_items` in the shared sync client contract

**Files:**
- Modify: `packages/api-client/src/vault.ts`
- Modify: `packages/api-client/tests/vault-client.spec.ts`

- [ ] **Step 1: Write the failing shared-client test**

Update the existing sync client test so the call uses a real item payload:

```ts
await syncVault(fetcher, "jwt-token", {
  changed_items: [
    {
      id: "item-1",
      item_type: "login",
      title: "GitHub",
      encrypted_payload: { ciphertext: "abc" },
      favorite: true,
      source: "manual",
      last_used_at: null,
      created_at: "2026-03-14T00:00:00.000Z",
      updated_at: "2026-03-15T00:00:00.000Z",
    },
  ],
});
```

and add a type assertion like:

```ts
expectTypeOf(response.updated_items).toEqualTypeOf<
  Array<{
    id: string;
    item_type: string;
    title: string;
    encrypted_payload: Record<string, unknown>;
    favorite: boolean;
    source: string;
    last_used_at: string | null;
    created_at: string;
    updated_at: string;
  }>
>();
```

- [ ] **Step 2: Run the package typecheck or client test to verify it fails**

Run: `./node_modules/.bin/tsc --noEmit -p packages/api-client/tsconfig.json`
Expected: FAIL if `changed_items` and the request payload are still too loosely typed

- [ ] **Step 3: Implement the smallest typed request contract**

Implementation notes:
- export the existing stable item type for reuse
- change `VaultSyncRequest.changed_items` from `unknown[]` to that item type
- keep the response shape unchanged

- [ ] **Step 4: Re-run the package typecheck and client test**

Run: `./node_modules/.bin/tsc --noEmit -p packages/api-client/tsconfig.json`
Expected: PASS

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the shared write contract**

```bash
git add packages/api-client/src/vault.ts packages/api-client/tests/vault-client.spec.ts
git commit -m "feat: type vault sync changed items"
```

## Chunk 2: Database write boundary

### Task 2: Add a bulk upsert helper for `vault_items`

**Files:**
- Modify: `apps/api/src/lib/supabase.ts`
- Modify: `apps/api/tests/supabase-bootstrap.spec.ts`

- [ ] **Step 1: Write the failing Supabase adapter test**

Add a test like:

```ts
it("upserts vault_items for a user profile", async () => {
  const upsert = vi.fn().mockResolvedValue({
    data: null,
    error: null,
  });
  const from = vi.fn().mockReturnValue({ upsert });

  const deps = createSupabaseAuthBootstrapDependencies({
    auth: { getUser: vi.fn() },
    from,
  } as never);

  await deps.upsertVaultItems("profile-1", [
    {
      id: "item-1",
      item_type: "login",
      title: "GitHub",
      encrypted_payload: { ciphertext: "abc" },
      favorite: true,
      source: "manual",
      last_used_at: null,
      created_at: "2026-03-14T00:00:00.000Z",
      updated_at: "2026-03-15T00:00:00.000Z",
    },
  ]);

  expect(from).toHaveBeenCalledWith("vault_items");
  expect(upsert).toHaveBeenCalledWith(
    [
      {
        id: "item-1",
        user_profile_id: "profile-1",
        item_type: "login",
        title: "GitHub",
        encrypted_payload: { ciphertext: "abc" },
        favorite: true,
        source: "manual",
        last_used_at: null,
        created_at: "2026-03-14T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
    ],
    { onConflict: "id" },
  );
});
```

- [ ] **Step 2: Run the adapter test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/api/tests/supabase-bootstrap.spec.ts`
Expected: FAIL because `upsertVaultItems` does not exist yet

- [ ] **Step 3: Implement the smallest bulk upsert adapter**

Implementation notes:
- add a helper like `upsertVaultItems(profileId, items)`
- convert typed sync items into `vault_items` rows by injecting `user_profile_id`
- use Supabase `upsert(..., { onConflict: "id" })`
- do not trust any user ownership field from the client

- [ ] **Step 4: Re-run the adapter test**

Run: `./node_modules/.bin/vitest --run apps/api/tests/supabase-bootstrap.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the database write boundary**

```bash
git add apps/api/src/lib/supabase.ts apps/api/tests/supabase-bootstrap.spec.ts
git commit -m "feat: add vault item upsert adapter"
```

## Chunk 3: Write-then-read sync service

### Task 3: Upsert incoming items before returning the refreshed vault

**Files:**
- Modify: `apps/api/src/services/vault-service.ts`
- Modify: `apps/api/tests/vault-service.spec.ts`

- [ ] **Step 1: Write the failing vault service tests**

Extend the service tests with cases like:

```ts
it("upserts changed_items before reading the current vault", async () => {
  const upsertVaultItems = vi.fn().mockResolvedValue(undefined);
  const listVaultItemsByProfileId = vi.fn().mockResolvedValue([
    {
      id: "item-1",
      user_profile_id: "profile-1",
      item_type: "login",
      title: "GitHub",
      encrypted_payload: { ciphertext: "abc" },
      favorite: true,
      source: "manual",
      last_used_at: null,
      created_at: "2026-03-14T00:00:00.000Z",
      updated_at: "2026-03-15T00:00:00.000Z",
    },
  ]);

  const service = createVaultSyncService({
    getUserByToken: async () => ({ id: "auth-user-1", email: "user@example.com" }),
    getUserProfileByAuthUserId: async () => ({
      id: "profile-1",
      auth_user_id: "auth-user-1",
      email: "user@example.com",
      locale: "zh-CN",
    }),
    upsertVaultItems,
    listVaultItemsByProfileId,
  });

  const payload = await service.syncVaultFromToken("jwt-token", {
    changed_items: [
      {
        id: "item-1",
        item_type: "login",
        title: "GitHub",
        encrypted_payload: { ciphertext: "abc" },
        favorite: true,
        source: "manual",
        last_used_at: null,
        created_at: "2026-03-14T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
    ],
  });

  expect(upsertVaultItems).toHaveBeenCalledWith("profile-1", [
    {
      id: "item-1",
      item_type: "login",
      title: "GitHub",
      encrypted_payload: { ciphertext: "abc" },
      favorite: true,
      source: "manual",
      last_used_at: null,
      created_at: "2026-03-14T00:00:00.000Z",
      updated_at: "2026-03-15T00:00:00.000Z",
    },
  ]);
  expect(listVaultItemsByProfileId).toHaveBeenCalledWith("profile-1");
  expect(payload.updated_items).toHaveLength(1);
});
```

Also keep or extend coverage for:
- empty `changed_items` skips the upsert helper
- same-profile overwrite still returns the refreshed item list from the read-back

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `./node_modules/.bin/vitest --run apps/api/tests/vault-service.spec.ts`
Expected: FAIL because the service does not accept typed payloads or call an upsert helper yet

- [ ] **Step 3: Implement the smallest write-then-read service**

Implementation notes:
- change `syncVaultFromToken` to accept `payload: VaultSyncRequest`
- after resolving `profile`, call `upsertVaultItems(profile.id, payload.changed_items)` when the array is non-empty
- then call `listVaultItemsByProfileId(profile.id)` and build the existing response shape
- keep `deleted_item_ids` and `conflicts` empty

- [ ] **Step 4: Re-run the service tests**

Run: `./node_modules/.bin/vitest --run apps/api/tests/vault-service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the service write path**

```bash
git add apps/api/src/services/vault-service.ts apps/api/tests/vault-service.spec.ts
git commit -m "feat: upsert changed items during vault sync"
```

### Task 4: Thread the typed payload through the route and verify the repo

**Files:**
- Modify: `apps/api/src/routes/vault-sync.ts`
- Modify: `apps/api/tests/vault-sync.spec.ts`

- [ ] **Step 1: Update the route happy-path test**

Adjust the happy-path route test so it posts one real `changed_items` record and expects the dependency to be called successfully before returning the refreshed item payload.

At minimum, the route test payload should look like:

```ts
payload: {
  changed_items: [
    {
      id: "item-1",
      item_type: "login",
      title: "GitHub",
      encrypted_payload: { ciphertext: "abc" },
      favorite: true,
      source: "manual",
      last_used_at: null,
      created_at: "2026-03-14T00:00:00.000Z",
      updated_at: "2026-03-15T00:00:00.000Z",
    },
  ],
},
```

- [ ] **Step 2: Run focused verification**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts apps/api/tests/supabase-bootstrap.spec.ts apps/api/tests/vault-service.spec.ts apps/api/tests/vault-sync.spec.ts`
Expected: PASS

- [ ] **Step 3: Run repo verification**

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

Run: `git diff --check`
Expected: PASS

- [ ] **Step 4: Commit the route alignment and verification**

```bash
git add apps/api/src/routes/vault-sync.ts apps/api/tests/vault-sync.spec.ts
git commit -m "test: align vault sync route with write items flow"
```
