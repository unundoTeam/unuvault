# Unuvault Runtime Authority Uplift Design

> Date: 2026-04-04
> Status: Approved

## Goal

Give `unuvault` one first-layer runtime authority route so a contributor can
quickly find the current authority for incident handling, observability or
telemetry status, and production-readiness routing without deep doc discovery.

## Current State

`unuvault` already has real authority fragments, but they are split across
deeper docs:

- `README.md` documents the product auth bridge, verification shell, and review
  baseline.
- `docs/operations/identity-production-cutover-rehearsal.md` captures dry-run
  cutover and rollback thinking for shared identity production landing.
- `docs/operations/supabase-env-mapping.md` captures current env ownership,
  project mapping, and non-local secret truth guidance.
- `docs/architecture/0003-client-crypto-boundary.md` captures the security and
  crypto boundary for high-risk actions.
- `docs/launch/phase1-launch-checklist.md` captures launch-readiness work.

Portfolio authority now treats this as an explicit `weak-runtime-authority`
problem: `unuvault` already owns high-risk product behavior, but the top-level
docs still do not route clearly enough to incident, observability, and
production-readiness authority.

## Decision

Use a minimal two-layer uplift:

1. add one short top-level `Runtime Authority` entry section in `README.md`
2. add one focused routing document at `docs/operations/runtime-authority.md`

This slice should improve discoverability without pretending that `unuvault`
already has a complete production incident program or a fully mature
observability stack.

## Scope

This slice will:

- add a top-level README route for runtime authority
- create a single operations authority hub that points to the current deeper
  authority docs
- make the current gaps explicit instead of hiding them
- pin the new routing contract with one focused repo-level test

This slice will not:

- add a dedicated high-risk PR review gate
- rewrite the repo review model
- create a full incident runbook set
- invent telemetry or on-call processes that do not yet exist
- duplicate existing auth, crypto, or env authority prose into multiple places

## Recommended Artifact Shape

### 1. Root README route

Update `README.md` with a short `## Runtime Authority` section.

Place it near the existing contributor-facing authority shell, after
`Verification` and before `Review Model`, so operators and reviewers can find
it without scrolling to deep migration notes.

This section should stay compact. It should not absorb deep operational detail.
Its job is to route.

The section should point readers to:

- incident and auth-bridge rollback authority
- observability or telemetry status
- production-readiness authority

### 2. Operations authority hub

Create `docs/operations/runtime-authority.md` as the single routing page for
runtime authority.

This page should contain:

- `Purpose`
- `Authority Boundaries`
- `Incident Authority`
- `Observability And Telemetry Status`
- `Production Readiness`
- `Current Gaps`

The page should route to existing sources rather than duplicate them.

#### Incident Authority

Point primarily to:

- `docs/operations/identity-production-cutover-rehearsal.md`
- `docs/operations/supabase-env-mapping.md`
- `docs/architecture/0002-supabase-boundary.md`

This section should frame the current incident-facing authority as:

- auth-bridge and shared-identity cutover or rollback routing
- env and secret-truth routing
- consumer-first rollback expectations where they already exist

#### Observability And Telemetry Status

Be explicit that `unuvault` does not yet expose a dedicated observability
runbook or telemetry authority page.

This section should document only the currently true first-layer state:

- where contributors can find the closest current authority
- what signals exist today
- what is still missing

That honesty is part of the uplift. The page should not fake a mature
observability program.

#### Production Readiness

Point primarily to:

- `docs/launch/phase1-launch-checklist.md`
- `docs/operations/identity-production-cutover-rehearsal.md`
- the `Verification` section in `README.md`

This section should explain that launch readiness, cutover rehearsal, and
scope-dependent heavy verification are the current production-readiness shell.

### 3. Focused contract test

Add a dedicated docs contract test, for example
`tests/runtime-authority-contract.spec.ts`.

The test should pin:

- the existence of the README `Runtime Authority` section
- the existence of `docs/operations/runtime-authority.md`
- the presence of incident, observability, and production-readiness routing
- explicit wording that observability authority is still limited or incomplete

This keeps the uplift stable without overloading existing auth-boundary tests.

## Why This Shape

This is the smallest change that solves the actual governance problem.

It preserves the existing deeper authority docs, improves top-level
discoverability, and keeps `README.md` from turning into an oversized ops
manual. It also avoids coupling this work to the separate question of whether
`unuvault` should ever adopt a stronger review gate.

## Done Definition

This slice is complete when:

- `README.md` exposes a short first-layer `Runtime Authority` route
- `docs/operations/runtime-authority.md` exists and routes to current deeper
  authority docs
- the new hub explicitly covers incident authority, observability status, and
  production-readiness routing
- the hub is honest about current observability gaps
- one focused repo-level contract test pins the routing surface
- no review-gate or CI policy changes are made in the same slice

## Verification

Minimum verification for this slice:

- `./node_modules/.bin/vitest --run tests/runtime-authority-contract.spec.ts`
- `./node_modules/.bin/vitest --run tests/auth-boundary-contract.spec.ts tests/workspace-entrypoints.spec.ts`

Optional broader verification:

- `pnpm lint`
- `pnpm test`

## Recommended Next Step

After this uplift lands, the next decision becomes much cleaner:

- either keep `unuvault` on review `baseline` while the clearer runtime entry
  route matures
- or later define a much narrower, evidence-backed candidate slice for stronger
  review gating without conflating it with missing top-level runtime authority
