# Vault Sync Read Items Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authenticated `POST /vault/sync` return the caller's current `vault_items` as a read-only `updated_items` payload.

**Architecture:** Keep the current auth-context boundary intact, then layer a small vault-item reader under it. The shared sync contract becomes typed, the Supabase adapter lists `vault_items` by `user_profile_id`, and the vault service projects those rows into the sync response while still ignoring incoming `changed_items`.

**Tech Stack:** TypeScript, Fastify, Supabase Auth, Supabase Data API, Vitest

---

## File Structure

- Modify: `packages/api-client/src/vault.ts`
  Add a concrete `VaultSyncItem` type and make `updated_items` typed instead of `unknown[]`.
- Modify: `packages/api-client/tests/vault-client.spec.ts`
  Assert the typed read-only sync payload shape.
- Modify: `apps/api/src/lib/supabase.ts`
  Add a `vault_items` reader keyed by `user_profile_id`.
- Modify: `apps/api/tests/supabase-bootstrap.spec.ts`
  Cover the new `vault_items` list helper in the Supabase dependency adapter.
- Create: `apps/api/tests/vault-service.spec.ts`
  Unit-test read-only sync projection from profile + `vault_items` rows to API payload.
- Modify: `apps/api/src/services/vault-service.ts`
  Read the caller's `vault_items` and map them into `updated_items`.
- Modify: `apps/api/tests/vault-sync.spec.ts`
  Keep auth-path coverage and assert the happy path can return a real item payload.

## Chunk 1: Shared sync contract and data access

### Task 1: Type the vault sync response item

**Files:**
- Modify: `packages/api-client/src/vault.ts`
- Modify: `packages/api-client/tests/vault-client.spec.ts`

- [ ] **Step 1: Write the failing client test**

Update the existing sync client test so the mocked response includes one real item:

```ts
updated_items: [
  {
    id: "item-1",
    item_type: "login",
    title: "GitHub",
    encrypted_payload: { ciphertext: "abc" },
    favorite: true,
    source: "manual",
    last_used_at: "2026-03-15T00:00:00.000Z",
    created_at: "2026-03-14T00:00:00.000Z",
    updated_at: "2026-03-15T00:00:00.000Z",
  },
],
```

and assert:

```ts
expect(response.updated_items[0]?.title).toBe("GitHub");
expect(response.updated_items[0]?.encrypted_payload).toEqual({
  ciphertext: "abc",
});
```

- [ ] **Step 2: Run the client test to verify it fails**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts`
Expected: FAIL because `updated_items` is still typed as `unknown[]`

- [ ] **Step 3: Implement the minimal shared sync item type**

Implementation notes:
- add `export type VaultSyncItem`
- make `VaultSyncResponse.updated_items` be `VaultSyncItem[]`
- keep `VaultSyncRequest` unchanged

Recommended item type:

```ts
export type VaultSyncItem = {
  id: string;
  item_type: string;
  title: string;
  encrypted_payload: Record<string, unknown>;
  favorite: boolean;
  source: string;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 4: Re-run the client test**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the shared response contract**

```bash
git add packages/api-client/src/vault.ts packages/api-client/tests/vault-client.spec.ts
git commit -m "feat: type vault sync items"
```

### Task 2: Add a Supabase reader for `vault_items`

**Files:**
- Modify: `apps/api/src/lib/supabase.ts`
- Modify: `apps/api/tests/supabase-bootstrap.spec.ts`

- [ ] **Step 1: Write the failing dependency-adapter test**

Add a test like:

```ts
it("lists vault_items for a user profile", async () => {
  const eq = vi.fn().mockResolvedValue({
    data: [
      {
        id: "item-1",
        user_profile_id: "profile-1",
        item_type: "login",
        title: "GitHub",
        encrypted_payload: { ciphertext: "abc" },
        favorite: false,
        source: "manual",
        last_used_at: null,
        created_at: "2026-03-14T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
    ],
    error: null,
  });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  const deps = createSupabaseAuthBootstrapDependencies({
    auth: { getUser: vi.fn() },
    from,
  } as never);

  const items = await deps.listVaultItemsByProfileId("profile-1");

  expect(from).toHaveBeenCalledWith("vault_items");
  expect(select).toHaveBeenCalledWith(
    "id, user_profile_id, item_type, title, encrypted_payload, favorite, source, last_used_at, created_at, updated_at",
  );
  expect(eq).toHaveBeenCalledWith("user_profile_id", "profile-1");
  expect(items).toHaveLength(1);
});
```

- [ ] **Step 2: Run the adapter test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/api/tests/supabase-bootstrap.spec.ts`
Expected: FAIL because `listVaultItemsByProfileId` does not exist yet

- [ ] **Step 3: Implement the smallest vault-item reader**

Implementation notes:
- add a `VaultItemRow` type in `apps/api/src/lib/supabase.ts`
- extend the returned dependency contract with `listVaultItemsByProfileId(profileId)`
- select the exact columns used by the sync response
- return `[]` when Supabase returns no rows
- throw only when the query itself fails

- [ ] **Step 4: Re-run the adapter test**

Run: `./node_modules/.bin/vitest --run apps/api/tests/supabase-bootstrap.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the Supabase reader slice**

```bash
git add apps/api/src/lib/supabase.ts apps/api/tests/supabase-bootstrap.spec.ts
git commit -m "feat: add vault item reader for sync"
```

## Chunk 2: Read-only sync payload

### Task 3: Return the caller's `vault_items` from the vault service

**Files:**
- Create: `apps/api/tests/vault-service.spec.ts`
- Modify: `apps/api/src/services/vault-service.ts`

- [ ] **Step 1: Write the failing vault service tests**

Create a test file with at least these cases:

```ts
it("returns updated_items for the authenticated profile", async () => {
  const service = createVaultSyncService({
    getUserByToken: async () => ({
      id: "auth-user-1",
      email: "user@example.com",
    }),
    getUserProfileByAuthUserId: async () => ({
      id: "profile-1",
      auth_user_id: "auth-user-1",
      email: "user@example.com",
      locale: "zh-CN",
    }),
    listVaultItemsByProfileId: async () => [
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
  });

  const payload = await service.syncVaultFromToken("jwt-token");

  expect(payload.updated_items).toEqual([
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
});

it("returns an empty updated_items list when the profile has no vault items", async () => {
  // same setup, but listVaultItemsByProfileId returns []
});
```

- [ ] **Step 2: Run the service test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/api/tests/vault-service.spec.ts`
Expected: FAIL because the service does not yet read or project vault items

- [ ] **Step 3: Implement the smallest read-only sync projection**

Implementation notes:
- extend the vault service dependency contract with `listVaultItemsByProfileId`
- after resolving `profile`, fetch `vault_items` with `profile.id`
- map each row into the sync item shape
- keep `deleted_item_ids` and `conflicts` as empty arrays
- continue ignoring request `changed_items`

- [ ] **Step 4: Re-run the service test**

Run: `./node_modules/.bin/vitest --run apps/api/tests/vault-service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the service projection**

```bash
git add apps/api/src/services/vault-service.ts apps/api/tests/vault-service.spec.ts
git commit -m "feat: return vault items from sync"
```

### Task 4: Keep route coverage aligned and run full verification

**Files:**
- Modify: `apps/api/tests/vault-sync.spec.ts`

- [ ] **Step 1: Update the route happy-path test**

Change the successful route stub so it returns one real sync item, then assert the JSON response includes that item in `updated_items`.

Example assertion:

```ts
expect(response.json()).toEqual({
  server_time: "2026-03-15T00:00:00.000Z",
  updated_items: [
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
  deleted_item_ids: [],
  conflicts: [],
});
```

- [ ] **Step 2: Run focused verification**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts apps/api/tests/supabase-bootstrap.spec.ts apps/api/tests/vault-service.spec.ts apps/api/tests/vault-sync.spec.ts`
Expected: PASS

- [ ] **Step 3: Run repo verification**

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

- [ ] **Step 4: Commit the verification and route-alignment slice**

```bash
git add apps/api/tests/vault-sync.spec.ts
git commit -m "test: align vault sync route with read items payload"
```
