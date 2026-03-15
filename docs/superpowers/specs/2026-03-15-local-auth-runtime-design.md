# Local Auth Runtime Design

**Problem:** `unuvault` now has a real Supabase-backed signup bootstrap path in code, but the repository still cannot run that flow locally in a browser because `apps/web` and `apps/api` do not expose development runtime entrypoints. The next step is to add the smallest local runtime loop that can prove `signup -> bootstrap -> users_profile` works against a real Supabase project.

## Current State

- [`apps/web/src/app/register/page.tsx`](/Users/yuchen/Desktop/blackbox/.worktrees/local-auth-runtime/apps/web/src/app/register/page.tsx) already renders the MVP register screen.
- [`apps/web/src/components/auth/register-form.tsx`](/Users/yuchen/Desktop/blackbox/.worktrees/local-auth-runtime/apps/web/src/components/auth/register-form.tsx) already performs `Supabase Auth -> API bootstrap` in browser code.
- [`apps/api/src/routes/auth.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/local-auth-runtime/apps/api/src/routes/auth.ts) already exposes `POST /auth/bootstrap`.
- [`apps/api/src/lib/supabase.ts`](/Users/yuchen/Desktop/blackbox/.worktrees/local-auth-runtime/apps/api/src/lib/supabase.ts) already knows how to validate a bearer token and upsert `users_profile`.
- [`apps/web/package.json`](/Users/yuchen/Desktop/blackbox/.worktrees/local-auth-runtime/apps/web/package.json) and [`apps/api/package.json`](/Users/yuchen/Desktop/blackbox/.worktrees/local-auth-runtime/apps/api/package.json) still only provide `test` and `lint`.
- The repository has no real `next dev`, API `listen`, or documented local env wiring for a browser session.

## Approaches

### Option 1: Script-only smoke test

- Keep the current code as-is
- Add a Node script that calls Supabase and the API without a browser
- Defer real `apps/web` and `apps/api` runtime entrypoints

Trade-off:
- Fastest path to a one-off proof, but it avoids the real register page and does not create a reusable local developer loop

### Option 2: Add minimal real runtimes for Web and API (Recommended)

- Add a small Next runtime for `apps/web`
- Add a minimal Fastify server entrypoint for `apps/api`
- Wire local env files for Supabase and API base URLs
- Verify the real browser register page against the live Supabase project

Why this is recommended:
- proves the actual phase-1 user path instead of a synthetic script
- stays small because it only adds runtime entrypoints, not new product scope
- creates a reusable local loop for future `vault/sync` and auth work

### Option 3: Build a full local orchestration layer now

- Add top-level dev scripts, process managers, and more complete workspace bootstrapping
- Try to standardize the whole local environment in one pass

Trade-off:
- Useful later, but too large for this slice and likely to mix runtime plumbing with unrelated tooling decisions

## Chosen Design

Use option 2 and keep the slice limited to the existing MVP auth surface.

### Architecture

- `apps/web` becomes a runnable Next app with the smallest set of required files and scripts.
- `apps/api` gets a dedicated server entrypoint that imports the existing Fastify app and starts listening on a configurable port.
- Local env files remain outside git and provide the Supabase URL, public browser key, service role key, and API base URL.
- The existing register form and auth bootstrap logic stay the product surface; this slice only makes them runnable.

### Components

- A minimal root layout and landing page for the Next app so `app/register` can run under `next dev`
- `dev` and `start` scripts in the web and API packages
- Runtime dependencies required by those scripts, including `next`, `tsx`, and env loading support where needed
- A small API server entrypoint that reads env, starts Fastify, and logs the bound address
- Root convenience scripts or README instructions that make the two-process local loop easy to start

### Data Flow

1. A developer adds local env values for the web and API packages.
2. The API server starts with Supabase server credentials and exposes `/auth/bootstrap`.
3. The Next app starts with public Supabase browser credentials and `NEXT_PUBLIC_API_BASE_URL`.
4. A user opens the register page in a browser and submits `email` and `password`.
5. The browser creates the account through Supabase Auth, obtains an access token, and calls `POST /auth/bootstrap`.
6. The API validates the token, upserts `users_profile`, and returns the product profile payload.
7. The browser shows the existing ready state.

### Error Handling

- Startup should fail fast with clear errors when required env vars are missing.
- The API should log a concise startup failure if binding or env setup fails.
- The web app should keep showing the existing retry-safe error state for signup/bootstrap failures.
- The local runtime loop should avoid silently falling back to placeholder behavior.

### Verification

- Package-level runtime smoke checks should confirm the new `dev` entrypoints exist and lint/typecheck still pass.
- Existing JS tests must continue to pass after runtime dependencies and entrypoints are added.
- A real local browser/API run against the `unuvault-dev` Supabase project should complete `signup -> bootstrap`.

## Success Criteria

- `apps/web` can run locally with `next dev` and render the register page.
- `apps/api` can run locally and serve `POST /auth/bootstrap`.
- Local `.env` files are clearly documented and do not leak secrets into git.
- A real browser session can complete `signup -> bootstrap -> Account ready` against Supabase.

## Non-Goals

- A new login page
- Browser extension or iPhone runtime support
- Full multi-process orchestration tooling
- RLS redesign or broader Supabase schema work
- Expanding auth scope beyond the existing MVP register flow
