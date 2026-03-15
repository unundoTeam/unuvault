# Vault Sync Delete Items Design

**Problem:** `unuvault` can now read real `vault_items` and safely save `changed_items` through `POST /vault/sync`, but deletion is still missing. The next smallest step is to let a signed-in client send `deleted_item_ids`, have the API soft-delete those items in the authenticated user's vault, and return real `deleted_item_ids` in the sync response without introducing physical cleanup, incremental cursors, or complex delete-vs-update conflict sets.

## Current State

- [`packages/api-client/src/vault.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-delete-items/packages/api-client/src/vault.ts) already has typed `changed_items`, but request-side `deleted_item_ids` does not exist yet.
- [`apps/api/src/services/vault-service.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-delete-items/apps/api/src/services/vault-service.ts) can safely save `changed_items`, but it always returns `deleted_item_ids: []`.
- [`apps/api/src/lib/supabase.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-delete-items/apps/api/src/lib/supabase.ts) can read and save `vault_items`, but the table has no delete marker yet.
- [`infra/supabase/migrations/0001_phase1_core.sql`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-delete-items/infra/supabase/migrations/0001_phase1_core.sql) currently defines `vault_items` without any soft-delete column.

## Confirmed Constraints

- Soft deletes live in `vault_items` via `deleted_at timestamptz null`.
- Clients upload deletions through the same `POST /vault/sync` request via `deleted_item_ids: string[]`.
- If the same `id` appears in both `changed_items` and `deleted_item_ids`, deletion wins for that request.

## Approaches

### Option 1: Add `deleted_at` to `vault_items` and thread deletes through `POST /vault/sync` (Recommended)

- Extend the existing table with a soft-delete marker
- Keep reads, writes, and deletes in one sync protocol
- Return real `deleted_item_ids` from sync

Trade-off:
- Minimal and consistent with the current architecture, at the cost of a slightly wider `vault_items` query surface

### Option 2: Add a separate tombstone table

- Keep `vault_items` clean of delete markers
- Track deletions in a dedicated table

Trade-off:
- Cleaner long-term boundary, but it immediately splits the current sync path into two data stores and adds migration/query overhead now

### Option 3: Add a delete-only endpoint

- Keep `POST /vault/sync` focused on read/write items
- Introduce a separate delete mutation endpoint

Trade-off:
- Easy to reason about in isolation, but it fragments the sync protocol and forces later recombination

## Chosen Design

Use option 1.

### Architecture

- `infra/supabase` adds `deleted_at` to `vault_items`.
- `packages/api-client` extends `VaultSyncRequest` so deletes can travel alongside `changed_items`.
- `apps/api/src/lib/supabase.ts` adds helpers to:
  - list deleted rows for one profile
  - soft-delete items for one profile
  - keep active-item reads scoped to `deleted_at is null`
- `apps/api/src/services/vault-service.ts` applies one request in this order:
  1. normalize away any `changed_items` whose ids also appear in `deleted_item_ids`
  2. ownership-check all affected ids
  3. save remaining changed items
  4. soft-delete requested ids
  5. re-read active items and deleted ids for the caller

### Data Model

`vault_items` gains:

- `deleted_at timestamptz null`

Semantics:

- `deleted_at is null` means the item is active
- `deleted_at is not null` means the item is deleted but still participates in sync history

### Protocol

`POST /vault/sync` request becomes:

- `changed_items: VaultSyncItem[]`
- `deleted_item_ids: string[]`

`POST /vault/sync` response remains:

- `updated_items: VaultSyncItem[]`
- `deleted_item_ids: string[]`
- `conflicts: []`

### Delete Semantics

- If an id is listed in `deleted_item_ids`:
  - and it belongs to the authenticated profile, set `deleted_at = now()`
  - and it belongs to another profile, reject with the same stable conflict posture as writes
- If an id is present in both `changed_items` and `deleted_item_ids`, treat it as a delete for that request
- Active-item reads exclude soft-deleted rows
- Deleted-item reads return just the ids of rows whose `deleted_at` is not null for the authenticated profile

### Error Handling

- Existing auth and profile errors remain unchanged:
  - `401 missing_bearer_token`
  - `401 invalid_token`
  - `404 profile_not_found`
- Cross-user item ownership problems continue to return `409 item_id_conflict`
- Database failures while soft-deleting or re-reading return `500 sync_failed`
- Deleting an already deleted item is treated as idempotent success in this slice

### Testing

- Update the shared sync client contract tests to include `deleted_item_ids` on the request
- Add Supabase adapter coverage for:
  - active-item reads excluding deleted rows
  - listing deleted ids for one profile
  - scoped soft delete updates
- Extend vault service tests to cover:
  - delete-only sync
  - mixed change+delete sync where delete wins
  - cross-user delete conflict
- Keep route tests focused on auth/error mapping plus a happy path containing both request-side and response-side delete data

## Success Criteria

- `POST /vault/sync` accepts `deleted_item_ids`
- Active vault reads exclude soft-deleted rows
- Sync responses return real `deleted_item_ids`
- Deletion is scoped to the authenticated profile and never affects another user's item
- Delete precedence over same-request writes is deterministic and documented

## Non-Goals

- Physical cleanup of deleted rows
- Dedicated tombstone table
- Incremental cursors
- Delete history compaction
- Complex delete/update conflict arrays beyond the stable `item_id_conflict`
