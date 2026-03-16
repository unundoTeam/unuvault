# Web Vault Legacy Password Migration Design

## Summary

This slice restores compatibility for login items that were saved before the Web vault encryption boundary landed.

Today `unuvault` stores new Web passwords as versioned envelope strings in `encrypted_payload.password_ciphertext`. That boundary is now correct for newly created and edited items, but older data may still contain raw plaintext strings in the same field.

The current behavior is fail-closed:

- sealed values open correctly
- invalid envelope data resolves to an empty password
- old plaintext values therefore look like `No password saved`

That is acceptable for obviously broken ciphertext, but it is too harsh for data that `unuvault` itself previously wrote. This slice makes legacy data readable again without reintroducing raw-string storage for new writes.

## Scope

### In scope

- treat legacy non-empty plaintext password values as readable password material in the Web client
- keep sealed-envelope behavior unchanged for new values
- migrate legacy plaintext to envelope format only when the user explicitly saves an item
- add focused tests for legacy reveal, copy, edit, and save-upgrade behavior

### Out of scope

- background or automatic migration during initial page load
- server-side batch migration
- sync route changes
- database schema changes
- full master-password or unlock UX
- browser extension and iOS migration behavior

## Approaches Considered

### 1. Read legacy plaintext, reseal only on explicit save

This is the recommended approach.

It keeps existing user data usable immediately, avoids hidden writes during page load, and keeps migration behavior easy to explain: viewing old data is safe, saving old data upgrades it.

### 2. Auto-upgrade legacy plaintext the first time Web reads it

This would eventually normalize more data automatically, but it introduces hidden writes:

- opening the vault can mutate stored data
- multi-item loads can produce unexpected sync traffic
- failures become harder to explain because “just viewing” becomes a write operation

### 3. Keep fail-closed and require manual re-entry

This is the simplest implementation, but it is the worst user outcome. It discards still-valid product data merely because the storage format changed.

## Chosen Approach

The chosen approach is:

- read new envelope values through the current seal/open boundary
- if opening fails, treat a non-empty raw string as legacy plaintext
- continue to fail closed for empty values and unusable types
- only reseal to envelope format on explicit create or edit save paths

This keeps the architectural direction intact while preventing a user-visible regression for pre-boundary data.

## Data Contract

The transport shape remains unchanged:

```ts
type VaultLoginPayload = {
  schema_version: 1;
  username: string;
  password_ciphertext: string;
  notes: string;
};
```

The meaning of `password_ciphertext` becomes:

- preferred format: serialized envelope string
- tolerated legacy format: non-empty plaintext written by earlier Web flows

The API and database still treat the field as opaque string data.

## Architecture

### `packages/security`

The security helper becomes the single compatibility boundary for stored password strings.

It should:

- open valid envelopes exactly as it does today
- expose a clear way to detect or open legacy plaintext safely
- keep malformed envelope data from surfacing as garbage

The compatibility rule should be explicit in code rather than scattered through UI components.

### `apps/web/src/components/vault/login-payload.ts`

The Web payload helper should remain the only UI-facing consumer of password storage semantics.

It should:

- read either envelope or legacy plaintext into local draft state
- continue to write only sealed envelope strings for any save path
- keep `hasSavedPassword`, reveal labels, and copy behavior consistent regardless of old/new source format

### Web UI

`vault-panel.tsx` and related hooks should not need to know whether a password came from legacy plaintext or from a sealed envelope.

The UI contract stays:

- reveal shows usable plaintext locally
- copy writes usable plaintext to the clipboard
- edit form prefills with usable plaintext
- save writes envelope storage back out

## Data Flow

### Reading a saved password

1. Web reads `password_ciphertext`
2. helper first attempts to open it as a supported envelope
3. if that fails and the string is non-empty, helper treats it as legacy plaintext
4. local UI receives plaintext for reveal, copy, and edit prefill

### Saving a legacy item after edit

1. Web opens the old plaintext through the compatibility helper
2. user edits or re-saves the item
3. save path seals the password into the current envelope format
4. sync stores only the sealed value going forward

## Error Handling

This slice should distinguish between two cases:

- **legacy plaintext**: still usable, should remain readable
- **truly broken envelope data**: should still fail closed

That means:

- empty strings still behave as “no password saved”
- invalid JSON that is not recognized as a legacy plaintext case should not show garbage
- reveal/copy should never expose raw envelope JSON

## Testing Strategy

### `packages/security`

- valid envelopes still round-trip
- legacy plaintext opens as readable plaintext through the compatibility path
- empty string still resolves to empty
- obviously invalid envelope structures still fail safely

### Web

- old plaintext-backed item can still show `Show password`
- old plaintext-backed item can still copy password
- old plaintext-backed item can prefill edit mode
- saving a legacy item rewrites `password_ciphertext` as a new envelope string

## Success Criteria

This slice is complete when:

- legacy plaintext passwords remain usable in Web reveal/copy/edit flows
- new saves continue to emit envelope strings only
- Web does not perform hidden migration writes on initial load
- sync/API contracts remain unchanged
- repo verification remains green
