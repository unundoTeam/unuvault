# Web Vault Sync Status Design

## Summary

This slice adds a single page-level sync status surface to the Web vault page. Today the page has only two coarse states: `Loading vault...` and a generic sync error. It does not tell the user whether a create, edit, or delete action just succeeded, and it hides the whole vault UI during every sync because `isLoading` is reused for both first load and follow-up mutations.

The goal of this slice is to make sync behavior legible without adding a toast system or redesigning the page. The Web vault should keep its current minimal layout, but it should clearly communicate when a sync is in flight, what the last successful action was, and when the last successful sync happened.

## Scope

### In scope

- Add one page-level status area for Web vault sync feedback
- Track initial load separately from follow-up mutation syncs
- Keep the vault list visible while create, edit, and delete syncs are running
- Show small success feedback for:
  - initial load
  - create
  - update
  - delete
- Show a last-synced label derived from API `server_time`
- Add Web tests for the new state messages and last-synced output

### Out of scope

- Toast notifications
- Animated status transitions
- Offline queueing
- Retry buttons
- Conflict-specific messaging
- Localized time formatting
- iOS or browser-extension feedback changes

## Chosen Approach

The chosen approach is a single persistent status row inside `VaultPanel`, backed by lightweight metadata from `useVaultSync`.

This is preferred over transient inline messages or a toast system because:

- it works for both initial page load and later mutations
- it keeps feedback in one predictable place
- it reuses the existing page layout
- it avoids introducing a new UI system just to deliver short success messages

For this slice, the last-synced label should use a deterministic UTC time string derived from the API `server_time`, for example `Last synced at 00:00 UTC`. That keeps the tests stable and avoids introducing locale/timezone formatting work into this small UX improvement.

## User Experience

The page keeps its current structure:

- heading
- descriptive copy
- status area
- create form
- vault list

The status area should behave like this:

- initial authenticated load, before first sync completes:
  - `Syncing vault...`
- initial load success:
  - `Vault synced`
  - `Last synced at <HH:MM UTC>`
- create success:
  - `Item saved`
  - `Last synced at <HH:MM UTC>`
- update success:
  - `Item updated`
  - `Last synced at <HH:MM UTC>`
- delete success:
  - `Item deleted`
  - `Last synced at <HH:MM UTC>`
- sync failure:
  - existing generic error copy remains the primary message

Important interaction rule: once the first authenticated load has completed, create/edit/delete actions should not collapse the whole page back to `Loading vault...`. The list and form should stay visible while buttons remain disabled during the in-flight sync.

## Architecture

No new page shell or routing change is needed. The current structure remains appropriate:

- `apps/web/src/components/vault/use-vault-sync.ts`
  owns sync lifecycle metadata and updates it when sync requests start or finish
- `apps/web/src/components/vault/vault-panel.tsx`
  maps that metadata into user-facing copy and renders the status area
- `apps/web/tests/vault-page.spec.tsx`
  protects the user-facing states end to end

This keeps transport and state orchestration in the hook, while the panel stays responsible for presentation.

## Data Model

`useVaultSync` should expose a slightly richer state surface:

- `isBootstrapping: boolean`
  true only during the initial session lookup and first authenticated sync
- `isSyncing: boolean`
  true during any in-flight sync request
- `lastAction: "load" | "create" | "update" | "delete" | null`
  tracks the most recent completed or active sync purpose
- `lastSyncedAt: string | null`
  stores the latest successful `server_time`

The existing `items`, `errorMessage`, and action methods stay in place.

## Data Flow

### Initial authenticated load

1. `loadVault()` starts
2. Hook sets:
   - `isBootstrapping = true`
   - `isSyncing = true`
3. Hook runs `syncVault(..., { changed_items: [], deleted_item_ids: [] })` with action `"load"`
4. On success:
   - `items = response.updated_items`
   - `lastAction = "load"`
   - `lastSyncedAt = response.server_time`
   - `isAuthenticated = true`
5. On completion:
   - `isSyncing = false`
   - `isBootstrapping = false`

### Create / update / delete

Each mutation action should call a shared `runSync(token, payload, action)` helper:

- create uses action `"create"`
- update uses action `"update"`
- delete uses action `"delete"`

When a mutation starts:

- `isSyncing = true`
- keep `items` untouched
- clear `errorMessage`

When it succeeds:

- replace `items` with `response.updated_items`
- set `lastAction` to the mutation action
- set `lastSyncedAt = response.server_time`
- set `isSyncing = false`

When it fails:

- preserve current `items`
- preserve current `lastSyncedAt`
- set the existing generic `errorMessage`
- set `isSyncing = false`

## Rendering Rules

`VaultPanel` should derive the top status copy with this precedence:

1. `errorMessage`
2. `isBootstrapping`
3. `isSyncing`
4. successful `lastAction`
5. no status message

Suggested success copy:

- `"load"` -> `Vault synced`
- `"create"` -> `Item saved`
- `"update"` -> `Item updated`
- `"delete"` -> `Item deleted`

Suggested in-flight copy:

- `"load"` or `null` -> `Syncing vault...`
- `"create"` -> `Saving item...`
- `"update"` -> `Updating item...`
- `"delete"` -> `Deleting item...`

The `Last synced at ...` label should render only when `lastSyncedAt` is present.

## Error Handling

This slice should not change the current generic sync error model. The only UX change is that the page should preserve the last successful list and form visibility during mutation syncs.

If a mutation fails:

- the generic error stays visible
- the list remains visible
- the last successful sync time remains visible
- the user can retry with the current page state

## Testing Strategy

Add or update Web tests for:

- authenticated first load shows `Syncing vault...` before the first sync resolves
- initial successful sync shows `Vault synced`
- initial successful sync shows `Last synced at <HH:MM UTC>`
- create success shows `Item saved`
- update success shows `Item updated`
- delete success shows `Item deleted`
- mutation syncs do not remove the current list from the page while the request is pending

The API does not need changes for this slice because it already returns `server_time`.

## Success Criteria

This slice is complete when:

- the Web vault page exposes one stable sync status area
- create, edit, and delete actions report success through that area
- the page shows a deterministic last-synced label after successful syncs
- mutation syncs no longer collapse the entire vault UI into a loading-only state
- Web and repo-wide verification stay green
