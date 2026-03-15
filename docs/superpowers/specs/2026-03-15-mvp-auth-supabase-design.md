# MVP Auth with Supabase Design

**Problem:** `unuvault` already has a phase-1 schema, route groups, and trust-boundary docs, but authentication is still a placeholder in both the API and web app. The product needs a minimal real signup foundation before `vault/sync` and other user-scoped features can become trustworthy.

## Current State

- [`apps/api/src/routes/auth.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/mvp-auth-supabase/apps/api/src/routes/auth.ts) only exposes `GET /auth` and returns a static payload.
- [`apps/web/src/app/register/page.tsx`](/Users/yuchen/Desktop/blackbox/.worktrees/mvp-auth-supabase/apps/web/src/app/register/page.tsx) only shows marketing copy and has no form or network behavior.
- [`infra/supabase/migrations/0001_phase1_core.sql`](/Users/yuchen/Desktop/blackbox/.worktrees/mvp-auth-supabase/infra/supabase/migrations/0001_phase1_core.sql) already defines `users_profile`, keyed by `auth_user_id`.
- [`docs/architecture/0002-supabase-boundary.md`](/Users/yuchen/Desktop/blackbox/.worktrees/mvp-auth-supabase/docs/architecture/0002-supabase-boundary.md) already establishes that Supabase Auth owns primary authentication while the TypeScript API owns product semantics.

## Approaches

### Option 1: Web talks only to Supabase Auth

- Add Supabase client code to the web app
- Let the browser sign up and sign in directly
- Defer API profile bootstrap until later

Trade-off:
- Fastest path to a working form, but it splits identity and product state into separate onboarding steps

### Option 2: Web uses Supabase Auth, then API bootstraps product profile (Recommended)

- Web signs up and signs in through Supabase Auth
- Web forwards the authenticated session token to the API
- API verifies the user, upserts `users_profile`, and returns product-facing profile data

Why this is recommended:
- matches the existing architecture decision
- creates a real authenticated user context for later API routes
- stays small enough for an MVP slice

### Option 3: Web talks only to the API, which proxies Supabase Auth

- Build API endpoints that forward credential flows to Supabase
- Keep Supabase details hidden from the client from day one

Trade-off:
- Cleaner long-term boundary, but too large for the current milestone because it pulls token exchange, error mapping, and session transport into the first cut

## Chosen Design

Use option 2 and keep the first deliverable web-only.

### Architecture

- `Supabase Auth` is responsible for account creation, login, and session issuance.
- `apps/web` owns the initial register UX and uses Supabase's client library for auth primitives.
- `apps/api` adds a thin authenticated bootstrap endpoint that turns a Supabase identity into a product profile.
- `users_profile` stays the only product table touched in this slice.

### Components

- Web auth form component for email/password submission
- Shared API client helper for calling the new bootstrap endpoint with bearer auth
- API auth route that validates a Supabase user and upserts `users_profile`
- Environment configuration for Supabase URL and public key in web and API

### Data Flow

1. A user submits `email` and `password` from the web register page.
2. The web app calls Supabase Auth to create the account.
3. On success, the web app obtains the authenticated session access token.
4. The web app calls `POST /auth/bootstrap` on the TypeScript API with `Authorization: Bearer <token>`.
5. The API validates the token against Supabase, reads the authenticated user identity, and upserts `users_profile` with:
   - `auth_user_id`
   - `email`
   - default `locale = zh-CN`
6. The API returns a minimal product profile payload that confirms the account is ready for product APIs.

### Error Handling

- Invalid email/password input should be rejected in the web form before network calls.
- Supabase signup/login errors should be surfaced as human-readable form messages without exposing raw provider details.
- Missing or invalid bearer tokens should return `401` from the API bootstrap route.
- If profile upsert fails, the API should return a structured `500` response and the web app should show a retry-safe error state.

### Testing

- Add API tests for authenticated bootstrap success, unauthorized access, and idempotent profile upsert behavior.
- Add web tests for the register form, happy-path submission, and visible error handling.
- Add API client tests for the bootstrap request contract if the helper is introduced in `packages/api-client`.

## Success Criteria

- A web user can register with email and password.
- The API can derive the authenticated identity from Supabase and create or update `users_profile`.
- The web app receives a product profile payload after signup.
- The repository still preserves the phase-1 boundary: Supabase owns auth, the API owns product semantics.

## Non-Goals

- Browser extension or iPhone login flows
- A dedicated standalone login page
- Email verification and password recovery flows
- Device session persistence in `device_sessions`
- Password hint UX
- Full auth proxying through the TypeScript API
