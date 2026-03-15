# Vault Sync Write Items Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authenticated `POST /vault/sync` save full-record `changed_items` into the caller's `vault_items` without cross-user overwrites, then return the caller's refreshed full vault.

**Architecture:** Reuse the current authenticated sync path and extend it in three thin layers. First, make the shared request contract typed. Second, teach the Supabase dependency adapter how to list existing rows by `id` and save rows scoped to one `user_profile_id`. Third, pass typed `changed_items` through the route into the vault service so the service can reject cross-user `id` collisions, write allowed items, then re-read the caller's vault before returning the existing sync response shape.

**Tech Stack:** TypeScript, Fastify, Supabase Auth, Supabase Data API, Vitest

---

## File Structure

- Modify: `packages/api-client/src/vault.ts`
  Type `changed_items` with the same stable item shape used in `updated_items`.
- Modify: `packages/api-client/tests/vault-client.spec.ts`
  Cover typed `changed_items` on the shared sync request contract.
- Modify: `apps/api/src/lib/supabase.ts`
  Add ownership-aware read/write helpers for `vault_items`.
- Modify: `apps/api/tests/supabase-bootstrap.spec.ts`
  Cover listing existing rows by `id` plus the scoped save helper in the Supabase adapter.
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

### Task 2: Add ownership-aware Supabase helpers for `vault_items`

**Files:**
- Modify: `apps/api/src/lib/supabase.ts`
- Modify: `apps/api/tests/supabase-bootstrap.spec.ts`

- [ ] **Step 1: Write the failing Supabase adapter test**

Add tests like:

```ts
it("lists vault_items by id", async () => {
  const inQuery = vi.fn().mockResolvedValue({
    data: [
      {
        id: "item-1",
        user_profile_id: "profile-foreign",
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
    error: null,
  });
  const select = vi.fn().mockReturnValue({ in: inQuery });
  const from = vi.fn().mockReturnValue({ select });

  const deps = createSupabaseAuthBootstrapDependencies({
    auth: { getUser: vi.fn() },
    from,
  } as never);

  const items = await deps.listVaultItemsByIds(["item-1"]);

  expect(from).toHaveBeenCalledWith("vault_items");
  expect(select).toHaveBeenCalledWith(
    "id, user_profile_id, item_type, title, encrypted_payload, favorite, source, last_used_at, created_at, updated_at",
  );
  expect(inQuery).toHaveBeenCalledWith("id", ["item-1"]);
  expect(items).toHaveLength(1);
});

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
Expected: FAIL because the ownership-aware helper(s) do not exist yet

- [ ] **Step 3: Implement the smallest ownership-aware read/write helpers**

Implementation notes:
- add a helper like `listVaultItemsByIds(ids)`
- add a helper like `upsertVaultItems(profileId, items)`
- convert typed sync items into `vault_items` rows by injecting `user_profile_id`
- use Supabase `upsert(..., { onConflict: "id" })`
- do not trust any user ownership field from the client
- keep the ownership decision out of the database helper itself; the service will make that decision

- [ ] **Step 4: Re-run the adapter test**

Run: `./node_modules/.bin/vitest --run apps/api/tests/supabase-bootstrap.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the database write boundary**

```bash
git add apps/api/src/lib/supabase.ts apps/api/tests/supabase-bootstrap.spec.ts
git commit -m "feat: add vault item save helpers"
```

## Chunk 3: Write-then-read sync service

### Task 3: Save incoming items only when ownership is safe

**Files:**
- Modify: `apps/api/src/services/vault-service.ts`
- Modify: `apps/api/tests/vault-service.spec.ts`

- [ ] **Step 1: Write the failing vault service tests**

Extend the service tests with cases like:

```ts
it("saves changed_items before reading the current vault", async () => {
  const listVaultItemsByIds = vi.fn().mockResolvedValue([]);
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
    listVaultItemsByIds,
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

  expect(listVaultItemsByIds).toHaveBeenCalledWith(["item-1"]);
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
- another profile owning the same `id` throws a stable conflict error and does not call `upsertVaultItems`

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `./node_modules/.bin/vitest --run apps/api/tests/vault-service.spec.ts`
Expected: FAIL because the service does not accept typed payloads, list existing ids, or guard against foreign ownership

- [ ] **Step 3: Implement the smallest write-then-read service**

Implementation notes:
- change `syncVaultFromToken` to accept `payload: VaultSyncRequest`
- after resolving `profile`, call `listVaultItemsByIds(payload.changed_items.map((item) => item.id))`
- if any returned row belongs to another `user_profile_id`, throw a stable conflict error
- otherwise call `upsertVaultItems(profile.id, payload.changed_items)` when the array is non-empty
- then call `listVaultItemsByProfileId(profile.id)` and build the existing response shape
- keep `deleted_item_ids` and `conflicts` empty

- [ ] **Step 4: Re-run the service tests**

Run: `./node_modules/.bin/vitest --run apps/api/tests/vault-service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the service write path**

```bash
git add apps/api/src/services/vault-service.ts apps/api/tests/vault-service.spec.ts
git commit -m "feat: save changed items during vault sync"
```

### Task 4: Thread the typed payload through the route and verify the repo

**Files:**
- Modify: `apps/api/src/routes/vault-sync.ts`
- Modify: `apps/api/tests/vault-sync.spec.ts`

- [ ] **Step 1: Update the route happy-path test**

Adjust the happy-path route test so it posts one real `changed_items` record and expects the dependency to be called successfully before returning the refreshed item payload.

Also add a route test for the new stable conflict error:

```ts
expect(response.statusCode).toBe(409);
expect(response.json()).toEqual({
  ok: false,
  error: "item_id_conflict",
});
```

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
git commit -m "test: align vault sync route with safe write flow"
```
