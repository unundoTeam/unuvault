# Identity Production Cutover Rehearsal

> 更新时间：2026-03-30
> 状态：Dry-run evidence

## Goal

Record a dry-run-only rehearsal for `unuvault` so the repo can show how it
would participate in shared identity production landing without changing any
live hosted identity targets.

## Authority Inputs

This rehearsal is driven by these upstream authority docs in `unuidentity`:

- `docs/operations/production-landing.md`
- `docs/operations/consumer-cutover-checklist.md`
- `docs/operations/consumer-rollback-checklist.md`

This rehearsal also assumes the portfolio governance decision adopted in
`unuOS/docs/portfolio/decisions/identity-production-landing-governance.md`.

## Current Consumer State

- `unuvault` remains an `identity contract: adopted` consumer
- the local auth bridge already treats shared identity as the account authority
- the current repo still documents shared identity values against the
  transitional hosted authority
- this rehearsal does not start a new runtime cutover; it documents what would
  happen when formal hosted authority cutover preparation begins

## Dry-Run Cutover Walkthrough

If `unuvault` were selected for live cutover after hosted authority
designation, the repo would follow this sequence:

1. confirm that the formal hosted authority is designated upstream and that
   callback readiness, ownership, and secret-truth requirements are satisfied
2. identify the pending shared-identity switch points without changing values:
   - `NEXT_PUBLIC_IDENTITY_SUPABASE_URL`
   - `NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY`
   - `IDENTITY_SUPABASE_URL`
   - `IDENTITY_SUPABASE_SERVICE_ROLE_KEY`
3. confirm the repo-local auth loop still maps to the documented callback and
   bootstrap path:
   - `unuidentity signup/login -> /auth/callback -> /auth/finalize -> POST /auth/bootstrap`
4. verify that no new local port or product-data exception is introduced
5. run repo-local verification before calling the cutover complete

## Dry-Run Rollback Walkthrough

If a live cutover failed for `unuvault`, the default rollback unit would remain
the consumer, not the whole portfolio.

The consumer-first rollback sequence would be:

1. revert `unuvault`'s shared identity env target back to the previous hosted
   identity authority
2. preserve the formal hosted authority for other consumers unless the fault is
   systemic
3. record whether the failure came from:
   - `unuvault` repo-local env or callback wiring
   - the hosted shared identity authority itself
4. escalate to hosted-authority rollback only if the upstream identity
   authority is the common fault across consumers

## Repo-Local Verification

This rehearsal maps the current repo-local verification set to the future
cutover path:

- `corepack pnpm lint`
- `corepack pnpm test`

Additional verification remains conditional:

- `bash scripts/testing/run-ios.sh` only if a future live cutover changes iOS
  identity behavior
- machine-entrypoint verification stays unchanged in this rehearsal because the
  slice is docs-only

## Blocked For Real Cutover

`unuvault` is still blocked from live cutover today because this slice only
documents the procedure. It does not:

- designate a live hosted identity target inside this repo
- rotate or distribute new live secrets
- change callback registration
- record an operator-reviewed live cutover pass

That means this rehearsal is sufficient for cutover preparation, but not for
cutover completion.

## Outcome

This dry-run rehearsal passes if:

- `unuvault` can point to one clear upstream landing authority
- the repo can state which env surfaces would move during cutover
- the repo can state which local commands would verify the switch
- the repo can describe a consumer-first rollback without guessing

This document is evidence of dry-run readiness only. It is not evidence that a
live hosted identity cutover has already happened.
