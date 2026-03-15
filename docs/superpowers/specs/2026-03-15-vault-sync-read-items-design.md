# Vault Sync Read Items Design

**Problem:** `unuvault` now enforces authenticated user context for `POST /vault/sync`, but the route still returns an empty placeholder payload. Phase 1 already has a real `vault_items` table, so the next smallest trustworthy product step is to let an authenticated caller read their own vault items through sync without yet introducing writes, cursors, deletes, or conflict semantics.

## Current State

- [`apps/api/src/routes/vault-sync.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-read-items/apps/api/src/routes/vault-sync.ts) rejects anonymous callers and requires a valid Supabase-backed bearer token.
- [`apps/api/src/services/vault-service.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-read-items/apps/api/src/services/vault-service.ts) resolves the authenticated `users_profile`, but still returns an empty `updated_items` array.
- [`apps/api/src/lib/supabase.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-read-items/apps/api/src/lib/supabase.ts) can resolve both the Supabase user and the matching `users_profile`, but it does not yet read `vault_items`.
- [`infra/supabase/migrations/0001_phase1_core.sql`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-read-items/infra/supabase/migrations/0001_phase1_core.sql) already defines `vault_items` with the exact item fields Phase 1 needs for an encrypted record envelope.
- [`packages/api-client/src/vault.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-read-items/packages/api-client/src/vault.ts) still treats `updated_items` as `unknown[]`, so there is no typed shared contract for real item payloads yet.

## Approaches

### Option 1: Full-table read-only sync for the authenticated user (Recommended)

- Keep `POST /vault/sync` authenticated exactly as it is today
- Read all `vault_items` that belong to the authenticated `users_profile`
- Map them into a stable item payload in `updated_items`
- Ignore incoming `changed_items` for now
- Keep `deleted_item_ids` and `conflicts` empty

Trade-off:
- This is not yet a full sync protocol, but it creates the first honest product-facing vault response with minimal new semantics

### Option 2: Incremental read-only sync with a cursor

- Add a `since` or cursor concept to the request
- Return only items changed after that point
- Start shaping the eventual sync protocol now

Trade-off:
- More future-facing, but it forces us to define cursor semantics, updated timestamps, and replay guarantees before the product has even shipped one successful item read

### Option 3: Read and write in the same slice

- Read the caller's current `vault_items`
- Also persist incoming `changed_items`
- Start real two-way sync immediately

Trade-off:
- Most product-visible progress, but it drags item validation, write conflict behavior, and encrypted payload persistence into the same slice, which is too much for the current boundary

## Chosen Design

Use option 1.

### Architecture

- `apps/api/src/lib/supabase.ts` grows a small vault-item reader that fetches all rows for the authenticated `users_profile`.
- `apps/api/src/services/vault-service.ts` becomes responsible for turning database rows into the API sync response shape.
- `packages/api-client/src/vault.ts` exposes a typed `VaultSyncItem` so the API response is no longer an unstructured `unknown[]`.
- The request contract stays simple: callers still send `changed_items`, but the server ignores them until write sync exists.

### Components

- Shared sync item type for `updated_items`
- Supabase dependency adapter that lists `vault_items` by `user_profile_id`
- Vault service projection logic from database row to sync response item
- API tests that prove only the authenticated caller's items are returned

### Data Flow

1. A signed-in client calls `syncVault(fetcher, accessToken, { changed_items: [...] })`.
2. `POST /vault/sync` authenticates the caller and resolves their `users_profile`.
3. The vault service asks the Supabase dependency layer for all `vault_items` where `user_profile_id = profile.id`.
4. The service maps each database row to a sync item payload.
5. The route returns:
   - `updated_items`: all of the caller's current vault items
   - `deleted_item_ids`: `[]`
   - `conflicts`: `[]`

### Response Shape

The first typed sync item should include:

- `id`
- `item_type`
- `title`
- `encrypted_payload`
- `favorite`
- `source`
- `last_used_at`
- `created_at`
- `updated_at`

It should not expose `user_profile_id`, because that is internal ownership data rather than client payload.

### Error Handling

- Auth and `users_profile` errors stay exactly as they are today:
  - `401 missing_bearer_token`
  - `401 invalid_token`
  - `404 profile_not_found`
- A database read failure while listing vault items should return `500 sync_failed`.
- An empty vault is not an error; it should return `200` with `updated_items: []`.

### Testing

- Update the shared API client test to assert the typed `updated_items` response shape.
- Add service or adapter coverage for listing `vault_items` by `user_profile_id`.
- Update the API sync tests to cover:
  - empty vault returns an empty list
  - one or more items for the authenticated user are returned in `updated_items`
  - another user's items are not included
- Keep existing auth-context tests intact so this slice does not reopen anonymous sync behavior.

## Success Criteria

- `POST /vault/sync` returns real `vault_items` for the authenticated caller.
- The response remains user-scoped; no other user's records appear.
- `updated_items` has a stable typed payload shared by API and client code.
- `changed_items`, `deleted_item_ids`, and `conflicts` remain intentionally simple until a later sync-write slice.

## Non-Goals

- Persisting incoming `changed_items`
- Incremental sync cursors
- Deletion tombstones
- Conflict detection or resolution
- UI changes in web, extension, or iOS
