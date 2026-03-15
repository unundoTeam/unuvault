# Vault Sync Write Items Design

**Problem:** `unuvault` can now return real `vault_items` for the authenticated caller, but `POST /vault/sync` still ignores incoming `changed_items`. The next smallest product step is to let a signed-in client send full item records, have the API save them into the caller's vault, and then return the caller's refreshed item list without yet introducing deletes, field-level patches, or conflict negotiation.

## Current State

- [`packages/api-client/src/vault.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-write-items/packages/api-client/src/vault.ts) still types `changed_items` as `unknown[]`, so the shared write contract is not explicit.
- [`apps/api/src/routes/vault-sync.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-write-items/apps/api/src/routes/vault-sync.ts) authenticates the caller but does not pass the request body into the vault service in any structured way.
- [`apps/api/src/services/vault-service.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-write-items/apps/api/src/services/vault-service.ts) reads current vault items for the authenticated profile, but it never persists `changed_items`.
- [`apps/api/src/lib/supabase.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-write-items/apps/api/src/lib/supabase.ts) can list `vault_items` by `user_profile_id`, but it does not yet write them.
- [`infra/supabase/migrations/0001_phase1_core.sql`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-write-items/infra/supabase/migrations/0001_phase1_core.sql) already defines the exact Phase 1 vault columns we need to persist.

## Confirmed Constraints

- Clients may provide their own item `id`.
- Within one authenticated user's vault, matching `id` values use `last-write-wins`.
- `changed_items` sends full replacement records, not partial field patches.

## Approaches

### Option 1: Save `changed_items` inside `POST /vault/sync` and then return the refreshed vault (Recommended)

- Keep a single sync endpoint
- Accept typed full-record `changed_items`
- Save those rows under the authenticated `users_profile`
- Re-read the caller's vault and return the latest full `updated_items`

Trade-off:
- This is the smallest end-to-end write loop and stays aligned with the current sync shape

### Option 2: Add a separate write endpoint and keep sync read-only

- Introduce `/vault/items/upsert`
- Let `/vault/sync` remain purely read-only

Trade-off:
- Cleaner separation, but it splits one sync story into two protocols that will likely need to be rejoined later

### Option 3: Implement full bidirectional sync now

- Upsert writes
- Deleted tombstones
- Conflict calculation
- Incremental cursors

Trade-off:
- Most feature-complete, but clearly too large for the next slice

## Chosen Design

Use option 1.

### Architecture

- `packages/api-client` defines one stable item type reused for both `changed_items` and `updated_items`.
- `apps/api/src/routes/vault-sync.ts` parses the request body and passes typed `changed_items` into the vault service.
- `apps/api/src/services/vault-service.ts` resolves the authenticated profile, checks whether any incoming `id` already belongs to another profile, saves the allowed items, then lists the current vault rows and projects them back into the existing sync response.
- `apps/api/src/lib/supabase.ts` adds two small helpers: one to list existing `vault_items` by `id`, and one to upsert rows scoped to the authenticated `user_profile_id` after that ownership check passes.

### Write Semantics

- New item:
  - client provides an `id`
  - API inserts a row for the authenticated `user_profile_id`
- Existing item in the same user's vault:
  - API overwrites the stored row with the incoming full record
  - `updated_at` should move to the latest server write time
- Existing item in another user's vault:
  - not touched
  - the API rejects the request with a stable conflict error instead of overwriting another user's record

### Data Flow

1. A signed-in client calls `syncVault(fetcher, token, { changed_items })`.
2. The route authenticates the bearer token and resolves the caller's `users_profile`.
3. The vault service looks up any existing `vault_items` that match the incoming `id` values.
4. If any matched row belongs to another `user_profile_id`, the service rejects the write with a stable conflict error.
5. Otherwise, the service transforms each incoming item into a `vault_items` row for `profile.id` and upserts them.
6. The service lists all `vault_items` for `profile.id`.
7. The API returns the current full vault as `updated_items`.

### Request and Response Shape

Use the same stable item fields on both sides of the sync call:

- `id`
- `item_type`
- `title`
- `encrypted_payload`
- `favorite`
- `source`
- `last_used_at`
- `created_at`
- `updated_at`

The response still returns:

- `updated_items`
- `deleted_item_ids: []`
- `conflicts: []`

### Error Handling

- Existing auth/profile errors stay unchanged:
  - `401 missing_bearer_token`
  - `401 invalid_token`
  - `404 profile_not_found`
- If any incoming item `id` is already owned by another `user_profile_id`, return `409` with a stable error such as `item_id_conflict`.
- Invalid request shape is not fully validated in this slice; the contract is trusted at the typed boundary and covered by tests.
- A database failure during ownership lookup, save, or re-read returns `500 sync_failed`.
- An empty `changed_items` array is valid and behaves like a read-only sync.

### Testing

- Update the shared sync client test to cover typed `changed_items`.
- Add Supabase adapter coverage for:
  - listing existing `vault_items` by `id`
  - upserting vault items under a given `user_profile_id`
- Extend vault service tests to cover:
  - empty `changed_items` preserves current read-only behavior
  - new items are saved and then returned
  - existing items in the same profile are overwritten
  - existing items owned by another profile are rejected
- Keep route tests focused on auth/error boundaries plus one happy-path payload that includes `changed_items`.

## Success Criteria

- `POST /vault/sync` persists incoming `changed_items` for the authenticated caller.
- The write path is scoped to the caller's `users_profile_id`.
- The write path never overwrites another user's row, even if the client submits a colliding `id`.
- The response returns the caller's refreshed full vault after the upsert.
- The protocol remains intentionally simple: full-record writes, no deletes, no conflicts, no cursors.

## Non-Goals

- Deletion tombstones
- Conflict detection or conflict arrays
- Incremental sync cursors
- Field-level patch semantics
- UI changes in web, extension, or iOS
