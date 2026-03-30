# Unuvault Auth Login Entrypoint Design

**Problem:** `unuvault` local onboarding currently only exposes `register`, while the hosted handoff flow for local developer secrets also needs a reliable path for already-registered users to establish a browser session. In practice, `requires_auth` on `/dev/secrets/handoff` sends every unauthenticated browser through `register`, which leaves confirmed users, Google users, and email-confirmation edge cases stuck without a usable sign-in route.

## Current State

- [`apps/web/src/components/dev-secrets/handoff-page-client.tsx`](../../../apps/web/src/components/dev-secrets/handoff-page-client.tsx) shows `Continue through register` when the browser has no current identity session.
- [`apps/web/src/app/register/page.tsx`](../../../apps/web/src/app/register/page.tsx) and [`apps/web/src/components/auth/register-form.tsx`](../../../apps/web/src/components/auth/register-form.tsx) implement a single local onboarding card with email/password signup only.
- [`apps/web/src/lib/identity/complete-identity-callback.ts`](../../../apps/web/src/lib/identity/complete-identity-callback.ts) already preserves a safe `next` path after a successful auth callback.
- The hosted smoke proved the current gap: successful signup can reach pending-confirmation state, but an already-created account cannot continue because there is no first-class sign-in entry point.

## Approaches

### Option 1: Keep `register` only and rely on Supabase dashboard settings

- Continue using the current register page as the only browser auth entry.
- Work around hosted smoke issues by toggling email-confirmation settings or manually confirming users.

Trade-off:

- This can unblock a specific local test once, but it does not fix the product gap.
- Existing users still have no supported way to sign in from the handoff surface.

### Option 2: Turn `/register` into a single page with mode toggles

- Keep one page and switch between `create account` and `sign in` in the same card.
- Add Google and password login options there.

Trade-off:

- Reuses one shell, but it makes the current simple register surface noticeably more complex.
- The handoff fix would be tied to a broader auth-form refactor than we need right now.

### Option 3: Add a minimal dedicated login entry point and wire handoff to it (Recommended)

- Keep `/register` focused on account creation.
- Add a new `/login` page with the same visual shell and only the sign-in actions we are missing.
- Update handoff `requires_auth` to offer the right branching: Google login, email login, or create account.

Why this is recommended:

- It solves the real hosted smoke blocker without over-expanding the auth surface.
- It preserves the current visual language and keeps each page single-purpose.
- It gives existing users a clear route while keeping signup behavior intact.

## Chosen Design

Use option 3 and add a minimal login surface dedicated to the current `unuvault` onboarding and local handoff flow.

### UX structure

When `/dev/secrets/handoff` detects `requires_auth`, the page should no longer present only a register link. Instead, it should show:

- a primary action for `Continue with Google`
- a secondary action for `Continue with email`
- a tertiary text action for `Create account`

This keeps the handoff page task-focused: the user is here to connect the browser to the CLI, not to choose from a general account dashboard. The copy should stay explicit that authentication is required before a handoff code can be minted.

`/login` should reuse the same page shell style as `/register` so the flow feels continuous:

- same card layout
- same local-onboarding badge
- same tone and spacing
- no new visual language

The card content should differ only in purpose:

- heading: sign in rather than create account
- email/password sign-in form
- Google sign-in action
- a small link back to register for first-time users

### Routing and callback behavior

Both login entry points must preserve the caller-provided `next` path:

- email/password sign-in should redirect the browser to `next` after a successful auth session is present
- Google sign-in should call the Supabase browser client with `redirectTo=/auth/callback?next=<safe-next>`
- `/auth/callback` remains the shared callback route and continues to rely on the existing safe-next guard

This means the login flow stays compatible with:

- `/auth/finalize`
- `/dev/secrets/handoff?...`
- any other current internal route that already depends on the callback contract

### Component boundaries

Keep the change focused and split by responsibility:

- add a small shared auth redirect helper rather than duplicating `next` handling across forms
- keep register and login forms separate so each stays easy to reason about and test
- keep handoff-page branching logic in the handoff page client, but extract URL builders for register/login links so the tests stay straightforward

### Error handling

The minimal login entry point should follow the existing auth posture:

- inline validation for missing email/password
- friendly generic error copy for failed sign-in
- no raw Supabase error leakage into the UI

The handoff page should continue to prefer explicit, actionable states:

- `Preparing the local handoff...`
- `Sign in first...`
- `We couldn't complete the handoff.`

### Testing

The first implementation pass should add focused tests for:

- handoff `requires_auth` renders both login and register branches
- `/login` renders the expected actions
- email/password login preserves `next`
- Google login preserves `next`
- `/register` exposes a stable link to `/login`

The existing handoff and register tests should remain green, with behavior adjusted only where the UI intentionally changes.
