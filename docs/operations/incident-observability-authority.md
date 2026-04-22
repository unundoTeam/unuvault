# Incident And Observability Authority

> 更新时间：2026-04-22
> 状态：Minimal authority page

## Purpose

Define the smallest honest authority for how `unuvault` detects, triages, and
routes runtime incidents today.

This page exists so post-launch contributors do not need to infer incident or
observability authority only from scattered deeper docs.

## Authority Boundaries

This page is a first-response route, not a full production-ops program.

It does not:

- publish live hosted app identifiers, callback payloads, or secret values
- claim that `unuvault` already has a mature telemetry stack
- claim that `unuvault` already runs a formal on-call program
- replace repo-local product, security, or verification docs

This page does keep the current consumer-first incident boundary explicit:
`unuvault` owns its repo-local response path first, and escalates to upstream
shared-identity authority only when the fault is common beyond one consumer.

## Current Signal Surfaces

### Hosted auth bridge, callback, finalize, and bootstrap

Current auth-path authority lives in:

- [Identity Production Cutover Hosted Pass](identity-production-cutover-hosted-pass.md)
- [Identity Production Cutover Rehearsal](identity-production-cutover-rehearsal.md)
- the auth-boundary contract in [README.md](../../README.md)

Use those records when the signal is:

- hosted login or callback failure
- `/auth/finalize` handoff drift
- `POST /auth/bootstrap` failure or mismatch
- uncertainty about whether the consumer-side bridge is still the reviewed path

### Supabase project health and env truth routing

Current env and hosted-project routing lives in:

- [Supabase Environment Mapping](supabase-env-mapping.md)
- [Supabase Boundary](../architecture/0002-supabase-boundary.md)

Use those docs when the signal is:

- `IDENTITY_*` versus `SUPABASE_*` confusion
- uncertainty about which hosted project owns the current value
- product-data versus shared-identity fault isolation

### Launch packet verification surfaces

Current launch-facing runtime proof lives in:

- [Phase 1 Launch Checklist](../launch/phase1-launch-checklist.md)
- [secure crypto audit handoff](secure-crypto-pr-audit-handoff.md)

Use those records when the signal is:

- launch-packet regression
- trust-surface verification failure
- phase-1 surface proof needing re-check before incident triage broadens

### User-visible trust-center surfaces

Current user-visible trust signal routing stays tied to the phase-1 packet:

- `Devices`
- `Recent activity`
- browser import and security/trust entry points already pinned in the launch
  checklist

Use the launch checklist first when the symptom is visible in those surfaces
before treating the problem as a broader product-runtime incident.

## Incident Triggers

Treat the following as incident-facing triggers for the current repo posture:

- hosted shared-identity login, callback, finalize, or bootstrap no longer
  matches the documented consumer path
- `IDENTITY_*` and `SUPABASE_*` routing appears crossed or inconsistent
- `Devices`, `Recent activity`, import, or sync trust surfaces regress relative
  to the launch packet
- client-security or trust-boundary behavior needs escalation beyond ordinary
  feature debugging

## First Response Route

1. Classify whether the issue is consumer-local, shared-identity, product-data,
   or client-security scoped.
2. For hosted auth bridge symptoms, start with
   [Identity Production Cutover Hosted Pass](identity-production-cutover-hosted-pass.md),
   then fall back to
   [Identity Production Cutover Rehearsal](identity-production-cutover-rehearsal.md)
   if the question is about the dry-run baseline.
3. For env or project-truth confusion, use
   [Supabase Environment Mapping](supabase-env-mapping.md) first.
4. For user-visible trust-center or phase-1 launch regressions, use
   [Phase 1 Launch Checklist](../launch/phase1-launch-checklist.md) first.
5. Escalate to upstream shared-identity rollback authority only when the fault
   is common beyond `unuvault` as one consumer.

## Escalation And Ownership

- `unuvault` owns repo-local symptom triage, verification reruns, and
  consumer-scoped rollback judgment.
- Shared-identity hosted authority ownership remains upstream in `unuidentity`,
  especially for callback/app-registration changes, secret-truth continuity,
  and systemic hosted rollback.
- Rollback remains consumer-first by default; broader hosted-authority rollback
  is justified only when the shared hosted authority itself is the common fault.

## Known Gaps

- no mature telemetry stack claim
- no on-call program claim
- no automated alerting claim
- current observability still depends on targeted verification, hosted-pass
  review, Supabase project health, and user-visible trust surfaces instead of a
  dedicated telemetry platform
