# Extension Popup Unlock Boundary Design

## Summary

`unuvault` now has a real Web-side master password setup and unlock boundary:

- a browser-local master password verifier
- explicit `needs_setup`, `locked`, and `unlocked` states
- password actions gated behind an in-memory unlock passphrase
- shared envelope and verifier helpers in `packages/security`

The browser extension does not yet participate in that model. The popup is still a placeholder search field, and the extension has no equivalent first-run master password setup or locked state.

The goal of this slice is to make the extension popup the second real surface that understands the `unuvault` master password boundary, without expanding scope into autofill, sync, or background messaging.

This slice is intentionally popup-only. It should establish the same mental model as the Web vault:

- first run requires setting a master password
- reopening the popup returns to `locked`
- the actual unlock passphrase lives only in current popup memory
- shared verifier logic stays in `packages/security`

## Scope

### In scope

- add popup states for `needs_setup`, `locked`, and `unlocked`
- reuse the shared verifier helper in `packages/security`
- add an extension storage adapter for the popup verifier
- persist only verifier metadata, never the actual master password
- make popup close and reopen return to `locked`
- replace the placeholder popup with a minimal unlocked shell
- add tests for setup, unlock, remount, and storage fail-closed behavior

### Out of scope

- autofill unlock propagation
- content-script or background-script messaging
- real vault search or sync inside the popup
- sharing verifier storage between Web and extension
- Supabase sign-in integration for the extension
- popup session persistence across closes
- multi-context unlock state propagation

## Chosen Approach

The chosen approach is **popup-only unlock setup with shared verifier logic and extension-local storage**.

That means:

- the popup reuses `createMasterPasswordVerifier` and `verifyMasterPassword`
- the extension adds a small storage adapter around `chrome.storage.local`
- the popup keeps the current unlock passphrase only in React state
- the popup returns to `locked` every time it remounts, even though the verifier remains stored

This approach is preferred over a popup+autofill slice because it keeps the feature small and testable. It is preferred over a popup-specific temporary unlock model because it preserves the same product boundary already established on the Web.

## Architecture

### Popup state model

The popup should have the same three states as the Web vault:

1. `needs_setup`
   No popup verifier has been stored yet.
2. `locked`
   A verifier exists, but the popup session has not unlocked yet.
3. `unlocked`
   The popup session has validated the master password and may render its unlocked shell.

State transitions:

- first popup open with no verifier -> `needs_setup`
- successful setup -> `unlocked`
- popup remount with verifier present -> `locked`
- successful unlock -> `unlocked`
- explicit lock -> `locked`
- popup close -> discard in-memory unlock passphrase

### Shared security boundary

The shared security boundary stays exactly where it already lives:

- `packages/security/src/master-password-verifier.ts`
- `packages/security/src/vault-envelope.ts`

This slice must reuse the verifier helper instead of duplicating any hashing or verifier-shape logic in the extension.

### Extension storage boundary

The extension should add a dedicated storage helper, parallel to the Web helper but with extension-specific persistence.

Responsibilities:

- `readMasterPasswordVerifier`
- `writeMasterPasswordVerifier`
- `clearMasterPasswordVerifier`

The storage helper should:

- use extension-local persistence
- fail closed on malformed or missing values
- hide browser API details from popup state logic

## Components

### Popup storage helper

Add a focused extension storage module for verifier persistence. It should expose the same shape as the Web storage helper, but target extension-local storage instead of `localStorage`.

### Popup unlock state

The popup should add a dedicated unlock state unit that owns:

- current popup mode
- draft master password
- draft confirmation password
- current in-memory unlock passphrase
- local setup and unlock errors
- integration with the extension storage helper

This unit should stay popup-focused and not pull in autofill or background concerns.

### Popup UI

The popup `App` should render:

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
  - `Search vault`
  - `Vault search will connect in the next slice`

The unlocked view is intentionally a shell, not a real vault browser.

## Data Flow

### First-time setup

1. popup mounts
2. popup reads verifier from extension-local storage
3. no verifier is found, so popup enters `needs_setup`
4. user enters and confirms a master password
5. popup creates a verifier via shared helper
6. popup persists the verifier in extension-local storage
7. popup keeps the passphrase in current memory and enters `unlocked`

### Returning unlock

1. popup mounts again after close or remount
2. popup reads existing verifier from extension-local storage
3. popup enters `locked`
4. user enters master password
5. popup validates against shared verifier helper
6. on success, popup enters `unlocked`

### Locking

1. user clicks `Lock vault`
2. popup clears the in-memory unlock passphrase and draft fields
3. popup returns to `locked`
4. stored verifier remains available for future opens

## Error Handling

- empty setup password -> `Master password is required`
- setup mismatch -> `Passwords do not match`
- empty unlock password -> `Master password is required`
- wrong unlock password -> `Wrong master password`
- malformed stored verifier -> treat as `needs_setup`
- storage read failures -> fail closed to `needs_setup`

Errors must remain local to popup state and should not crash rendering.

## Testing Strategy

### Popup storage tests

- round-trip stored verifier data
- return `null` for missing verifier
- return `null` for malformed storage values
- clear stored verifier correctly

### Popup UI tests

- first render without verifier shows setup mode
- setup success immediately enters unlocked mode
- stored verifier shows locked mode on render
- wrong master password does not unlock
- popup remount returns to locked mode
- unlocked popup shows the placeholder search shell

## Success Criteria

This slice is complete when:

- the extension popup has `needs_setup`, `locked`, and `unlocked` states
- the popup uses shared verifier logic from `packages/security`
- the popup persists only verifier metadata
- reopening the popup requires unlock again
- unlocked popup shows a minimal post-unlock shell
- no autofill, messaging, or sync scope is added in this slice
