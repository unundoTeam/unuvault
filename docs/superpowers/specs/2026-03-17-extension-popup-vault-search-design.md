# Extension Popup Vault Search Design

## Summary

The browser extension popup now has a real local master password boundary:

- first-run setup via a locally stored verifier
- explicit `needs_setup`, `locked`, and `unlocked` states
- an in-memory unlock passphrase that disappears when the popup closes

What it still does not have is a real vault experience after unlock. The popup shows only a placeholder search field, even though the Web vault already has real vault item types, payload parsing, password envelope helpers, and list interaction patterns.

The goal of this slice is to turn the extension popup into a real read-only vault search surface without expanding scope into extension auth, background sync, autofill, or editing. The popup should read a local extension vault cache, let the user search through real items, and let the user reveal or copy saved credentials after unlock.

This slice intentionally delivers **local cache search now, replaceable data source structure for later**. That keeps the feature aligned with the current maturity of the codebase while avoiding a dead-end popup architecture.

## Scope

### In scope

- add a popup vault cache storage helper backed by `chrome.storage.local`
- load real `VaultSyncItem` records into the popup from extension-local cache
- keep popup unlock state as the only source of truth for vault reveal and copy actions
- add search across `title`, `username`, and `notes`
- sort results by `updated_at` descending
- reuse existing vault payload and envelope parsing behavior for masked, revealed, and copied passwords
- show distinct empty states for an empty vault and for a search with no matches
- fail closed when popup cache values are malformed or storage access fails
- cover the new behavior with focused extension tests

### Out of scope

- Supabase sign-in inside the extension
- background-driven vault sync
- popup-to-background messaging for auth or vault lookup
- popup create, edit, or delete flows
- autofill integration
- shared verifier setup state between Web and extension
- production-grade cryptography changes

## Chosen Approach

The chosen approach is **a popup-local vault cache reader with a replaceable data-source boundary**.

That means:

- the popup reads real vault items from extension-local storage today
- the popup UI depends on a focused hook rather than on browser storage APIs directly
- the popup reuses the existing shared vault item and password helper model instead of inventing new popup-specific shapes
- a future background sync slice can refresh the same local cache without forcing a popup UI rewrite

This approach is preferred over directly wiring extension auth and remote sync in the same slice because the current extension does not yet have a real authenticated background state. Doing all of that together would turn a simple product milestone into a much riskier multi-system change. It is also preferred over hard-coding storage reads inside `App.tsx` because that would make the popup harder to evolve when real sync arrives.

## Architecture

### Popup vault source

Add a focused popup storage module responsible for reading the local vault cache from `chrome.storage.local`.

Responsibilities:

- read the current cached vault list
- hide browser storage API details from React components
- fail closed on malformed values
- expose a narrow interface that can later be backed by a different source

This module should not know anything about unlock state, clipboard behavior, or filtering logic.

### Popup vault search model

Add a popup-specific hook that owns vault list loading and local filtering.

Responsibilities:

- load cached items on popup mount
- normalize failure into popup-safe `loading`, `error`, and `empty` states
- sort loaded items by `updated_at` descending
- filter items by the current search query
- derive per-item password display values only when the popup is unlocked
- reset reveal and copy state when the popup locks

This hook should accept unlock inputs from `usePopupUnlock` rather than duplicating any security state.

### Popup presentation

Keep `App.tsx` as a composition layer.

Responsibilities:

- render setup and locked states exactly as they work today
- render the search UI and vault result list only when unlocked
- bind the search field to popup vault search state
- surface empty and error messages from the popup vault hook

The presentation layer should not parse payloads, read browser storage directly, or own unlock decisions.

## Components

### Popup vault storage helper

Add a module such as `apps/browser-extension/src/popup/popup-vault-storage.ts`.

It should:

- read one extension-local vault cache key
- validate that the stored value is an array of vault-like objects
- return an empty list when data is missing
- throw or surface a controlled error on storage failures so the popup can show an error state

### Popup vault helpers

The popup needs the same payload parsing behavior the Web vault already uses:

- normalize login payload shape
- detect whether a password exists
- read stored passwords through legacy and envelope-compatible paths
- derive masked versus revealed password labels

This slice should prefer minimum-scope reuse. If the cleanest move is to add a popup-local helper parallel to the Web helper, that is acceptable. A larger shared helper extraction should wait until at least two surfaces are clearly pulling on the same abstraction.

### Popup vault search hook

Add a hook such as `apps/browser-extension/src/popup/use-popup-vault-search.ts`.

It should own:

- loaded vault items
- loading and error state
- current search query
- copied username feedback
- copied password feedback
- revealed item IDs

It should expose a filtered result list that the popup can render directly.

## Data Flow

### Popup mount

1. popup mounts
2. popup unlock hook reads verifier state
3. popup vault hook reads the local vault cache
4. vault items load into memory even if the popup is still locked
5. the locked popup does not reveal or copy any secret values

### Unlock and search

1. user sets or enters the master password
2. `usePopupUnlock` enters `unlocked` and exposes the in-memory passphrase
3. popup vault hook uses that passphrase for reveal and copy actions
4. an empty search field shows the full sorted list
5. a non-empty search field filters by `title`, `username`, and `notes`

### Password reveal and copy

1. popup renders password rows using the same placeholder language as the Web vault
2. if an item has no password, the popup shows `No password saved`
3. if an item has a password, the popup shows `••••••••` by default
4. once unlocked, the user may reveal or copy the password
5. copy does not require reveal first
6. copied state stays scoped to the targeted item

### Lock and remount

1. user clicks `Lock vault`, or the popup closes
2. in-memory unlock passphrase disappears
3. reveal state disappears
4. copied-state feedback disappears
5. password rows return to their masked or empty placeholders

## UI Behavior

### Locked and setup states

The current popup setup and locked form behavior remains unchanged:

- `needs_setup` shows `Master password`, `Confirm master password`, and `Set master password`
- `locked` shows `Master password` and `Unlock vault`

These states do not render the vault list.

### Unlocked state

The unlocked popup should render:

- `Lock vault`
- `Search vault`
- a filtered vault result list

Search behavior:

- empty query shows all items
- search is case-insensitive
- search matches `title`, `username`, and `notes`
- search keeps the base result ordering

Per-item behavior:

- show `title`
- show `username` only when present
- show `Notes added` only when notes exist
- show `Copy username <title>` only when a username exists
- show `Copy password <title>` only when a password exists
- show `Show password <title>` / `Hide password <title>` only when a password exists

### Empty and error states

The popup should distinguish:

- `No vault items yet.` when the cache is empty
- `No vault items match your search.` when the cache has items but the filter returns none
- a controlled read error message when the vault cache cannot be loaded

Vault cache errors should not break setup, unlock, or lock behavior.

## Error Handling

- malformed cache data -> treat as an empty vault
- storage read failure -> show popup vault error message
- malformed payload values inside an item -> normalize fields to empty strings
- malformed or wrong passphrase-protected password -> fail closed to empty revealed value
- locked popup copy or reveal attempt -> no-op
- lock action -> clear all transient reveal and copied state

The popup should favor fail-closed behavior over partial secret exposure.

## Testing Strategy

### Popup vault storage tests

- read a valid cached vault list from extension-local storage
- return an empty list when the cache key is missing
- return an empty list for malformed stored values
- fail safely when the extension storage API is unavailable

### Popup UI and state tests

- unlocked popup renders cached real vault items
- search filters by title
- search filters by username
- search filters by notes
- empty cache shows `No vault items yet.`
- unmatched query shows `No vault items match your search.`
- items with a password show the masked placeholder and reveal action
- copy password works after unlock without requiring reveal first
- locking or remounting clears revealed password state
- malformed cache values do not crash the popup

## Success Criteria

This slice is complete when:

- the extension popup reads real vault items from a local cache instead of showing a placeholder shell
- unlocked users can search cached items by title, username, and notes
- the popup reuses existing password parsing and fail-closed behavior
- password reveal and copy are available only after unlock
- lock and remount clear all transient secret-derived UI state
- the popup data source is isolated behind a small storage boundary that can later be replaced by background sync
