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

## Browser Import Report Receipt

`POST /imports/browser` is an implemented authenticated recorded report receipt.
It derives tenant scope server-side through
token -> `account_id` -> `users_profile.account_id` -> `profile.id` ->
`import_jobs.user_profile_id`.
The request body cannot choose or override any account or profile identifier.

The endpoint persists only rebuilt sanitized source, counts, and row-level
reason codes. It does not accept raw CSV, raw credential fields, encrypted vault
items, or credential references. `status: "recorded"` means only that one report
receipt was inserted; it does not prove vault item persistence, `/vault/sync`
acceptance, or linkage to encrypted items.

The receipt has at-least-once semantics and no idempotency guarantee, so a retry
after an uncertain response can insert another row. Current scope isolation and
report-shape validation are application-layer service-role guarantees. Database
`CHECK` constraints for source/status/JSON shape, `import_jobs` RLS, an
idempotency key plus uniqueness rule, production telemetry/on-call ownership,
and external security review remain open. An actual browser UI call site and
`/vault/sync` linkage also remain outside this receipt.

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

## Verification Note

- `tests/auth-boundary-contract.spec.ts` is the repo-level machine guard for
  this auth boundary.
- It keeps the contributor-facing README, this boundary note, and the owning
  Web/API/browser-extension auth tests aligned on the same contract.
