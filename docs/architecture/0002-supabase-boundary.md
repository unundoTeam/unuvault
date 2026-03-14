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

- Supabase Auth is the source of truth for primary user authentication.
- The TypeScript API is the source of truth for vault workflows, sync orchestration, import processing, and activity classification.
- Clients should never write raw phase-1 tables directly.
- Browser extension, web, and iPhone surfaces should speak to product APIs or typed clients rather than encoding database assumptions.
