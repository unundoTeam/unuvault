# unuvault

unuvault is a Chinese-first public cloud password manager for technical users who want a more trustworthy home for credentials than browser-native storage.

## Source Of Truth

- Product scope and trust posture: `docs/superpowers/specs/2026-03-14-chinese-password-manager-phase1-design.md`
- Execution baseline: `docs/architecture/0000-phase1-execution-baseline.md`
- Engineering roadmap: `docs/superpowers/plans/2026-03-14-chinese-password-manager-phase1-roadmap.md`

## Workspace Layout

- `apps/api` - account, vault, devices, imports, and activity APIs
- `apps/web` - onboarding, vault management, and trust center
- `apps/browser-extension` - autofill, save/update prompts, and popup UI
- `apps/ios` - SwiftUI iPhone app and AutoFill onboarding
- `packages/domain` - shared schemas and validation
- `packages/security` - crypto, unlock, and trust boundaries
- `packages/api-client` - shared typed clients for web and extension
- `infra/supabase` - migrations and local infrastructure notes

## Current Status

This repository now includes the phase-1 schema boundary, client-side security model, and stable local/CI validation entrypoints for the JavaScript and iOS surfaces.

## Development

- `pnpm lint` runs repository-level and workspace TypeScript checks
- `pnpm test` runs the repository meta tests plus all workspace Vitest suites
- `bash scripts/testing/run-ios.sh` runs the Swift package tests for the iPhone app

## Local MVP Auth Setup

- copy `apps/web/.env.example` to `apps/web/.env.local`
- copy `apps/api/.env.example` to `apps/api/.env.local`
- `apps/web/.env.local` needs the browser-facing values for signup: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_API_BASE_URL`
- `apps/api/.env.local` needs the server-only values for auth bootstrap: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PORT`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe for the browser; `SUPABASE_SERVICE_ROLE_KEY` must stay in server-only env files and never ship to the client
- for the current MVP `signup -> bootstrap` loop, disable email confirmation in the Supabase project first; otherwise `signUp` creates a user but does not return a session, so the local register page cannot continue into `POST /auth/bootstrap`
- `POST /vault/sync` now also expects that authenticated session to map to an existing `users_profile`; if bootstrap has not completed yet, sync should return `profile_not_found`
- start the API in one terminal with `pnpm dev:api`
- start the web app in a second terminal with `pnpm dev:web`
- open `http://127.0.0.1:3001/register`
- the local verification order is: create the Supabase-backed signup in web, let the web app call `POST /auth/bootstrap`, then confirm the API can upsert `users_profile`

## CI Status

- `.github/workflows/ci.yml` is the default JS gate for lint and test
- `.github/workflows/ios.yml` keeps the iOS test pass separate and callable on demand
