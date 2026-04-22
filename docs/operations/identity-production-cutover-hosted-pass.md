# Identity Production Cutover Hosted Pass

> 更新时间：2026-04-22
> 状态：Operator-reviewed hosted pass evidence

## Status

Current result: `operator-reviewed hosted pass recorded`

This repo now records the consumer-facing hosted-pass authority that corresponds
to the upstream `unuidentity` sign-off chain for the first consumer package.

This is narrower than a live cutover-completion record. It documents the
current hosted review boundary and the accepted consumer contract path.

## Upstream Authority Inputs

This hosted-pass authority depends on these upstream records in `unuidentity`:

- `docs/operations/production-landing.md`
- `docs/operations/consumer-cutover-checklist.md`
- `docs/operations/consumer-rollback-checklist.md`
- `docs/operations/hosted-authority-designation.md`
- `docs/operations/hosted-authority-ownership.md`
- `docs/operations/hosted-authority-secret-truth.md`
- `docs/operations/unuvault-cutover-operator-review.md`
- `docs/operations/unuvault-cutover-operator-signoff.md`

It also depends on the repo-local dry-run baseline in:

- [Identity Production Cutover Rehearsal](identity-production-cutover-rehearsal.md)
- [Supabase Environment Mapping](supabase-env-mapping.md)

## Hosted Target Set

The current reviewed target set is:

- shared-identity transitional hosted target documented in this repo:
  `unu-identity-dev`
- product-data hosted target documented in this repo: `unuvault-dev`
- consumer hosted surface used for the operator-reviewed pass: the current
  repo-owned hosted `unuvault` web/API auth bridge surface reviewed through
  `unuidentity/docs/operations/unuvault-cutover-operator-signoff.md`

The long-term formal hosted shared-identity authority remains distinct from
`unu-identity-dev` and intentionally stays outside checked-in inventory.

This document records only the current checked-in target names and the
authority sources that reviewed them. It does not publish live app hostnames,
callback payloads, or secret values.

## Reviewed Env Surfaces

The current reviewed shared-identity switch points remain:

- `NEXT_PUBLIC_IDENTITY_SUPABASE_URL`
- `NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY`
- `IDENTITY_SUPABASE_URL`
- `IDENTITY_SUPABASE_SERVICE_ROLE_KEY`

Repo-local routing for those fields stays aligned with
[Supabase Environment Mapping](supabase-env-mapping.md):

- browser-facing shared identity continues to point at `unu-identity-dev`
- server-facing shared identity continues to point at `unu-identity-dev`
- no secret value is repeated here

## Hosted Callback And Bootstrap Path

The current reviewed hosted consumer path remains:

- `unuidentity signup/login -> /auth/callback -> /auth/finalize -> POST /auth/bootstrap`

The hosted pass depends on the following accepted facts:

- callback and app-registration readiness were confirmed outside checked-in docs
- the repo-local consumer path above remains the reviewed hosted handoff shape
- `POST /auth/bootstrap` remains the product identity bridge rather than an
  optional follow-up

Checked-in docs intentionally do not retain live callback payload logs or the
reviewed hosted app hostname.

## Operator-Reviewed Verification

- review date: `2026-04-13`
- operator of record: the designated shared-identity hosted-authority operator
  role model recorded upstream; checked-in docs intentionally omit personal
  contact details
- hosted surface used: the current repo-owned hosted `unuvault` consumer
  surface plus the external callback/app-registration review boundary accepted
  in the upstream sign-off
- callback/finalize/bootstrap completed: `accepted as the reviewed hosted pass
  contract path`
- manual deviation needed: `none recorded in checked-in sign-off evidence`

The exact hosted proof chain is:

1. `unuidentity/docs/operations/unuvault-cutover-operator-review.md` prepared
   the first consumer-specific package
2. `unuidentity/docs/operations/unuvault-cutover-operator-signoff.md` marked
   the package `signed off`
3. that sign-off confirmed:
   - formal hosted authority exists outside checked-in docs
   - callback and app-registration readiness are confirmed outside checked-in
     docs
   - live secret distribution readiness is confirmed outside checked-in docs
   - rollback ownership and execution responsibility are confirmed

This repo therefore treats the hosted pass as operator-reviewed evidence, while
still keeping live hosted identifiers outside checked-in docs.

## Consumer-First Rollback Path

The rollback stance remains consumer-first:

1. restore `unuvault` to the previous hosted identity target before escalating
   broader rollback
2. preserve the hosted authority for other consumers unless the fault is common
   beyond `unuvault`
3. escalate to hosted-authority rollback only when the shared hosted authority
   itself is the common fault

This rollback boundary stays aligned with:

- `unuidentity/docs/operations/consumer-rollback-checklist.md`
- [Identity Production Cutover Rehearsal](identity-production-cutover-rehearsal.md)

## Result And Remaining Limits

Current outcome:

- `unuvault` no longer has only dry-run cutover evidence
- one operator-reviewed hosted pass now exists for the first consumer package
- the repo can point to a reviewed shared-identity target set, reviewed env
  surfaces, the hosted callback/finalize/bootstrap path, and the consumer-first
  rollback stance without guessing

Remaining limits stay explicit:

- this is hosted-pass evidence, not proof that a broad permanent production
  cutover campaign has completed
- no new secret rotation or callback re-registration is implied unless
  separately recorded upstream
- checked-in docs still do not publish live hosted app identifiers, callback
  payloads, or secret inventory
- this document does not claim that the long-term formal hosted authority has
  already replaced every transitional surface
