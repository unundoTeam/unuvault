# Web Vault Copy Username And Password Placeholder Design

## Summary

This slice makes the Web vault login item feel more like a usable credential record without crossing into real password-entry UX yet. The current Web vault already supports create, edit, delete, sync status, and the first real login metadata fields (`title`, `username`, `notes`), but it still lacks two core day-to-day actions:

- copying a saved username
- understanding where password reveal behavior will eventually live

The goal of this slice is to add those two pieces in the smallest possible way:

- support `Copy username` directly from the vault list
- add a password row with show/hide state for a placeholder password presentation

This keeps the product moving toward a believable password manager surface while still keeping real password input and crypto UX out of scope.

## Scope

### In scope

- add an inline `Copy username` action for login items that have a username
- add an inline password row for login items
- default the password row to a hidden placeholder state
- support `Show password` / `Hide password` per item
- show `No password saved` when `password_ciphertext` is empty
- show a non-sensitive placeholder reveal value when a password exists but the item is revealed
- keep the interaction local to the Web vault without changing sync or database behavior
- add Web tests for copy, reveal, hide, and empty-password states

### Out of scope

- real plaintext password entry
- real password decryption
- copy password
- URL field
- credential details drawer or modal
- global toasts
- browser extension or iOS changes
- database or API schema changes

## Chosen Approach

The chosen approach is to keep these actions directly in the existing list row.

Each item row should remain the primary interaction surface. The row already carries lightweight edit and delete controls, so adding `Copy username` and a password reveal toggle continues the same interaction model without introducing a second details layer.

This is preferred over a details drawer or side panel because:

- it keeps the current vault page structure intact
- it lets the first credential-oriented actions land quickly
- it avoids adding a larger navigation pattern before the Web vault needs it
- it keeps the password placeholder clearly framed as transitional behavior

## User Experience

### Username action

If a login item has a non-empty username, the default row should show a `Copy username` button.

When the user copies the username:

- the app should call the clipboard API
- the button should briefly switch to a success label such as `Copied`
- the success state should be local to that one item

If the item has no username:

- the button should not appear

This keeps the row concise and avoids presenting an action that cannot succeed.

### Password row

Every login item row should include a password section beneath the visible metadata.

The password section should behave like this:

- if `password_ciphertext` is empty:
  - show `No password saved`
  - do not show `Show password`
- if `password_ciphertext` is non-empty and the item is hidden:
  - show a masked placeholder such as `••••••••`
  - show `Show password`
- if `password_ciphertext` is non-empty and the item is revealed:
  - show a clear placeholder label such as `Encrypted password placeholder`
  - replace the action with `Hide password`

This gives users a believable reveal interaction without pretending the product already decrypts real secrets in the browser.

### Interaction rules

- reveal state is local to each item
- revealing one item must not reveal other items
- copy success state is local to each item
- copy success should reset after a short timeout or when the row rerenders due to sync state changes
- edit mode remains unchanged for this slice

## Architecture

No API or sync change is required for this slice.

The existing boundaries remain appropriate:

- `apps/web/src/components/vault/login-payload.ts`
  should continue to normalize the payload and can grow small helpers for password placeholder state
- `apps/web/src/components/vault/vault-panel.tsx`
  should own reveal state, copy state, and the new inline controls
- `apps/web/tests/vault-page.spec.tsx`
  should protect the user-visible behavior

This keeps product logic close to the current row rendering surface and avoids inventing a new state layer for simple local interactions.

## Data Flow

### Copy username

1. User clicks `Copy username`
2. The panel reads the current item's normalized username
3. The panel writes it to `navigator.clipboard.writeText(...)`
4. The row enters a temporary copied state
5. The copied state clears automatically after a short delay

No sync request should be sent.

### Reveal password placeholder

1. User clicks `Show password`
2. The panel marks that specific item as revealed
3. The row switches from masked text to the placeholder reveal label
4. User can click `Hide password` to restore the masked state

No sync request should be sent.

## Error Handling

This slice should stay intentionally light:

- clipboard failure should show a small local error or fall back to the existing page-level error pattern only if necessary
- empty username means no copy button, not an error
- empty password placeholder means no reveal toggle, not an error

The reveal state should never block editing, deleting, or syncing.

## Testing Strategy

Web tests should cover:

- `Copy username` appears only when username exists
- clicking copy calls the clipboard API with the correct username
- successful copy shows a transient copied state
- password row shows `No password saved` when `password_ciphertext` is empty
- password row shows masked placeholder text when `password_ciphertext` exists
- `Show password` reveals only the targeted item
- `Hide password` restores the masked state

No API tests are needed because this slice does not change sync behavior.

## Success Criteria

This slice is complete when:

- login rows expose a working `Copy username` action
- login rows expose a believable show/hide password placeholder state
- empty-password items clearly communicate that no password is stored
- the new interaction states stay local to each item
- existing vault CRUD and sync flows remain unchanged
- Web and repo-wide verification stay green
