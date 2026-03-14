# Blackbox Supabase Boundary

This directory holds the phase-1 database migrations and local setup notes for the Supabase-backed Blackbox environment.

## Scope

- Supabase Auth owns the primary authenticated user record
- Product-specific phase-1 data lives in Postgres tables managed here
- The TypeScript API remains the home for vault business rules, sync logic, and trust policy decisions

## Phase-1 Tables

- `users_profile`
- `vault_items`
- `device_sessions`
- `import_jobs`
- `activity_events`
