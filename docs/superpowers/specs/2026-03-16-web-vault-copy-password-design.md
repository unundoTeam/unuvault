# Web Vault Copy Password Design

## Summary

This slice adds the last missing everyday action to the current Web vault login row: copying the saved password directly from the vault list.

`unuvault` already supports:

- loading synced login items
- create, edit, and delete
- row-level `Show password` / `Hide password`
- `Copy username`
- real password entry through `encrypted_payload.password_ciphertext`

What is still missing is the most common password-manager action: copying the saved password without first stepping through another view or opening edit mode.

The goal of this slice is to add a small, direct `Copy password` action that works from the existing list row, keeps feedback local to the item, and does not change sync or crypto boundaries.

## Scope

### In scope

- add inline `Copy password` for login items that have a saved password
- allow copy without requiring `Show password` first
- use the saved value from `encrypted_payload.password_ciphertext`
- keep copied feedback local to the item that was clicked
- keep copy state independent from reveal/hide state
- add Web tests for button visibility, clipboard behavior, feedback, and interaction independence

### Out of scope

- new API or sync behavior
- cryptography changes
- masking or clearing the system clipboard
- browser extension changes
- iOS changes
- detail drawers or expanded item views
- global toast infrastructure

## Chosen Approach

The chosen approach is to put `Copy password` directly in the existing list row next to the other per-item actions.

This is preferred over requiring `Show password` first because:

- it matches the common expectation for password managers
- it keeps the fastest path fast
- it avoids turning a single frequent action into a two-step sequence
- it fits the current row-action model already used by `Copy username`, `Edit`, and `Delete`

This is also preferred over moving password actions into a separate details surface because the current Web vault is still intentionally simple and row-centric.

## User Experience

### Button visibility

If a login item has a saved password:

- show `Copy password <title>`

If a login item does not have a saved password:

- do not show `Copy password`
- keep the existing `No password saved` messaging

This keeps the action honest and avoids presenting a button that cannot succeed.

### Copy flow

When the user clicks `Copy password <title>`:

1. read the current saved password from the normalized login payload
2. call `navigator.clipboard.writeText(...)`
3. switch only that button into a short-lived success state such as `Copied password <title>`
4. automatically clear the copied state after a short delay

No sync request should be sent.

### Interaction rules

- copying does not require the row to be revealed first
- copying does not auto-reveal the password
- copying one item does not affect another item's copy state
- reveal/hide state and copy state are independent
- if a password is currently revealed, copying it should not change the revealed state

## Architecture

No API or data-model change is needed.

The current file boundaries remain good:

- `apps/web/src/components/vault/login-payload.ts`
  already owns normalized reads from `encrypted_payload`
- `apps/web/src/components/vault/vault-panel.tsx`
  should own the local clipboard interaction and copied-state tracking
- `apps/web/tests/vault-page.spec.tsx`
  should protect the user-visible behavior

This keeps the change entirely on the Web surface and avoids leaking clipboard concerns into sync or shared API layers.

## Data Flow

### Copy password

1. user clicks `Copy password <title>`
2. the row reads the saved password with the existing payload helper boundary
3. the panel writes it to `navigator.clipboard.writeText(...)`
4. the panel stores a temporary copied-password item id
5. after a short timeout, the copied state is cleared

### Reveal independence

1. user may or may not have clicked `Show password`
2. copy still reads the saved password directly from the payload
3. the reveal state is left unchanged

## Error Handling

This slice should stay light:

- if clipboard APIs are unavailable, do nothing rather than creating a new global error channel
- if the saved password is empty, the copy button should not appear
- copy failure should not affect sync state or reveal state

The action should never block editing, deleting, or future syncing.

## Testing Strategy

Web tests should cover:

- `Copy password` appears only when a saved password exists
- clicking copy writes the saved password to the clipboard
- copy works even when the password is still hidden
- copying one item shows local copied feedback for only that item
- copied feedback clears after the timeout
- copying does not force the password to reveal
- reveal/hide continues to work normally after copying

No API tests are needed because this slice does not change server behavior.

## Success Criteria

This slice is complete when:

- login rows with saved passwords expose a working `Copy password` action
- rows without saved passwords do not expose that action
- copying uses the saved password value without requiring reveal first
- copied feedback stays local to the clicked row and clears automatically
- existing create, edit, delete, reveal, and sync flows remain unchanged
- Web and repo-wide verification stay green
