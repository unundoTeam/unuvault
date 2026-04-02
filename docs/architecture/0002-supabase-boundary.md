# Supabase Boundary

## Decision

unuvault uses Supabase for authentication and managed Postgres in phase 1, while keeping product logic in a dedicated TypeScript API.

## Why

- Supabase accelerates account bootstrap, hosted Postgres, and operational setup for an early product.
- The unuvault API still needs to own vault semantics, sync policy, import reporting, trust surfaces, and future cross-client behavior.
- This split lets the product move quickly now without binding every domain decision to direct database access patterns.

## Phase-1 Data Model

- `users_profile`: product-facing profile and locale settings that extend the authenticated user
- `vault_items`: encrypted login item records and item metadata
- `device_sessions`: visible signed-in devices and session state
- `import_jobs`: browser import lifecycle, totals, duplicates, and malformed rows
- `activity_events`: recent security and account events shown in trust surfaces

## Boundary Rules

- Supabase Auth is the source of truth for primary user authentication and
  shared identity authority.
- `POST /auth/bootstrap` on the TypeScript API is the product identity bridge
  that maps a valid bearer token into `unuvault`'s `users_profile` contract.
- The TypeScript API is the source of truth for vault workflows, sync
  orchestration, import processing, device activity, and all product runtime
  behavior downstream of that bridge.
- Clients should never write raw phase-1 tables directly.
- Browser extension, web, and iPhone surfaces should speak to product APIs or
  typed clients rather than encoding database assumptions.

## Auth Boundary Layers

`unuvault` uses three auth-adjacent layers that must stay distinct:

1. **Shared identity authority**
   - owned by `unuidentity` and Supabase Auth
   - authenticates the person and returns the identity session

2. **Product identity bridge**
   - owned by `unuvault` API at `POST /auth/bootstrap`
   - establishes the caller's product-facing `users_profile`

3. **Product runtime**
   - owned by `unuvault` API routes such as `/vault/sync`
   - consumes the bootstrapped product identity for vault, devices, imports,
     and activity surfaces

## Surface Responsibilities

- Web uses the shared identity callback flow
  `signup/login -> /auth/callback -> /auth/finalize -> POST /auth/bootstrap`
  before entering the product vault surface.
- The browser extension uses extension-local identity sign-in, then must call
  `POST /auth/bootstrap` before treating background auth state as `signed_in`.
- Future iPhone auth work remains downstream of the same bridge; it should not
  invent a repo-local replacement for the product bootstrap contract.
