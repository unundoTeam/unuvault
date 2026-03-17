# Extension Unlock Session And Autofill Read Path Design

## Summary

The browser extension now has:

- background-owned auth state
- background-owned vault cache hydration
- popup search over real cached vault items

What it still lacks is a shared unlock boundary. The popup currently keeps the master-password unlock passphrase in popup-local memory inside `use-popup-unlock.ts`, which means:

- closing the popup drops unlock state immediately
- content scripts cannot observe or reuse unlock state
- the autofill surface cannot progress beyond a placeholder

The goal of this slice is to move the extension unlock truth into the background runtime and create the smallest safe autofill-oriented read path on top of that shared state.

This slice intentionally does **not** implement true site matching or real DOM autofill. The current `VaultLoginPayload` schema only contains `username`, `password_ciphertext`, and `notes`; it does not contain stable `url`, `origin`, or `domain` metadata. Without that metadata, any real site-matching strategy would be heuristic and too error-prone to treat as a proper autofill boundary.

## Scope

### In scope

- add a background-owned unlock session that keeps the current passphrase in memory only
- reuse the existing master-password verifier storage for setup and passphrase verification
- expose background actions for reading unlock state, unlocking, and locking
- update popup unlock flow to use the background runtime as the unlock source of truth
- preserve popup-local verifier setup UX (`needs_setup`, `locked`, `unlocked`) while moving session ownership to background
- add a background-only unlocked vault reader that can open cached login items with the active unlock session
- add a narrow autofill status action that content code can query safely
- upgrade `apps/browser-extension/src/content/autofill.ts` from placeholder logic to background-backed readiness logic
- add focused tests for background unlock runtime, popup unlock integration, unlocked vault reading, and content autofill readiness

### Out of scope

- adding `url`, `domain`, `origin`, or other site metadata to vault items
- real site matching
- returning the full decrypted vault list to content scripts
- real DOM autofill into username/password fields
- unlock session expiration timers
- background persistence of the plaintext unlock passphrase
- production-hardening of the current verifier or envelope cryptography

## Chosen Approach

The chosen approach is **background-owned unlock session plus a narrow autofill readiness path**.

That means:

- popup still owns the human-facing unlock form
- background owns whether the extension is currently unlocked
- background keeps the active passphrase in memory only
- background can read and decrypt cached login items when auth and unlock state both allow it
- content scripts only receive coarse autofill readiness in this slice, not arbitrary decrypted vault contents

This approach is preferred over keeping unlock popup-local because popup-local state cannot serve content scripts. It is preferred over exposing all unlocked vault items to content scripts because that would widen the data boundary before the extension has reliable site metadata to narrow the request. It is also preferred over adding site metadata in this same slice because that would expand the scope from unlock-sharing into data-model and web/editor changes.

## Architecture

### Background unlock runtime

Add a background unlock unit as the source of truth for extension unlock state.

Responsibilities:

- read the stored master-password verifier
- report unlock mode as `needs_setup`, `locked`, or `unlocked`
- create and persist the verifier on first setup
- verify an entered passphrase against the stored verifier
- hold the active passphrase in memory only while unlocked
- clear the in-memory session on explicit lock

The background unlock runtime should not persist plaintext passphrases and should not depend on popup UI details.

### Popup unlock bridge

Keep `use-popup-unlock.ts` as the popup-side state manager for draft input and error messages, but move its authoritative unlock transitions into the background runtime.

Responsibilities:

- read background unlock state on popup mount
- keep draft fields and error messages local to the popup
- validate confirm-password equality during setup
- call background unlock and lock actions
- derive popup mode from background state instead of popup-local passphrase memory

The popup should stop treating `unlockPassphrase` as the authoritative session.

### Background unlocked vault reader

Add a background-only reader for cached login items that can open stored password ciphertext when the extension is both signed in and unlocked.

Responsibilities:

- read hydrated popup vault cache from extension storage
- normalize cached payloads
- decrypt passwords with the active in-memory passphrase
- return simplified unlocked login records for background consumers
- fail closed when signed out, locked, or given malformed cache data

This unit is intentionally background-only in this slice. It exists so future site matching and real autofill can build on a single unlock-gated reader rather than re-implementing decryption in content code.

### Autofill readiness adapter

Upgrade `apps/browser-extension/src/content/autofill.ts` so it can answer more than “there is a password field”.

Responsibilities:

- keep the existing local password-field check
- ask background whether autofill is currently unavailable, locked, empty, or ready
- return a small readiness result the future DOM-fill slice can build on

This adapter should not decrypt vault data and should not mutate page DOM yet.

## Components

### Background protocol additions

Extend `apps/browser-extension/src/background/protocol.ts` with unlock and autofill request/response types.

Recommended request shapes:

- `read_extension_unlock_state`
- `unlock_extension_vault`
- `lock_extension_vault`
- `read_autofill_status`

Recommended response shapes:

- `unlockState` with `mode: "needs_setup" | "locked" | "unlocked"`
- `autofillStatus` with `status: "signed_out" | "locked" | "empty" | "ready"`

The protocol should stay narrow and typed. Avoid a generic “return everything” response.

### Background unlock session module

Add a module such as `apps/browser-extension/src/background/unlock-session.ts`.

It should expose a factory like:

- `createExtensionUnlockRuntime()`

And operations like:

- `readUnlockState()`
- `unlockWithPassphrase(passphrase: string)`
- `lock()`

This module can pragmatically reuse the existing verifier storage helper even though that helper currently lives under `src/popup`. A broader storage-location cleanup is out of scope for this slice.

### Background unlocked vault reader module

Add a module such as `apps/browser-extension/src/background/unlocked-vault.ts`.

It should:

- read cached vault items from `popup-vault-storage.ts`
- normalize login payloads with `login-payload.ts`
- decrypt passwords with `openStoredVaultPassword`
- return a simplified shape such as:

```ts
type UnlockedVaultLoginItem = {
  id: string;
  title: string;
  username: string;
  password: string;
  hasPassword: boolean;
};
```

This should be a background-facing helper, not a content-facing API in this slice.

### Popup background client additions

Extend `apps/browser-extension/src/popup/background-client.ts` with typed helpers for:

- reading unlock state
- unlocking
- locking
- reading autofill status if popup tests or future UI need it

These helpers should continue to use `chrome.runtime.sendMessage` when available and fall back to direct runtime invocation in tests.

## Data Flow

### First popup open with no verifier

1. popup mounts
2. popup reads background unlock state
3. background reads verifier storage and finds no verifier
4. background returns `needs_setup`
5. popup shows setup UI
6. user enters and confirms a master password
7. popup calls background unlock action
8. background writes the verifier and stores the passphrase in memory
9. popup transitions to `unlocked`

### Returning popup open with stored verifier but no active session

1. popup mounts
2. popup reads background unlock state
3. background finds a stored verifier but no active session
4. background returns `locked`
5. popup shows the existing unlock form
6. user submits the passphrase
7. background verifies it and stores the passphrase in memory
8. popup transitions to `unlocked`

### Popup reopen while background session is still active

1. popup mounts
2. popup reads background unlock state
3. background sees an active in-memory session
4. background returns `unlocked`
5. popup restores unlocked UI without re-entering the passphrase

### Explicit lock

1. user clicks `Lock vault`
2. popup calls background lock action
3. background clears the in-memory passphrase
4. popup clears local draft/error UI state
5. popup returns to `locked` or `needs_setup` based on verifier presence

### Autofill readiness query

1. content code detects a password field locally
2. content code requests autofill status from background
3. background checks auth state
4. background checks unlock state
5. if signed in and unlocked, background reads unlocked cached login items
6. background returns:
   - `signed_out` when no auth state exists
   - `locked` when auth exists but no unlock session exists
   - `empty` when unlock succeeds but no readable login items are available
   - `ready` when at least one readable login item exists

The content layer receives only the coarse status, not the underlying decrypted item list.

## Error Handling And Security Boundaries

### Fail closed

All new background readers should fail closed:

- malformed verifier storage behaves like no verifier
- malformed cache behaves like empty cache
- missing auth state behaves like signed out
- missing unlock session behaves like locked
- failed decrypts produce empty passwords rather than partial data

### Passphrase lifetime

The active passphrase should live only in background memory:

- never written to `chrome.storage.local`
- naturally cleared on extension/background restart
- cleared immediately on explicit lock

This is still MVP security, not production-hardening, but it is materially better than persisting plaintext session material.

### Content-script exposure

Do not return the full decrypted vault list to content scripts in this slice. Without site metadata, content code has no principled way to request only the credential relevant to the current page. Returning the whole unlocked list would create an unnecessarily wide data boundary.

Instead:

- keep the unlocked vault reader in background
- expose only coarse autofill readiness to content for now
- add real site-specific credential access only after vault items gain explicit site metadata

## Testing Strategy

### Background unlock runtime tests

Add focused tests that prove:

- initial state is `needs_setup` when no verifier exists
- first unlock writes a verifier and returns `unlocked`
- existing verifier + wrong passphrase stays `locked`
- existing verifier + correct passphrase returns `unlocked`
- `lock()` clears the in-memory session
- a new runtime instance starts locked again, proving the session is not persisted

### Popup integration tests

Extend popup tests to prove:

- popup setup mode comes from background unlock state
- setup success calls background unlock and shows unlocked UI
- locked mode unlocks through background
- explicit lock clears unlocked UI and returns to locked state
- popup remount restores unlocked UI when the background session still exists

### Background unlocked vault reader tests

Add tests that prove:

- signed-out auth returns no readable items
- signed-in but locked returns no readable items
- signed-in and unlocked returns simplified login records
- passphrase-protected ciphertext opens only with the active session passphrase
- malformed cache fails closed

### Content autofill tests

Extend `apps/browser-extension/tests/autofill.spec.ts` to prove:

- local password-field detection still works
- background-backed readiness returns `signed_out`, `locked`, `empty`, and `ready` as expected
- background errors surface as unavailable/false rather than leaking partial state

## Result

At the end of this slice, the extension will have a shared unlock boundary owned by background and a safe autofill-oriented readiness path that content code can consume. The extension still will not perform real site matching or DOM fill, but the hardest boundary change — turning popup-local unlock into extension-level unlock state — will be complete and reusable for the next autofill slice.
