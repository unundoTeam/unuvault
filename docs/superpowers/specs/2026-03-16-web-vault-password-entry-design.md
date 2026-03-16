# Web Vault Password Entry Design

## Summary

This slice turns the Web vault password field from a placeholder-only concept into a real editable part of the login item. Today `unuvault` can create, edit, delete, sync, copy usernames, and show per-item password visibility states, but the password itself is still not user-enterable. The row can only reveal placeholder text, not an actual saved value.

The goal of this slice is to make password handling real enough to support meaningful product usage while still staying honest about the current security boundary. For this step:

- create and edit flows should include a `Password` input
- the input should default to a masked field with `Show` / `Hide` toggles
- saved password values should flow through `encrypted_payload.password_ciphertext`
- list-level reveal should show the saved password value for that item

This does **not** introduce real client-side encryption yet. Instead, it establishes a clear boundary so the storage and rendering path can later be replaced with true encryption logic.

## Scope

### In scope

- add a `Password` field to the create form
- add a `Password` field to inline edit mode
- default password inputs to masked display
- add local show/hide toggles for create and edit password inputs
- add helper functions for reading and writing the current draft password through the login payload
- store the entered password in `encrypted_payload.password_ciphertext`
- update list-level reveal so it shows the saved password value instead of a placeholder label
- keep `No password saved` behavior for empty items
- add Web tests for create, edit, input visibility, and list reveal behavior

### Out of scope

- real client-side encryption
- password strength checks
- generated passwords
- copy password
- browser extension or iOS changes
- API or database schema changes
- item detail drawer or modal

## Chosen Approach

The chosen approach is to make password entry real in the Web surface while isolating the storage boundary behind thin helpers.

This means:

- the UI will treat password as a normal user-editable field
- `password_ciphertext` remains the transport/storage field
- the Web app will not read or write that field directly everywhere
- instead, small helpers will define the current draft-password boundary

This is preferred over inventing a fake protocol like `PLAINTEXT::<value>` because:

- it avoids creating a temporary format that would need later migration
- it keeps the current sync contract stable
- it makes the eventual crypto swap a helper-level replacement rather than a UI rewrite

The honest product tradeoff is:

- the current implementation still stores a draft password value without encryption
- but the code structure should make that boundary explicit and easy to replace

## User Experience

### Create form

The create form should expand from three fields to four:

- `Title`
- `Username`
- `Password`
- `Notes`

The password input should:

- use masked display by default
- include a nearby `Show password` / `Hide password` control
- preserve the current value while toggling visibility

Validation remains intentionally small:

- `Title` is required
- `Username`, `Password`, and `Notes` are optional

After a successful create:

- all four fields reset
- the password field returns to hidden mode

### Edit form

Inline edit mode should also include a password input with the same behavior:

- masked by default
- local `Show password` / `Hide password` toggle
- prefilled with the saved password value for the current item

The existing save/cancel behavior remains:

- `Save` syncs the updated record
- `Cancel` discards local draft changes only

### List row

The default row should keep the current lightweight structure:

- title
- username when present
- notes indicator when notes exist
- password state row
- copy username action when available
- show/hide password action when a password exists

The key change in this slice is the reveal behavior:

- hidden state still shows `••••••••`
- revealed state should now show the actual saved password value
- empty password still shows `No password saved`

This turns the existing reveal control into a meaningful interaction instead of a placeholder-only affordance.

## Data Contract

The shared login payload shape does not need a new field. It remains:

```ts
type VaultLoginPayload = {
  schema_version: 1;
  username: string;
  password_ciphertext: string;
  notes: string;
};
```

The important change is semantic:

- `password_ciphertext` stops being a purely empty placeholder
- for this slice, it carries the current raw draft password value

To keep that boundary explicit, Web code should introduce helper-level access like:

```ts
readDraftPassword(payload): string
writeDraftPassword(payload, password): VaultLoginPayload
```

The initial implementation can read and write the raw string directly. Later, when real encryption lands, these helpers become the swap point.

## Architecture

No API or schema change is required.

The current Web boundaries remain correct:

- `apps/web/src/components/vault/login-payload.ts`
  should own the password read/write helpers and display helpers
- `apps/web/src/components/vault/use-vault-sync.ts`
  should accept password in create/update input shapes and sync it
- `apps/web/src/components/vault/vault-panel.tsx`
  should own create/edit input visibility state and list reveal state
- `apps/web/tests/vault-page.spec.tsx`
  should cover the user-visible behavior

This keeps sync orchestration in the hook and keeps password UI concerns in the panel.

## Data Flow

### Create password entry

1. User fills `Title`, optional `Username`, optional `Password`, optional `Notes`
2. Panel validates `Title`
3. Panel calls `createItem({ title, username, password, notes })`
4. Hook writes the password through the payload helper into `password_ciphertext`
5. Hook syncs through existing `changed_items`
6. Sync response replaces local items

### Edit password entry

1. User enters inline edit mode
2. Panel reads the saved password through the payload helper
3. Panel pre-fills the password input
4. On save, hook updates `title`, `username`, `notes`, and password through the helper
5. Hook syncs through existing `changed_items`
6. Panel exits edit mode on success

### Reveal in the list

1. User clicks `Show password` for one item
2. The row enters revealed state only for that item
3. The password display uses the helper-read value from the payload
4. User clicks `Hide password` to restore masking

## Error Handling

This slice should stay small and reuse the current model:

- blank create title is still blocked locally
- blank edited title is still blocked locally
- failed sync keeps the last successful list visible
- failed edit keeps the row in edit mode

Password visibility toggles are local UI state and should not affect sync state.

## Testing Strategy

Web tests should cover:

- create form accepts password and sends it in `encrypted_payload.password_ciphertext`
- successful create resets the password field and returns it to hidden mode
- edit mode pre-fills the saved password
- save flow updates `password_ciphertext`
- create and edit password inputs can toggle between hidden and visible locally
- list reveal shows the actual saved password value for one item only
- empty-password items still show `No password saved`

No API tests are needed because this slice does not change the sync contract or backend behavior.

## Success Criteria

This slice is complete when:

- Web create and edit forms support password input
- password values flow through the dedicated helper boundary
- list reveal shows saved password values instead of placeholder labels
- empty-password behavior stays intact
- current sync, CRUD, and username-copy flows continue to work
- Web and repo-wide verification stay green
