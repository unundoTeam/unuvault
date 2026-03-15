# Vault Sync Auth Context Design

**Problem:** `unuvault` now has a real Supabase-backed auth bootstrap flow, but `POST /vault/sync` still behaves like an anonymous placeholder route. Before sync can return real vault data, the API needs a minimal authenticated user context so sync semantics stop pretending the caller is unauthenticated or global.

## Current State

- [`apps/api/src/routes/vault-sync.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-auth-context/apps/api/src/routes/vault-sync.ts) accepts any request and immediately returns `buildVaultSyncPayload()`.
- [`apps/api/src/services/vault-service.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-auth-context/apps/api/src/services/vault-service.ts) always returns an empty sync payload and does not know who the caller is.
- [`packages/api-client/src/vault.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-auth-context/packages/api-client/src/vault.ts) posts `changed_items` without bearer authentication.
- [`apps/api/src/lib/supabase.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-auth-context/apps/api/src/lib/supabase.ts) already knows how to resolve a Supabase user from a token and bootstrap `users_profile`.
- [`infra/supabase/migrations/0001_phase1_core.sql`](/Users/yuchen/Desktop/blackbox/.worktrees/vault-sync-auth-context/infra/supabase/migrations/0001_phase1_core.sql) already defines both `users_profile` and `vault_items`, but sync does not use either table yet.

## Approaches

### Option 1: Require bearer auth and return a user-scoped empty sync payload (Recommended)

- Add bearer auth to the shared vault client
- Make `POST /vault/sync` reject missing or invalid tokens
- Resolve the caller's `users_profile`
- Keep the payload shape unchanged, but build it only after authenticated context exists

Trade-off:
- This does not return real vault items yet, but it creates the smallest trustworthy contract for later sync work

### Option 2: Add authenticated context and read `vault_items` immediately

- Do everything in option 1
- Also fetch and return the authenticated user's current vault items

Trade-off:
- More product-visible progress, but it pulls item projection, encrypted payload shaping, and sync conflict semantics into the same slice

### Option 3: Keep sync anonymous and add user context later

- Leave the current route as-is
- Defer auth enforcement until the first real vault read/write story

Trade-off:
- Fastest in the moment, but it keeps `vault/sync` dishonest about who owns the returned data and delays a boundary we already know the product needs

## Chosen Design

Use option 1.

### Architecture

- `packages/api-client` becomes responsible for sending bearer auth on sync requests.
- `apps/api` adds a thin authenticated vault-sync route that resolves a product-facing profile from the Supabase token before touching sync behavior.
- `apps/api/src/services/vault-service.ts` stays intentionally small, but now receives a profile-shaped caller context so later item queries have a natural home.
- The response contract remains the current empty sync payload shape for this slice.

### Components

- Shared vault sync client helper that accepts an access token
- API route logic that validates `Authorization: Bearer <token>`
- Supabase helper that resolves an existing `users_profile` from a token-backed authenticated user
- Vault service function that accepts the resolved profile and returns the current placeholder sync payload

### Data Flow

1. A signed-in client calls `syncVault(fetcher, accessToken, payload)`.
2. The shared API client sends `Authorization: Bearer <token>` to `POST /vault/sync`.
3. The API verifies the Supabase user identity from the token.
4. The API resolves the corresponding `users_profile`.
5. The route passes that product profile into the vault service.
6. The vault service returns the existing sync payload shape, now scoped to an authenticated caller.

### Error Handling

- Missing bearer tokens return `401` with a stable error payload.
- Invalid tokens return `401` with a stable `invalid_token` response, matching the auth bootstrap posture.
- Tokens that resolve to a Supabase user but not to a `users_profile` should return `404` or a stable product error indicating the caller has not completed bootstrap. For this slice, the preferred response is `404` with `error: "profile_not_found"`.
- Unexpected Supabase or service failures return `500` with a stable sync-specific error payload.

### Testing

- Update the shared vault client test to assert bearer auth is sent.
- Update the API vault sync test to cover:
  - missing bearer token
  - invalid token
  - missing `users_profile`
  - successful authenticated sync
- Add unit coverage for the new Supabase helper that resolves `users_profile` by `auth_user_id`.

## Success Criteria

- `POST /vault/sync` no longer works anonymously.
- A valid Supabase token plus a bootstrapped `users_profile` yields a `200` sync response.
- The shared API client exposes the new authenticated sync contract.
- The current response payload remains stable so later vault item work can layer on top without reopening auth basics.

## Non-Goals

- Returning real `vault_items`
- Writing changed items back to the database
- Conflict resolution logic
- Web or extension UI changes
- Broader auth middleware for every phase-1 route
