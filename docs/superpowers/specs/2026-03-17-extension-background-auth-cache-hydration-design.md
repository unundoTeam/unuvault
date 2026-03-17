# Extension Background Auth And Cache Hydration Design

## Summary

The browser extension popup already has a local master-password boundary:

- popup-local verifier storage
- `needs_setup`, `locked`, and `unlocked` states
- an in-memory unlock passphrase that disappears when the popup closes

What it still lacks is a real authenticated runtime and a real vault data source. The popup cannot sign in, `apps/browser-extension/src/background/auth.ts` is still a placeholder, and no extension context hydrates the popup's local vault cache from the API.

The goal of this slice is to create the smallest real extension-side data loop:

- the extension can sign in with an existing account
- the background runtime can hold the authenticated session state
- the background runtime can call `POST /vault/sync`
- the background runtime writes `updated_items` into extension-local cache
- the popup reads that cache instead of pretending search is a future slice

This slice intentionally delivers a minimal authenticated runtime, not a full extension account system. It should make the extension independently usable as a read-only vault surface without pulling in sign-up, autofill, polling sync, or cross-context unlock sharing.

## Scope

### In scope

- add an extension-specific Supabase runtime for background auth
- add a background auth state/storage boundary for the extension
- support minimal email/password sign-in in the extension
- call `bootstrapProfile` after successful sign-in
- add a background vault hydration function that calls `syncVault` with the authenticated token
- persist hydrated `updated_items` into extension-local popup vault cache
- expose background actions the popup can use for sign-in, auth-state reads, and manual hydration
- show a minimal popup auth form when the extension is signed out
- refresh the vault cache when the popup opens with an existing signed-in session
- keep the popup as a read-only cache consumer after auth succeeds
- add focused tests for auth runtime, cache hydration, and popup auth transitions

### Out of scope

- extension sign-up or register flow
- automatic token refresh
- background polling or periodic sync
- autofill integration
- content-script vault access
- editing, creating, or deleting vault items from the popup
- cross-surface shared master-password setup state
- production-hardening of cryptography or session persistence

## Chosen Approach

The chosen approach is **minimal extension sign-in plus background-owned vault cache hydration**.

That means:

- the extension signs in directly with Supabase rather than depending on a session from the Web app
- the background runtime owns auth state and vault hydration
- the popup asks the background runtime for auth actions and cache refreshes
- the popup continues to read a local cache rather than making API calls directly

This approach is preferred over background-only plumbing with no extension sign-in because that would not produce a real end-to-end workflow on the current codebase. It is preferred over a web-to-extension session bridge because that would introduce cross-context token handoff and messaging complexity before the extension even has a minimal first-party auth surface.

## Architecture

### Background auth runtime

Add a background auth unit as the source of truth for the extension's authenticated session.

Responsibilities:

- create an extension-runtime Supabase client
- sign in with email/password
- call `bootstrapProfile` after auth success
- persist a minimal extension auth state
- return the current signed-in/signed-out state to popup callers
- clear persisted auth state on sign-out

This unit should not know about popup unlock or popup search rendering.

### Background vault hydration

Add a background vault hydration unit that uses the current access token to fetch the caller's vault list and persist it into extension-local cache.

Responsibilities:

- call `syncVault` with `changed_items: []` and `deleted_item_ids: []`
- write `updated_items` into the popup vault cache storage key
- surface hydration success or failure to callers
- remain reusable for later manual refresh, startup restore, or autofill hydration

This unit should not manage auth forms or popup UI state.

### Popup auth surface

The popup should gain a minimal auth state layer separate from unlock.

Responsibilities:

- read extension auth state on popup mount
- show a sign-in form when signed out
- call background sign-in
- request a background hydrate when signed in
- continue to hand unlock to `usePopupUnlock`
- continue to hand cache search to the popup vault search layer

The popup should not hold bearer tokens or call Supabase directly.

### Storage boundaries

Keep extension-local storage split by concern:

- `auth-storage` for persisted extension auth state
- `popup-vault-storage` for hydrated vault items
- `master-password-storage` for popup unlock verifier

This separation keeps auth, sync cache, and unlock state from collapsing into one opaque storage shape.

## Components

### Extension Supabase client

Add an extension runtime helper such as `apps/browser-extension/src/background/extension-supabase.ts`.

It should:

- create a Supabase client with the same public URL and anon key inputs used by the Web app
- avoid importing Next.js-specific Web helpers
- remain background-runtime-specific

### Background auth storage

Add a focused auth storage helper such as `apps/browser-extension/src/background/auth-storage.ts`.

It should persist only the minimum state required for hydration and popup auth UI:

- `access_token`
- session metadata needed by the background runtime
- stable user/profile metadata needed for the popup to know it is signed in

It should fail closed and treat malformed values as signed out.

### Background auth actions

Expand `apps/browser-extension/src/background/auth.ts` from a placeholder into a small runtime API.

It should expose actions equivalent to:

- `readExtensionAuthState`
- `signInWithPassword`
- `signOut`

Successful sign-in should:

1. authenticate through Supabase
2. obtain an access token
3. call `bootstrapProfile`
4. persist the resulting auth state

### Background vault cache hydrator

Add a unit such as `apps/browser-extension/src/background/vault-cache.ts`.

It should expose a function like:

- `hydratePopupVaultCache`

That function should:

1. read the current extension auth state
2. exit early if signed out
3. call `syncVault`
4. persist `updated_items` into popup vault cache storage

### Popup auth hook

Add a popup-focused auth hook such as `apps/browser-extension/src/popup/use-popup-auth.ts`.

It should own:

- popup auth status (`signed_out`, `signing_in`, `signed_in`, `error`)
- email/password drafts
- auth error message
- initial auth bootstrap on popup mount
- manual sign-in submission
- background hydrate trigger when session exists

This hook should not own unlock or search state.

## Data Flow

### First popup open while signed out

1. popup mounts
2. popup reads extension auth state through the background runtime
3. no valid auth state is found
4. popup renders the sign-in form
5. popup does not render unlock or vault search UI

### Sign-in success

1. user submits email/password from popup
2. popup calls the background sign-in action
3. background uses the extension Supabase client to sign in
4. background calls `bootstrapProfile`
5. background persists signed-in auth state
6. background immediately calls `hydratePopupVaultCache`
7. vault items are written into popup vault cache
8. popup transitions from auth form to unlock form

### Returning popup open with existing session

1. popup mounts
2. popup reads persisted extension auth state
3. popup sees a signed-in state
4. popup requests one background hydration
5. popup continues through unlock flow and, once unlocked, reads the refreshed cache

### Sign-out

1. user signs out from the popup auth surface
2. background clears persisted auth state
3. background clears hydrated popup vault cache
4. popup returns to signed-out auth form
5. popup unlock state remains a separate local concern

## UI Behavior

### Signed-out popup

The popup should render:

- `Email`
- `Password`
- `Sign in`

This is a minimal auth surface. It should not include register, forgot-password, or device-management actions in this slice.

### Signed-in but locked popup

Once auth succeeds, the popup should render the existing master-password form:

- `needs_setup`
- `locked`
- `unlocked`

Auth success should not imply vault unlock.

### Signed-in and unlocked popup

Once both auth and unlock succeed:

- the popup reads hydrated vault cache
- the popup shows search results from that cache
- popup vault list errors are shown separately from auth errors

### Error surfaces

Keep auth and vault hydration errors separate:

- auth failure: sign-in error near the auth form
- hydration failure: vault-sync/cache error near the vault surface

Hydration failure should not silently downgrade the popup to signed out.

## Error Handling

- malformed auth storage -> signed-out state
- missing or malformed popup cache -> empty vault list
- sign-in failure -> signed-out with auth error message
- missing access token after sign-in -> auth failure
- `bootstrapProfile` failure -> auth failure and no persisted signed-in state
- hydration failure -> preserve signed-in state, surface vault error, do not crash popup
- signed-out hydration request -> no-op or controlled failure

The extension should fail closed. Invalid persisted auth state must never be treated as authenticated.

## Testing Strategy

### Background auth tests

- sign-in with password persists extension auth state
- sign-in calls `bootstrapProfile` with bearer auth
- malformed auth storage reads as signed out
- sign-out clears persisted auth state

### Background vault hydration tests

- hydration reads the current access token and calls `syncVault`
- hydration writes `updated_items` into popup cache
- hydration fails cleanly when signed out
- hydration leaves auth state intact when sync fails

### Popup tests

- signed-out popup shows auth form
- successful sign-in transitions to unlock flow
- popup with existing signed-in state triggers background hydration on mount
- hydration failure shows a vault error without removing signed-in state
- signed-out popup does not show unlock UI

## Success Criteria

This slice is complete when:

- the extension can sign in with an existing account from the popup
- the background runtime persists a minimal signed-in state
- the background runtime can hydrate popup vault cache from `/vault/sync`
- popup startup can reuse persisted auth state and refresh the cache
- popup auth, popup unlock, and popup vault search remain separated concerns
- the popup no longer depends on a placeholder future sync path to access real data
