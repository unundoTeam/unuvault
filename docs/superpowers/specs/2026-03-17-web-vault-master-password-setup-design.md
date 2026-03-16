# Web Vault Master Password Setup Design

## Summary

`unuvault` already has a real Web vault unlock boundary:

- authenticated Web vault sync
- password envelopes in `packages/security`
- a Web-only unlock passphrase held in page memory
- locked versus unlocked password actions

What it still lacks is a formal "this browser has a master password" setup flow.

Today the unlock passphrase exists only as an in-page action. That is enough to prove the unlock boundary, but it is not yet a real product story. Users do not get a first-time setup moment, and the page has no durable way to tell the difference between:

- this browser has never established a master password
- this browser has a master password but is currently locked

The goal of this slice is to add the smallest honest master-password setup flow for the Web vault:

- first entry to the vault asks the user to set a master password
- the browser stores only a local verifier, never the master password itself
- refresh returns the page to `locked`
- existing password create, edit, reveal, and copy continue to work only after unlock
- API, sync, and database contracts remain unchanged

This is intentionally still Web-only. It is the minimum product step that turns the current unlock passphrase into a true master-password concept without dragging in cross-device key management.

## Scope

### In scope

- detect whether this browser has already established a master password
- show a first-run setup state before normal lock and unlock
- store a local master-password verifier in browser persistence
- keep the actual master password in memory only for the current page session
- move the existing unlock flow to use the stored verifier instead of guessing from vault items
- keep password actions disabled until setup or unlock succeeds
- add tests for setup, locked, and unlocked flows

### Out of scope

- server-side storage of master-password verifier material
- cross-browser or cross-device synchronization of setup state
- recovery keys or account recovery
- changing the vault sync or API contract
- iPhone or browser extension master-password setup
- changing the password envelope contract again
- changing or rotating an existing master password

## Chosen Approach

The chosen approach is **first-entry master-password setup backed by a browser-local verifier**.

That means:

- the first time a signed-in user opens the Web vault on a browser, the page enters `needs_setup`
- the user sets a master password and confirms it
- the browser stores a small verifier object locally
- the page immediately transitions to `unlocked`
- on later visits or after refresh, the page reads the verifier and enters `locked`
- the user unlocks by re-entering the same master password

This approach is preferred over "ask later on first password save" because it gives the cleanest product story. It is also preferred over server-side verifier storage because this slice is about making the Web boundary feel real without expanding the backend contract.

## Architecture

### State model

The Web vault should have three explicit states:

1. `needs_setup`
   The browser has no stored verifier yet.
2. `locked`
   A verifier exists locally, but the current page session has not unlocked.
3. `unlocked`
   The current page session has verified the master password and may open password envelopes.

The page should move between them like this:

- first signed-in load with no verifier -> `needs_setup`
- successful setup -> `unlocked`
- refresh with verifier present -> `locked`
- successful unlock -> `unlocked`
- explicit lock or refresh -> `locked`

### Master-password verifier

The browser should persist only a small verifier object in `localStorage`, for example:

- `version`
- `salt`
- `check`

This object answers only one question: "does the entered master password match the one previously established on this browser?"

It must not store:

- the master password itself
- a reusable plaintext password
- the current unlocked state

### Separation of concerns

`Supabase Auth` remains unchanged and still answers "who is the user?"

The local master-password layer answers:

- has this browser ever established a master password?
- is the current page unlocked?
- what in-memory passphrase should be used for password envelope `seal/open` right now?

This keeps authentication, sync, and local unlock concerns cleanly separated.

## Components

### Shared security helper

`packages/security` should add a focused verifier helper that can:

- create a verifier from a master password
- validate an entered master password against stored verifier data
- tolerate missing or malformed verifier data safely

This helper should stay independent from React and browser APIs so it can be tested in isolation.

### Web unlock state

The current Web unlock state unit should expand to own:

- `needs_setup`, `locked`, and `unlocked`
- current draft password fields for setup and unlock
- current in-memory unlocked passphrase
- setup validation errors
- unlock validation errors
- reading and writing the verifier from browser storage

It should still keep the actual master password in memory only.

### Vault panel

The vault panel should render a compact but explicit top section:

- `needs_setup`
  - `Master password`
  - `Confirm master password`
  - `Set master password`
- `locked`
  - `Master password`
  - `Unlock vault`
- `unlocked`
  - `Vault unlocked`
  - `Lock vault`

The rest of the vault stays visible so the user keeps context, but password-specific actions remain unavailable until setup or unlock succeeds.

## Data Flow

### First-time setup

1. the user authenticates through the existing flow
2. the vault loads normally
3. the page checks browser storage for a master-password verifier
4. no verifier exists, so the page enters `needs_setup`
5. the user enters and confirms a master password
6. the browser creates and stores a verifier locally
7. the page stores the master password in current memory and becomes `unlocked`

### Returning unlock

1. the user reloads or returns later
2. the page finds a verifier in browser storage
3. the page enters `locked`
4. the user enters the master password
5. the browser validates it against the verifier
6. on success, the page becomes `unlocked`

### Password usage

Once unlocked:

- create flow seals new passwords with the current in-memory master password
- reveal and copy open stored passwords locally
- edit flow opens then reseals passwords with the same in-memory master password

The server still receives opaque `password_ciphertext` strings and does not learn about the local verifier.

## Error Handling

- setup with empty password -> `Master password is required`
- setup confirmation mismatch -> `Passwords do not match`
- unlock with empty password -> `Master password is required`
- unlock with wrong password -> `Wrong master password`
- malformed local verifier -> treat as `needs_setup`
- malformed or unreadable stored password envelope -> continue fail-closed and show `No password saved`

These errors should stay local to the page and must not break vault list rendering.

## Testing Strategy

### `packages/security`

- creates a verifier from a master password
- validates the correct master password
- rejects an incorrect master password
- fails safely on invalid verifier objects

### Web

- first signed-in load without a verifier shows `Set master password`
- successful setup immediately unlocks the page
- reload with a verifier shows `Unlock vault`
- wrong master password does not unlock
- locked and `needs_setup` states keep password actions unavailable
- setup and later unlock still allow existing password create, edit, reveal, and copy flows

## Success Criteria

This slice is complete when:

- the Web vault distinguishes `needs_setup`, `locked`, and `unlocked`
- first entry requires setting a master password before password actions are available
- later visits use a local verifier to re-enter the locked state
- the master password itself is never persisted locally
- existing password envelope usage continues unchanged after unlock
- API and sync contracts remain unchanged
