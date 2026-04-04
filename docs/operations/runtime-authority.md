# Runtime Authority

## Purpose

This page is the first-layer runtime authority route for `unuvault`.

Use it when you need to find the current authority for:

- incident handling
- observability or telemetry status
- production-readiness routing

This page stays intentionally narrow. It routes to the deeper docs that own the
current authority instead of duplicating them.

## Authority Boundaries

This hub does not replace repo-local implementation docs, product behavior
docs, or the verification shell in `README.md`.

It does not claim that `unuvault` already has a complete incident program, a
fully mature observability stack, or a finished production-ops operating model.

It only points to the current authority that already exists.

## Incident Authority

Current incident-facing authority is split across a few deeper sources:

- [Identity Production Cutover Rehearsal](identity-production-cutover-rehearsal.md)
- [Supabase Environment Mapping](supabase-env-mapping.md)
- [Supabase Boundary](../architecture/0002-supabase-boundary.md)
- [Client Crypto Boundary](../architecture/0003-client-crypto-boundary.md)

Use those docs for auth-bridge rollback, env and secret-truth routing, and the
client-side security boundary around high-risk actions.

## Observability And Telemetry Status

`unuvault` does not yet expose a standalone telemetry or observability authority page.

The current nearest authority is this hub plus the deeper operational docs that
already describe the product boundary. For now, the honest status is that
observability routing is still limited and should be treated as a gap rather
than as a mature program.

## Production Readiness

Current production-readiness authority is split across:

- [Phase 1 Launch Checklist](../launch/phase1-launch-checklist.md)
- [Identity Production Cutover Rehearsal](identity-production-cutover-rehearsal.md)
- the `Verification` section in [README.md](../../README.md)

Use those docs for launch checklist routing, cutover rehearsal, and
scope-dependent verification.

## Current Gaps

- no dedicated observability or telemetry runbook yet
- no standalone incident program page yet
- no completed production-ops maturity statement yet
- deeper docs still carry the operational detail, so this hub is only a route
  map
