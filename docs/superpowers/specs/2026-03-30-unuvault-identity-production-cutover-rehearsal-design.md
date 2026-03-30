# Unuvault Identity Production Cutover Rehearsal Design

> Date: 2026-03-30
> Status: Approved

## Goal

Define a dry-run-only rehearsal slice for `unuvault` that records how the repo
would perform a formal shared-identity production cutover and consumer-first
rollback without changing any live hosted identity settings.

## Current State

`unuvault` already documents:

- `identity contract: adopted`
- a clean local auth cutover for pre-launch test users
- the current hosted shared identity inputs under `docs/operations`

Portfolio and `unuidentity` authority now also exist for:

- production landing governance
- consumer cutover order
- consumer rollback defaults
- hosted authority designation, ownership, and secret truth source

That means the next highest-value step is not another runtime auth change. It
is an operator-facing rehearsal that proves `unuvault` can map its repo-local
verification and rollback thinking onto the new production-landing authority.

## Decision And Scope

This slice adds a `dry-run rehearsal` record for `unuvault`.

It covers:

- the authority inputs `unuvault` consumes from `unuidentity`
- a dry-run cutover walkthrough
- a dry-run rollback walkthrough
- repo-local verification commands
- blockers that still prevent real cutover

It does not:

- change live hosted identity env values
- change callback registration
- change live secrets
- change runtime code
- start real consumer cutover

## Artifact Shape

This slice should add one main evidence document and one light README pointer.

### Main evidence document

Create:

- `docs/operations/identity-production-cutover-rehearsal.md`

This document should include:

- Goal
- Authority Inputs
- Current Consumer State
- Dry-Run Cutover Walkthrough
- Dry-Run Rollback Walkthrough
- Repo-Local Verification
- Blocked For Real Cutover
- Outcome

It should explicitly reference:

- `unuidentity/docs/operations/production-landing.md`
- `unuidentity/docs/operations/consumer-cutover-checklist.md`
- `unuidentity/docs/operations/consumer-rollback-checklist.md`

### README pointer

Update `README.md` under `Current Risks / Migration Status` to point readers to
the rehearsal evidence document.

This pointer should make clear that the new record is a rehearsal artifact, not
proof that live cutover has started.

## Done Definition

This slice is complete when:

- `docs/operations/identity-production-cutover-rehearsal.md` exists
- the rehearsal note records dry-run cutover and rollback walkthroughs
- the note records repo-local verification commands
- the note states what still blocks real cutover
- `README.md` links to the rehearsal evidence
- no runtime files or live env values are changed

## Verification

Minimum verification for this slice:

- `git diff --check`
- `corepack pnpm lint`
- `corepack pnpm test`

## What This Still Does Not Mean

After this slice lands, `unuvault` still must not claim:

- that a real hosted identity cutover happened
- that callback or env targets were changed
- that `unuidentity` now serves `unuvault` from a new formal authority in live
  operation
- that other consumers may skip rehearsal

The valid claim after this slice is:

> `unuvault` has a checked-in dry-run rehearsal record for production landing
> cutover and rollback.

## Recommended Next Step

After this rehearsal lands, move to operator-reviewed cutover preparation for
`unuvault`, and only then decide whether live cutover should begin.
