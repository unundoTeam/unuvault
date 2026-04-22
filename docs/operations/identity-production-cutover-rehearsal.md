# Identity Production Cutover Rehearsal

> 更新时间：2026-04-23
> 状态：Dry-run evidence

## Goal

Record a dry-run-only rehearsal for `unuvault` so the repo can show how it
would participate in shared identity production landing without changing any
live hosted identity targets.

The current operator-reviewed hosted-pass sibling authority now lives in
[Identity Production Cutover Hosted Pass](identity-production-cutover-hosted-pass.md).
This document remains the dry-run baseline and does not change status because
that sibling doc exists.

## Authority Inputs

This rehearsal is driven by these upstream authority docs in `unuidentity`:

- `docs/operations/production-landing.md`
- `docs/operations/consumer-cutover-checklist.md`
- `docs/operations/consumer-rollback-checklist.md`
- `docs/operations/unuvault-cutover-operator-signoff.md`

This rehearsal also assumes the portfolio governance decision adopted in
`unuOS/docs/portfolio/decisions/identity-production-landing-governance.md`.

## Upstream Operator-Reviewed Pass

This repo-local record still exists to show the `unuvault`-side dry-run
mapping for env surfaces, verification, and consumer-first rollback.

The first real operator-reviewed cutover-preparation pass now lives upstream in
`unuidentity/docs/operations/unuvault-cutover-operator-signoff.md`.

That upstream sign-off confirms cutover-preparation and rollback-checklist
review only. It does not claim that a live cutover or production landing
completion has already happened.

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

`unuvault` is still blocked from live cutover completion today because this
repo-local slice only documents the consumer procedure. It does not:

- designate a live hosted identity target inside this repo
- rotate or distribute new live secrets
- change callback registration
- record live cutover execution or landing completion inside this repo

The upstream operator-reviewed pass now covers cutover-preparation sign-off, but
that still leaves live execution and completion evidence outside this dry-run
record.

## Outcome

This dry-run rehearsal passes if:

- `unuvault` can point to one clear upstream landing authority
- `unuvault` can point to the upstream operator-reviewed pass for the first
  consumer package
- the repo can state which env surfaces would move during cutover
- the repo can state which local commands would verify the switch
- the repo can describe a consumer-first rollback without guessing

This document is evidence of dry-run readiness only. The operator-reviewed
cutover-preparation pass lives upstream, and neither record is evidence that a
live hosted identity cutover has already happened.
