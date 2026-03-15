# Web Vault Create/Delete Sync Design

## Summary

This slice turns the Web vault page from a static placeholder into a small but real sync surface. The page will load the authenticated user's vault items on first render, let the user create a simple login item with a title-only form, and let the user delete an existing item. Both actions will go through the existing `syncVault` contract so the Web app exercises the same read/write/delete protocol as other clients.

The goal is not to design a full vault UI yet. The goal is to prove that the current authenticated sync backend can support a visible end-to-end workflow: load items, create one, delete one, and reflect the server-confirmed result back into the page.

## Scope

### In scope

- Replace the placeholder `/vault` page with a small interactive vault surface
- Auto-sync on page load for an authenticated browser session
- Create a minimal vault item from a title-only form
- Delete an existing vault item through `deleted_item_ids`
- Keep local UI state aligned to the server's returned `updated_items`
- Show lightweight loading and error states
- Add Web tests covering load, create, and delete flows

### Out of scope

- Rich item editing
- Item type switching beyond the default login item
- Optimistic UI
- Offline queueing
- Conflict resolution UI
- Search, filtering, sorting, import, or favorites management
- Browser extension and iOS UI changes

## User Experience

The `/vault` page becomes a simple management screen:

- Header with a short status line
- Small create form with a single `Title` field and a `Save item` action
- List of current vault items
- `Delete` action per item

On first load, the page checks for a browser Supabase session. If no session is available, it shows a clear message telling the user to sign in through the register flow first. If a session exists, the page automatically syncs and renders the returned `updated_items`.

When the user creates an item, the page generates a client-side item id, wraps it in the existing `VaultSyncItem` shape, sends it as `changed_items`, and then replaces local state with the server response. When the user deletes an item, the page sends its id through `deleted_item_ids` and again trusts the server response as the source of truth.

## Architecture

The page should stay thin. The recommended split is:

- `src/app/vault/page.tsx`
  Page composition only
- `src/components/vault/vault-panel.tsx`
  Presentational UI for loading, form, list, and actions
- `src/components/vault/use-vault-sync.ts`
  Client hook that owns session lookup, sync calls, create, delete, and view state

This keeps side effects and API orchestration out of the page file without introducing a new global state layer. The hook is the only Web-specific stateful unit; the shared API contract remains in `packages/api-client`.

## Data Flow

### Initial load

1. Browser page mounts
2. Hook creates the browser Supabase client
3. Hook reads the current session from `supabase.auth.getSession()`
4. If there is no access token, the hook enters an unauthenticated state
5. If there is a token, the hook calls:

```ts
syncVault(fetch, token, {
  changed_items: [],
  deleted_item_ids: [],
})
```

6. The hook stores `updated_items` as the visible list

### Create flow

1. User enters a title and submits
2. Hook validates that the title is not blank
3. Hook creates a minimal `VaultSyncItem` with:
   - generated `id`
   - `item_type: "login"`
   - `title`
   - placeholder `encrypted_payload`
   - sensible timestamps
4. Hook calls `syncVault(..., { changed_items: [item], deleted_item_ids: [] })`
5. Hook replaces local items with `response.updated_items`

### Delete flow

1. User clicks `Delete` for one row
2. Hook calls `syncVault(..., { changed_items: [], deleted_item_ids: [id] })`
3. Hook replaces local items with `response.updated_items`
4. Any returned deleted ids are used only for status feedback in this slice, not for a separate deleted-items UI

## Error Handling

This slice should stay intentionally small:

- No session: show `Sign in from the register flow first.`
- Blank title: block submission locally
- Sync failure: show a compact generic error banner
- Failed create/delete: preserve the last successful item list
- Loading and syncing states: disable actions while a request is in flight

The UI should not translate every backend error code yet. A single stable error message is enough for MVP as long as the user can recover.

## Data Shape Decisions

The page will use the existing sync contract as-is. No new API routes are introduced.

For newly created items, the temporary item body can use a minimal placeholder payload such as:

```ts
{
  schema_version: 1,
  username: "",
  password_ciphertext: "",
  notes: "",
}
```

This is not the final encryption model. It is only a temporary product placeholder so the Web page can exercise the sync protocol with a valid JSON payload.

## Testing Strategy

Web tests should cover the full UI behavior at the page/hook boundary:

- unauthenticated state renders the sign-in guidance
- initial load requests sync and renders returned items
- create flow sends one changed item and re-renders with server data
- delete flow sends one deleted id and removes the item after the response
- blank-title submission is blocked locally
- sync failure preserves existing items and shows an error message

No API changes are required for this slice, so backend tests only need to be reused indirectly through the already-green sync layers.

## Success Criteria

This feature is complete when:

- `/vault` no longer shows placeholder text
- an authenticated user can see server-backed items on load
- the same page can create and delete items through `syncVault`
- the Web test suite covers load/create/delete/error states
- the repo remains green under the existing lint and test entrypoints
