# Extension Auth Bridge Signed-In Contract Design

**Problem:** `unuvault` browser extension already signs in through shared identity and immediately calls `bootstrapProfile`, but the contract is still implicit: the code happens to persist auth state only after bootstrap succeeds, while the repo does not clearly define that `signed_in` means "identity session is usable for product APIs." That leaves room for future drift where popup or background code might treat raw Supabase session success as enough, even if `/auth/bootstrap` has not established a product profile yet.

## Current State

- [`apps/browser-extension/src/background/auth.ts`](../../../apps/browser-extension/src/background/auth.ts) signs in with the extension Supabase client, reads `access_token`, calls `bootstrapProfile`, and only then writes the persisted auth state.
- [`apps/browser-extension/tests/background-auth.spec.ts`](../../../apps/browser-extension/tests/background-auth.spec.ts) proves the happy path, but it does not make the negative contract explicit enough: there is no focused assertion that bootstrap failure must leave storage signed out.
- [`apps/web/src/app/auth/finalize/page.tsx`](../../../apps/web/src/app/auth/finalize/page.tsx) and [`apps/web/src/lib/identity/bootstrap-unuvault-profile.ts`](../../../apps/web/src/lib/identity/bootstrap-unuvault-profile.ts) already treat product bootstrap as the last required step before the Web app considers the identity session usable.
- [`apps/api/src/routes/auth.ts`](../../../apps/api/src/routes/auth.ts) defines `POST /auth/bootstrap` as the product bridge from identity token to `users_profile`.

## Approaches

### Option 1: Leave the runtime behavior alone and only document it

- Add comments or docs explaining that bootstrap is required before the extension is truly signed in.

Trade-off:

- Lowest effort, but the contract would still rely on readers noticing comments.
- A future refactor could accidentally persist state too early without tests catching the regression.

### Option 2: Broaden the slice into popup/background state-machine cleanup

- Rework popup auth wording, popup hydration, and background auth as one larger auth-surface pass.

Trade-off:

- More complete, but it expands from a contract hardening slice into user-facing state management.
- It would touch more files than necessary before we have nailed down the one invariant that matters most.

### Option 3: Make the background auth contract explicit and guard it with focused tests (Recommended)

- Keep the production flow the same.
- Tighten the background runtime so `signed_in` is explicitly defined as "bootstrap succeeded and persisted state exists."
- Add failing tests for the bootstrap-failure path and for the persisted-state invariant.

Why this is recommended:

- It formalizes the existing intended behavior without dragging in popup/UI churn.
- It matches the already-established Web and API contract: product usability starts after `/auth/bootstrap`, not after raw identity session creation.
- It gives the repo a stable invariant to protect before any later extension UX cleanup.

## Chosen Design

Use option 3 and treat extension `signed_in` as a bootstrapped product-auth state, not just an identity session.

### Contract

The background auth runtime should expose one clear meaning:

- `signed_out`: there is no persisted bootstrapped auth state
- `signed_in`: the extension has an access token, a bootstrapped product profile id, and a persisted auth state written only after `/auth/bootstrap` succeeds

That means the following are **not** sufficient to enter `signed_in`:

- Supabase password sign-in succeeding on its own
- a returned user email without an access token
- a partially completed sign-in where `bootstrapProfile` fails

### Background runtime responsibilities

[`apps/browser-extension/src/background/auth.ts`](../../../apps/browser-extension/src/background/auth.ts) should stay the single source of truth for this contract.

Responsibilities after this slice:

- authenticate through the extension Supabase client
- require a usable access token
- require `bootstrapProfile` to succeed
- build the persisted auth payload only after bootstrap succeeds
- write storage only after the payload is complete
- return `signed_in` only from that persisted, bootstrapped payload

The runtime should fail closed. If any step before persistence fails, the extension remains signed out.

### Storage semantics

[`apps/browser-extension/src/background/auth-storage.ts`](../../../apps/browser-extension/src/background/auth-storage.ts) already persists a minimal auth state. This slice keeps the storage shape unchanged, but tightens its meaning:

- persisted auth state is a bootstrapped contract
- absence of persisted auth state means signed out
- malformed persisted auth state continues to mean signed out

No new storage keys or migration logic are needed.

### Web/API alignment

This slice does not change API routes or web finalize behavior. Instead, it aligns the extension wording and tests with the same boundary already used elsewhere:

- shared identity authority authenticates the person
- `/auth/bootstrap` establishes product identity inside `unuvault`
- only then should a client surface consider itself signed in for product work

### Error handling

The runtime should continue to surface errors rather than coercing them into a partial state.

Required outcomes:

- Supabase auth error -> throw and remain signed out
- missing access token -> throw and remain signed out
- `bootstrapProfile` error -> throw and remain signed out
- sign-out -> clear storage and read back as signed out

This slice should not introduce background-side retries, token refresh, or popup copy changes.

## Testing Strategy

Add focused background auth tests for:

- bootstrap failure does not persist auth state
- missing access token does not persist auth state
- successful sign-in still bootstraps, persists, and reads back as `signed_in`
- existing persisted auth state still reads back as `signed_in`

Then re-run the extension-level focused test file and the existing repo verification entrypoint that already covers browser-extension tests.

## Out Of Scope

- popup auth copy or popup state-machine changes
- `/auth/finalize` refactors in the Web app
- API contract changes to `/auth/bootstrap`
- token refresh or session-expiry handling
- iOS auth behavior

## Acceptance Criteria

- the repo explicitly documents that extension `signed_in` means bootstrap succeeded
- background auth tests fail if bootstrap errors while storage is written anyway
- successful sign-in behavior remains unchanged from the user perspective
- no Web or API files need to change for this slice
