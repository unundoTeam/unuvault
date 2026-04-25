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

Current incident-facing authority now starts with one minimal page:

- [Incident And Observability Authority](incident-observability-authority.md)

That page routes first response and escalation. Use the deeper sources below
when the incident has already been classified:

- [Identity Production Cutover Rehearsal](identity-production-cutover-rehearsal.md)
- [Identity Production Cutover Hosted Pass](identity-production-cutover-hosted-pass.md)
- `unuidentity/docs/operations/unuvault-cutover-operator-signoff.md`
- [Supabase Environment Mapping](supabase-env-mapping.md)
- [Supabase Boundary](../architecture/0002-supabase-boundary.md)
- [Client Crypto Boundary](../architecture/0003-client-crypto-boundary.md)

Use those docs for auth-bridge rollback, env and secret-truth routing, and the
client-side security boundary around high-risk actions. The repo-local
rehearsal stays dry-run-only; the hosted-pass record captures the current
repo-local hosted review boundary; the upstream `unuidentity` sign-off remains
the operator-reviewed cutover-preparation authority.

## Observability And Telemetry Status

`unuvault` now exposes a minimal standalone incident and observability
authority page:

- [Incident And Observability Authority](incident-observability-authority.md)

The honest status is still limited: the repo now has a first-layer authority
page, but it does not yet claim a mature observability program, dedicated
telemetry stack, on-call coverage, or automated alerting.

## Production Readiness

Current production-readiness authority is split across:

- [Phase 1 Launch Checklist](../launch/phase1-launch-checklist.md)
- [Identity Production Cutover Rehearsal](identity-production-cutover-rehearsal.md)
- [Identity Production Cutover Hosted Pass](identity-production-cutover-hosted-pass.md)
- `unuidentity/docs/operations/unuvault-cutover-operator-signoff.md`
- `unuidentity/docs/operations/production-landing-completion.md`
- `unuidentity/docs/operations/consumer-cutover-checklist.md`
- the `Verification` section in [README.md](../../README.md)

Use those docs for launch checklist routing, cutover rehearsal, and
scope-dependent verification. The repo-local hosted-pass record is narrower
than live cutover completion, and the upstream sign-off records the first real
operator-reviewed pass. The bounded production landing completion conclusion
lives in the upstream `production-landing-completion.md` result-layer authority;
the repo-local `unuvault` records still do not publish live hosted inventory,
callback payloads, secret values, or live cutover execution evidence.

## Current Hosted Identity Status

As of `2026-04-25`, the current checked-in status is:

- `unuvault` has repo-local hosted-pass evidence in
  [Identity Production Cutover Hosted Pass](identity-production-cutover-hosted-pass.md)
- upstream `unuidentity/docs/operations/production-landing-completion.md`
  records the bounded result-layer production landing completion authority
- checked-in `unuvault` docs intentionally do not publish live hosted inventory,
  callback payloads, secret values, or a live execution log

That means the launch packet is no longer missing a production-landing authority
route. It does not mean that this repo stores live hosted values or that future
identity target changes can be called complete from this hub alone. Any future
live-target change must be recorded through the upstream consumer cutover checklist,
`unuidentity/docs/operations/consumer-cutover-checklist.md`, plus repo-local
verification and rollback notes before that change is called complete.

## Current Gaps

- no mature telemetry or observability program yet
- no on-call or automated-alerting program claimed yet
- no completed production-ops maturity statement yet
- deeper docs still carry the operational detail, so this hub is only a route
  map
