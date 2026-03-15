# Web Vault Edit Sync Design

## Summary

This slice adds the missing edit half of the Web vault MVP. The current page already supports loading items, creating one, and deleting one through the shared sync contract. The remaining gap is updating an existing item. This design adds a small inline edit flow so a user can change an item's title and save it back through `changed_items` using the existing item id.

The goal is not to build a complete item editor. The goal is to complete a minimal CRUD loop on the Web vault page while staying inside the existing sync model and UI patterns.

## Scope

### In scope

- Add an `Edit` action for each listed vault item
- Let one row enter inline edit mode at a time
- Allow the user to change the title and save it
- Send the update through the existing `syncVault` request using the same item id
- Keep the page state aligned to the server-returned `updated_items`
- Add tests for enter-edit, save, cancel, and empty-title validation

### Out of scope

- Editing `encrypted_payload`
- Editing item type
- Multi-row editing
- Optimistic updates
- Keyboard shortcuts
- Conflict-specific UI
- Dedicated detail drawer or modal

## User Experience

Each item row gets two normal states:

- default row state: title, `Edit`, `Delete`
- edit row state: title input, `Save`, `Cancel`

The interaction flow is:

1. User clicks `Edit <title>`
2. That row switches into inline edit mode
3. The input is prefilled with the current title
4. User can:
   - click `Save` to sync the edited title
   - click `Cancel` to discard the local draft

Only one row should be editable at once. When a row enters edit mode, the create form can stay visible, but other rows stay in display mode.

## Architecture

No new page-level abstraction is needed. The existing structure is already appropriate:

- `src/app/vault/page.tsx`
  remains a thin page shell
- `src/components/vault/use-vault-sync.ts`
  gains an `updateItemTitle(itemId, title)` action
- `src/components/vault/vault-panel.tsx`
  owns the row-level edit UI state

This keeps sync orchestration in the hook and keeps purely presentational interaction state in the component.

## Data Flow

### Enter edit mode

The panel stores:

- `editingItemId: string | null`
- `editingTitle: string`
- `editingValidationMessage: string | null`

When the user clicks `Edit <title>`:

- `editingItemId` becomes that row's id
- `editingTitle` becomes the current title
- `editingValidationMessage` clears

### Save edit

When the user clicks `Save`:

1. Panel validates the trimmed title is not empty
2. Panel calls `updateItemTitle(itemId, title)`
3. Hook finds the current item in local `items`
4. Hook creates an updated `VaultSyncItem` by copying the item and replacing:
   - `title`
   - `updated_at`
5. Hook sends:

```ts
syncVault(fetch, token, {
  changed_items: [updatedItem],
  deleted_item_ids: [],
})
```

6. Hook replaces local `items` with `response.updated_items`
7. Panel exits edit mode on success

### Cancel edit

When the user clicks `Cancel`:

- `editingItemId` becomes `null`
- `editingTitle` resets
- `editingValidationMessage` clears

No sync request is sent.

## Error Handling

The existing vault error model is sufficient:

- empty edited title is blocked locally
- failed save keeps the row in edit mode
- generic sync failure message continues to come from the hook
- last successful item list remains visible

The panel should not silently exit edit mode on a failed save. That way the user can adjust and retry.

## Testing Strategy

Web tests should add these cases:

- clicking `Edit <title>` shows an inline title input populated with the current title
- clicking `Save` sends a changed item with the same `id` and the new title
- after a successful save, the row returns to display mode and shows the new title
- clicking `Cancel` restores display mode without an extra sync call
- saving an empty edited title is blocked locally

The backend does not need new tests because this flow is still using the existing `changed_items` sync path.

## Success Criteria

This slice is complete when:

- a user can update an existing item title from the Web vault page
- the edited row saves through the existing sync contract
- cancel leaves server state untouched
- empty edited titles are blocked locally
- the Web and repo-wide verification suites remain green
