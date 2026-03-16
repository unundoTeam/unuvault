# Web Vault Login Fields Design

## Summary

This slice turns the Web vault login item from a title-only demo into a minimal real record shape. Today the page can create, edit, delete, and sync items, but the only meaningful user-controlled field is `title`. The `encrypted_payload` object exists mostly as a placeholder and is not surfaced as a real part of the product.

The goal of this slice is to make the first login item feel materially closer to a password manager record without taking on the full password-entry and crypto UX yet. For this first step, the Web vault should support three meaningful fields for `login` items:

- `title`
- `username`
- `notes`

`password_ciphertext` stays in the payload as a placeholder field, but it remains non-editable in this slice.

## Scope

### In scope

- Treat Web vault items as `login` items with a defined payload shape
- Expand create flow to collect:
  - `title`
  - `username`
  - `notes`
- Expand edit flow to update:
  - `title`
  - `username`
  - `notes`
- Show `username` in the default list row
- Keep `notes` editable, but display only a lightweight summary in the list
- Tighten the TypeScript contract around login payloads in the shared API client layer
- Add Web tests for create/edit/list behavior with real login payload fields

### Out of scope

- Real password entry
- Real client-side encryption
- Copy password / reveal password UX
- Website URL field
- TOTP / 2FA fields
- Custom fields
- Item-type switching
- Full item detail drawer or modal

## Chosen Approach

The chosen approach is to keep the existing single-page vault flow and promote `encrypted_payload` from a vague record into a first explicit `login` payload shape.

This is preferred over adding password input immediately because:

- it introduces real product structure without expanding the security boundary yet
- it keeps the sync protocol unchanged
- it builds directly on the current create/edit/delete flows
- it creates a cleaner foundation for password input later

The core product choice is:

- `title` remains top-level on `VaultSyncItem`
- `username` and `notes` live inside `encrypted_payload`
- `password_ciphertext` remains present but stays an empty placeholder string for now

## User Experience

### Create form

The create form should grow from one field to three:

- `Title`
- `Username`
- `Notes`

The save button remains `Save item`.

Validation should stay intentionally small:

- `Title` is still required
- `Username` and `Notes` are optional

After a successful create:

- the form resets all three fields
- the new item appears in the list
- the current sync status feedback continues to work

### Default list row

Each row should show:

- the item title
- the username when present
- a small note indicator when notes exist, such as `Notes added`
- `Edit`
- `Delete`

The list should not dump full notes content inline. This slice is about making the record shape real, not expanding the browsing layout into a full detail view.

### Edit flow

The existing inline edit mode should expand from one field to three:

- `Edit title`
- `Edit username`
- `Edit notes`

The current save/cancel behavior remains:

- `Save` syncs the updated item
- `Cancel` discards the local draft only

Validation remains simple:

- edited `title` cannot be blank

## Data Contract

The shared client layer should define an explicit login payload type for Web usage, for example:

```ts
export type VaultLoginPayload = {
  schema_version: 1;
  username: string;
  password_ciphertext: string;
  notes: string;
};
```

The corresponding item shape remains:

```ts
export type VaultSyncItem = {
  id: string;
  item_type: "login" | string;
  title: string;
  encrypted_payload: VaultLoginPayload;
  favorite: boolean;
  source: string;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};
```

No API route or database schema change is required for this slice because `vault_items.encrypted_payload` is already stored as `jsonb` and the sync contract already transports the payload.

## Architecture

No new page, route, or service layer is needed. The current structure remains appropriate:

- `packages/api-client/src/vault.ts`
  defines the stronger login payload contract
- `apps/web/src/components/vault/use-vault-sync.ts`
  creates and updates login items with the fuller payload
- `apps/web/src/components/vault/vault-panel.tsx`
  renders the expanded create/edit inputs and lightweight list summaries
- `apps/web/tests/vault-page.spec.tsx`
  protects the user-visible create/edit/list behavior

This keeps sync orchestration in the hook and keeps field layout decisions in the panel.

## Data Flow

### Create login item

1. User enters `title`, optional `username`, and optional `notes`
2. Panel validates `title`
3. Panel calls `createItem({ title, username, notes })`
4. Hook creates a `VaultSyncItem` with:
   - top-level `title`
   - `encrypted_payload.username`
   - `encrypted_payload.notes`
   - `encrypted_payload.password_ciphertext = ""`
5. Hook syncs through existing `changed_items`
6. Hook replaces local items with `response.updated_items`

### Edit login item

1. User enters inline edit mode for one item
2. Panel pre-fills `title`, `username`, and `notes` from the current item
3. Panel validates edited `title`
4. Panel calls `updateItem(...)`
5. Hook copies the current item and replaces:
   - top-level `title`
   - `encrypted_payload.username`
   - `encrypted_payload.notes`
   - `updated_at`
6. Hook syncs through existing `changed_items`
7. Panel exits edit mode on success

### List rendering

The default row should derive display fields from both top-level and payload fields:

- `title` from `item.title`
- `username` from `item.encrypted_payload.username`
- notes summary from `item.encrypted_payload.notes`

## Error Handling

This slice should reuse the current error model:

- blank create title is still blocked locally
- blank edited title is still blocked locally
- failed sync keeps the last successful list visible
- failed edit keeps the row in edit mode

No field-specific server validation is added in this slice.

## Testing Strategy

Web tests should cover:

- create flow sends `username` and `notes` in `encrypted_payload`
- successful create resets all form fields
- list row shows `username`
- list row shows a notes indicator when notes exist
- edit mode pre-fills `title`, `username`, and `notes`
- save flow sends updated `username` and `notes`
- existing title validation still works with expanded form state

Shared client tests should cover:

- the login payload contract still round-trips through `syncVault`

The backend does not need new behavior tests because this slice continues to use the existing sync path and JSON payload storage.

## Success Criteria

This slice is complete when:

- Web create/edit flows support `title`, `username`, and `notes`
- the sync payload for login items uses a stable explicit shape
- the list shows meaningful login metadata beyond title alone
- the current sync status and CRUD flows continue to work
- Web and repo-wide verification stay green
