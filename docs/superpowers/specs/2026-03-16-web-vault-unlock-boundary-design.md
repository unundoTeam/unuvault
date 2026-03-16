# Web Vault Unlock Boundary Design

## Summary

This slice adds the first real unlock boundary to the Web vault.

Today `unuvault` already has:

- Supabase-backed sign-up and authenticated vault sync
- Web vault CRUD for login items
- local password envelope helpers in `packages/security`
- legacy plaintext compatibility for older stored password values

What it still lacks is a user-facing unlock model. Passwords are wrapped in an envelope, but there is no separate concept of "the user is authenticated but this vault is still locked."

The goal of this slice is to add the smallest honest unlock boundary:

- keep authentication and unlock as separate concepts
- require a Web-only unlock passphrase before password reveal/copy/edit flows can access plaintext
- keep the unlock passphrase in current page memory only
- leave API, sync, and database contracts unchanged

This is intentionally not the final master-password system. It is the minimum step that makes the Web vault feel like a locked password manager instead of an always-open password list.

## Scope

### In scope

- add a Web-only unlock passphrase flow
- store unlock state in current page memory only
- make password seal/open helpers depend on the active unlock passphrase
- keep title, username, and notes visible while the vault is locked
- block password reveal, copy, and edit access while locked
- keep legacy plaintext password compatibility after unlock
- add tests for locked/unlocked behavior and wrong-passphrase handling

### Out of scope

- full master-password registration flow
- passphrase persistence in `localStorage`, cookies, or server state
- recovery key or account recovery
- browser extension unlock support
- iPhone unlock support
- API changes
- database schema changes
- multi-device key management

## Chosen Approach

The chosen approach is a **separate Web-only unlock passphrase that lives only in page memory**.

That means:

- `Supabase Auth` still answers "who is the user?"
- the new unlock layer answers "is this current browser session unlocked?"
- the unlock passphrase is never persisted locally for this slice
- page refresh returns the Web vault to `locked`

This approach is preferred over reusing the login password because the product needs a clean boundary between identity and local decryption. It is also preferred over persisting unlock state because persistence would force security and lifecycle decisions that are too large for this slice.

## Architecture

### Authentication versus unlock

Authentication remains unchanged:

- the browser signs in through Supabase
- the API authenticates requests through bearer tokens
- vault sync continues to store and return opaque `password_ciphertext` strings

Unlock is a separate local state layer:

- the Web app starts locked after page load
- the user sets or enters an unlock passphrase in the current page
- the passphrase is used only for local seal/open operations

### Unlock state

The Web surface should add a focused unlock state unit that owns:

- whether the current page is `locked` or `unlocked`
- the current in-memory unlock passphrase
- `unlock`, `lock`, and `clearError` style operations

This state must not write to browser persistence.

### Security helpers

`packages/security` should expand from "envelope shape helper" to "passphrase-aware envelope helper."

It should become the only place that knows how to:

- seal a password with an unlock passphrase
- open a sealed password with an unlock passphrase
- reject envelopes opened with the wrong passphrase
- preserve legacy plaintext compatibility through an explicit storage helper

### Web payload helpers

`apps/web/src/components/vault/login-payload.ts` should stop assuming that a stored password can always be opened.

It should expose helpers that:

- determine whether a password exists without revealing it
- open a password only when an unlock passphrase is available
- return masked or unavailable labels when locked
- reseal edited passwords with the active unlock passphrase

### Web panel

`vault-panel.tsx` should gain a small unlock section at the top of the page:

- first use: `Set unlock passphrase`
- locked after refresh: `Unlock vault`
- locked state disables password reveal/copy/edit actions

The rest of the vault remains visible so the page still behaves like a vault, not a blank blocker screen.

## Data Flow

### First unlock flow

1. user authenticates through the existing register/sign-in flow
2. vault items load as they do today
3. page starts in `locked` state
4. user sets or enters an unlock passphrase
5. unlock state stores that passphrase in memory only
6. password actions become available for the rest of that page session

### Create flow

1. user unlocks the page
2. user types a new login password into the create form
3. payload helper seals the password with the active unlock passphrase
4. sync sends the sealed `password_ciphertext` string
5. server stores it unchanged

### Reveal and copy flow

1. user clicks `Show password` or `Copy password`
2. if locked, the action is blocked and plaintext is not produced
3. if unlocked, the payload helper opens the stored value with the in-memory passphrase
4. the UI reveals or copies plaintext locally

### Edit flow

1. user clicks `Edit`
2. if locked, password editing is unavailable
3. if unlocked, the stored password is opened into local form state
4. save reseals the password with the active unlock passphrase

## Error Handling

- Wrong unlock passphrase keeps the page locked and shows a short message such as `Wrong unlock passphrase`
- Invalid or corrupted envelope values fail closed and behave like `No password saved`
- Legacy plaintext values remain readable only after unlock
- A single bad item must not break the rest of the vault page

## Legacy Compatibility

This slice keeps the migration rule introduced in the previous step:

- old plaintext `password_ciphertext` values remain readable after unlock
- saving an item upgrades it to the current sealed envelope format

This preserves continuity while moving the active product boundary toward passphrase-based unlock.

## Testing Strategy

### `packages/security`

- correct passphrase can seal and open a password
- wrong passphrase cannot open the stored password
- invalid envelope values fail safely
- legacy plaintext compatibility still works through the storage helper

### Web

- page starts locked after load
- locked state blocks reveal/copy/password editing
- unlock with the correct passphrase enables reveal/copy/edit
- wrong passphrase shows an error and leaves the page locked
- refresh returns the page to locked state
- legacy plaintext passwords still work after unlock and reseal on save

## Success Criteria

This slice is complete when:

- the Web vault has a distinct `locked` versus `unlocked` state
- unlock passphrases live only in current page memory
- password reveal/copy/edit requires unlock
- password create/update reseals values with the active unlock passphrase
- API and sync contracts stay unchanged
- legacy plaintext compatibility remains intact
