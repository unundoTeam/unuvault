# Vault Sync Delete Items Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authenticated `POST /vault/sync` accept `deleted_item_ids`, soft-delete the caller's items via `deleted_at`, and return real deleted ids alongside active items.

**Architecture:** Extend the current safe read/write sync path in four thin layers. First, add the soft-delete column and typed request contract. Second, teach the Supabase adapter how to exclude deleted rows from active reads, list deleted ids, and mark rows deleted for one profile. Third, update the vault service so delete ids win over same-request writes and ownership checks still protect foreign rows. Finally, thread the new request shape through the route and verify the whole repo stays green.

**Tech Stack:** TypeScript, Fastify, Supabase Auth, Supabase Data API, PostgreSQL migrations, Vitest

---

## File Structure

- Modify: `infra/supabase/migrations/0001_phase1_core.sql`
  Add `deleted_at` to `vault_items`.
- Modify: `packages/api-client/src/vault.ts`
  Extend `VaultSyncRequest` with `deleted_item_ids`.
- Modify: `packages/api-client/tests/vault-client.spec.ts`
  Cover typed delete ids on the shared sync request contract.
- Modify: `apps/api/src/lib/supabase.ts`
  Add helpers for active-item reads, deleted-id reads, and scoped soft deletes.
- Modify: `apps/api/tests/supabase-bootstrap.spec.ts`
  Cover the new soft-delete helpers and active/deleted read split.
- Modify: `apps/api/src/services/vault-service.ts`
  Apply delete precedence, ownership checks, soft deletes, and read back both active items and deleted ids.
- Modify: `apps/api/tests/vault-service.spec.ts`
  Cover delete-only, mixed write+delete, and conflict cases.
- Modify: `apps/api/src/routes/vault-sync.ts`
  Thread the expanded request payload through the route.
- Modify: `apps/api/tests/vault-sync.spec.ts`
  Keep auth/error behavior intact and align the happy path with delete-aware sync.

## Chunk 1: Schema and shared request contract

### Task 1: Add soft-delete schema and typed request delete ids

**Files:**
- Modify: `infra/supabase/migrations/0001_phase1_core.sql`
- Modify: `packages/api-client/src/vault.ts`
- Modify: `packages/api-client/tests/vault-client.spec.ts`

- [ ] **Step 1: Write the failing shared-client test**

Update the sync client test so the request body includes:

```ts
deleted_item_ids: ["item-2"]
```

and assert:

```ts
expect(fetcher).toHaveBeenCalledWith("/vault/sync", {
  method: "POST",
  headers: {
    authorization: "Bearer jwt-token",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    changed_items,
    deleted_item_ids: ["item-2"],
  }),
});
```

Also add a type assertion like:

```ts
expectTypeOf<Parameters<typeof syncVault>[2]>().toEqualTypeOf<{
  changed_items: VaultSyncItem[];
  deleted_item_ids: string[];
}>();
```

- [ ] **Step 2: Run the package typecheck to verify it fails**

Run: `./node_modules/.bin/tsc --noEmit -p packages/api-client/tsconfig.json`
Expected: FAIL because `VaultSyncRequest` does not yet include `deleted_item_ids`

- [ ] **Step 3: Implement the smallest schema and contract change**

Implementation notes:
- add `deleted_at timestamptz` to `vault_items` in `infra/supabase/migrations/0001_phase1_core.sql`
- add `deleted_item_ids: string[]` to `VaultSyncRequest`
- leave the response shape unchanged

- [ ] **Step 4: Re-run the package typecheck and client test**

Run: `./node_modules/.bin/tsc --noEmit -p packages/api-client/tsconfig.json`
Expected: PASS

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the schema and request contract**

```bash
git add infra/supabase/migrations/0001_phase1_core.sql packages/api-client/src/vault.ts packages/api-client/tests/vault-client.spec.ts
git commit -m "feat: add delete ids to vault sync contract"
```

## Chunk 2: Supabase delete helpers

### Task 2: Add active/deleted read split and scoped soft delete helpers

**Files:**
- Modify: `apps/api/src/lib/supabase.ts`
- Modify: `apps/api/tests/supabase-bootstrap.spec.ts`

- [ ] **Step 1: Write the failing Supabase adapter tests**

Add tests like:

```ts
it("lists active vault_items for a user profile", async () => {
  const is = vi.fn().mockResolvedValue({
    data: [],
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ is });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  const deps = createSupabaseAuthBootstrapDependencies({
    auth: { getUser: vi.fn() },
    from,
  } as never);

  await deps.listVaultItemsByProfileId("profile-1");

  expect(eq).toHaveBeenCalledWith("user_profile_id", "profile-1");
  expect(is).toHaveBeenCalledWith("deleted_at", null);
});

it("lists deleted vault item ids for a user profile", async () => {
  const not = vi.fn().mockResolvedValue({
    data: [{ id: "item-2" }],
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ not });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  const deps = createSupabaseAuthBootstrapDependencies({
    auth: { getUser: vi.fn() },
    from,
  } as never);

  const ids = await deps.listDeletedVaultItemIdsByProfileId("profile-1");

  expect(ids).toEqual(["item-2"]);
});

it("soft deletes vault_items for a user profile", async () => {
  const inQuery = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
  const update = vi.fn().mockReturnValue({ in: inQuery });
  const from = vi.fn().mockReturnValue({ update });

  const deps = createSupabaseAuthBootstrapDependencies({
    auth: { getUser: vi.fn() },
    from,
  } as never);

  await deps.softDeleteVaultItems("profile-1", ["item-2"]);

  expect(update).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the adapter test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/api/tests/supabase-bootstrap.spec.ts`
Expected: FAIL because the delete-aware helper(s) do not exist yet

- [ ] **Step 3: Implement the smallest delete-aware adapter helpers**

Implementation notes:
- active-item reads must add a `deleted_at is null` filter
- add `listDeletedVaultItemIdsByProfileId(profileId)`
- add `softDeleteVaultItems(profileId, itemIds)` that:
  - updates `deleted_at`
  - scopes the update by both `id in (...)` and `user_profile_id = profileId`
- keep helper signatures small and profile-scoped

- [ ] **Step 4: Re-run the adapter test**

Run: `./node_modules/.bin/vitest --run apps/api/tests/supabase-bootstrap.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the delete helpers**

```bash
git add apps/api/src/lib/supabase.ts apps/api/tests/supabase-bootstrap.spec.ts
git commit -m "feat: add vault item soft delete helpers"
```

## Chunk 3: Delete-aware sync service

### Task 3: Apply delete precedence and soft-delete behavior in the vault service

**Files:**
- Modify: `apps/api/src/services/vault-service.ts`
- Modify: `apps/api/tests/vault-service.spec.ts`

- [ ] **Step 1: Write the failing vault service tests**

Extend the service tests with at least these cases:

```ts
it("soft deletes requested ids and returns deleted_item_ids", async () => {
  const listVaultItemsByIds = vi.fn().mockResolvedValue([
    {
      id: "item-2",
      user_profile_id: "profile-1",
      item_type: "login",
      title: "GitHub",
      encrypted_payload: { ciphertext: "abc" },
      favorite: true,
      source: "manual",
      last_used_at: null,
      created_at: "2026-03-14T00:00:00.000Z",
      updated_at: "2026-03-15T00:00:00.000Z",
      deleted_at: null,
    },
  ]);
  const softDeleteVaultItems = vi.fn().mockResolvedValue(undefined);
  const listVaultItemsByProfileId = vi.fn().mockResolvedValue([]);
  const listDeletedVaultItemIdsByProfileId = vi.fn().mockResolvedValue(["item-2"]);

  const service = createVaultSyncService({
    ...deps,
    listVaultItemsByIds,
    softDeleteVaultItems,
    listVaultItemsByProfileId,
    listDeletedVaultItemIdsByProfileId,
  });

  const payload = await service.syncVaultFromToken("jwt-token", {
    changed_items: [],
    deleted_item_ids: ["item-2"],
  });

  expect(softDeleteVaultItems).toHaveBeenCalledWith("profile-1", ["item-2"]);
  expect(payload.deleted_item_ids).toEqual(["item-2"]);
});

it("lets deleted_item_ids win over same-request changed_items", async () => {
  expect(upsertVaultItems).not.toHaveBeenCalledWith(
    "profile-1",
    expect.arrayContaining([expect.objectContaining({ id: "item-2" })]),
  );
});

it("rejects deletes when an id belongs to another profile", async () => {
  await expect(service.syncVaultFromToken("jwt-token", {
    changed_items: [],
    deleted_item_ids: ["item-foreign"],
  })).rejects.toThrow("item id belongs to another profile");
});
```

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `./node_modules/.bin/vitest --run apps/api/tests/vault-service.spec.ts`
Expected: FAIL because the service does not yet know about `deleted_item_ids`

- [ ] **Step 3: Implement the smallest delete-aware service flow**

Implementation notes:
- extend `VaultItemRow` with `deleted_at`
- extend dependencies with:
  - `softDeleteVaultItems`
  - `listDeletedVaultItemIdsByProfileId`
- derive a `Set` from `payload.deleted_item_ids`
- filter `changed_items` so delete wins within one request
- ownership-check both the filtered changed-item ids and delete ids
- write remaining changed items
- soft-delete requested ids
- return:
  - active items in `updated_items`
  - deleted ids in `deleted_item_ids`
  - `conflicts: []`

- [ ] **Step 4: Re-run the service tests**

Run: `./node_modules/.bin/vitest --run apps/api/tests/vault-service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the service delete flow**

```bash
git add apps/api/src/services/vault-service.ts apps/api/tests/vault-service.spec.ts
git commit -m "feat: add delete handling to vault sync"
```

### Task 4: Thread the delete-aware request through the route and verify the repo

**Files:**
- Modify: `apps/api/src/routes/vault-sync.ts`
- Modify: `apps/api/tests/vault-sync.spec.ts`

- [ ] **Step 1: Update the route tests**

Adjust the happy-path route test so it posts:

```ts
payload: {
  changed_items: [],
  deleted_item_ids: ["item-2"],
}
```

and assert the response includes:

```ts
deleted_item_ids: ["item-2"]
```

Also keep or add a `409 item_id_conflict` test covering foreign-owned delete ids.

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
git commit -m "test: align vault sync route with delete flow"
```
