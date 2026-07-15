# Production-Ops And Observability Closeout

> Updated: 2026-07-10
> Status: Minimal phase-1 / beta-rehearsal closeout

## Purpose

Record the smallest executable production-ops and observability closeout for
`unuvault` without overstating the current operating model.

This page answers four launch-facing questions:

- what signals count as incident-facing signals
- who owns first response before escalation
- which docs route each class of issue
- what evidence is needed before a phase-1 or beta rehearsal proceeds

## Authority Boundary

This is a repo-local closeout layer under
[Runtime Authority](runtime-authority.md) and
[Incident And Observability Authority](incident-observability-authority.md).

It does not:

- publish live hosted app identifiers, callback payloads, secret values, or
  production data
- claim a mature telemetry stack, formal on-call rotation, or automated
  alerting program
- replace the upstream `unuidentity` authority for shared hosted identity
- replace the repo README verification shell
- authorize real deploy, rollback, secret rotation, or hosted target changes

## Minimum Signal Set

Treat these as the current incident-facing signal set for phase-1 or beta
rehearsal:

| Signal class | Examples | First route |
| --- | --- | --- |
| Hosted auth bridge | login, callback, `/auth/finalize`, `POST /auth/bootstrap` mismatch | [Identity Production Cutover Hosted Pass](identity-production-cutover-hosted-pass.md) |
| Env or project truth | `IDENTITY_*` / `SUPABASE_*` confusion, hosted project mismatch | [Supabase Environment Mapping](supabase-env-mapping.md) |
| User-visible trust surfaces | `Devices`, `Recent activity`, browser import, sync, explicit extension fill | [Phase 1 Launch Checklist](../launch/phase1-launch-checklist.md) |
| Client security boundary | vault unlock, plaintext release, copy/fill/export, device revoke, lost-device behavior | [Client Crypto Boundary](../architecture/0003-client-crypto-boundary.md) |
| Launch packet regression | phase-1 evidence drift, trust-surface proof failure, crypto gate uncertainty | [secure crypto audit handoff](secure-crypto-pr-audit-handoff.md) |

If a signal does not fit one class, start in
[Incident And Observability Authority](incident-observability-authority.md) and
record the missing route as a docs follow-up instead of silently treating it as
covered.

## First Response Owner

`unuvault` owns first response for consumer-local symptoms:

1. classify the signal as consumer-local, shared-identity, product-data,
   client-security, or launch-packet regression
2. collect non-secret evidence: command, route, status code, screenshot, test
   result, or doc pointer
3. run the narrow repo-owned verification that matches the signal
4. decide whether the issue is a repo-local fix, a consumer rollback, a launch
   hold, or an upstream shared-identity escalation

Escalate to `unuidentity` only when the fault is common beyond `unuvault` as one
consumer, or when callback registration, hosted identity app state, shared
secret truth, or systemic hosted rollback is in scope.

## Rehearsal Closeout Checklist

Before a phase-1 beta or launch rehearsal is treated as operationally ready,
record these items in the handoff or launch packet:

- current branch or commit under review
- incident owner for the rehearsal window
- the exact signal class being exercised or watched
- verification command(s) run, with result
- whether any secret-backed or hosted-control-plane action was intentionally
  excluded
- rollback or launch-hold decision path for the exercised scope
- upstream escalation route when shared identity is in scope

For ordinary repo-local doc or product changes, the default verification floor
stays the README shell:

- `corepack pnpm lint`
- `corepack pnpm test`

Add heavier checks only when the changed surface requires them, such as iOS,
Mac companion, packaged extension, hosted identity, or crypto-boundary proof.

## Hold Or Escalate

Hold the phase-1 or beta rehearsal when any of these are true:

- hosted auth bridge behavior no longer matches the documented consumer path
- `IDENTITY_*` and `SUPABASE_*` routing cannot be explained from checked-in docs
- user-visible trust surfaces regress relative to the phase-1 packet
- a plaintext secret, bridge bearer token, callback payload, or service-role
  key would need to be published to explain the issue
- vault unlock, credential release, revoke, lost-device, or client crypto
  behavior needs review beyond ordinary feature debugging
- no owner is available to watch the rehearsal window

Escalate upstream only after the signal has been classified as shared-identity
or hosted-control-plane scoped. Consumer-local failures should stay in
`unuvault` first so the upstream authority is not overloaded with repo-local
symptoms.

## Current Gaps

This closeout intentionally leaves these items open:

- no mature telemetry or observability platform claim
- no formal on-call rotation claim
- no automated alerting claim
- no external third-party crypto verdict
- no live hosted inventory, callback payload, secret value, or live execution
  log published in this repo

## Next Maturity Gate

Status: `open`

The repo now has three provider-neutral foundation documents:

- [API Telemetry Contract](telemetry-contract.md)
- [Alerting Policy](alerting-policy.md)
- [Incident Rehearsal Template](incident-rehearsal-template.md)

They define a redacted event boundary and the evidence shape for later work.
They do not select or configure a provider, export an event, deliver a test
alert, name responders, publish a schedule, or execute a rehearsal.

The minimal rehearsal closeout above is not a mature production operating
model. Close this gate only when every row has named ownership and durable
evidence; choosing a vendor or writing a policy alone is not sufficient.

| Capability | Required decision and implementation | Required evidence | Status |
| --- | --- | --- | --- |
| Telemetry | Select a telemetry provider and retention policy, define privacy-safe event and error fields, and configure the production environment without committing secrets. | Captured non-secret test signal, query or dashboard link, redaction check, and retention configuration record. | `open` |
| Automated alerting | Define alert thresholds or SLOs, destination, severity routing, and ownership for auth, sync, client-security, and availability signals. | Test alert delivery receipt with timestamp, destination, acknowledged owner, and recovery confirmation. | `open` |
| On-call | Record named primary and backup responders, coverage window, acknowledgement target, and escalation path. | Published schedule or handoff record that names both responders and the decision owner. | `open` |
| Incident rehearsal | Exercise one representative signal through detection, acknowledgement, classification, mitigation or launch hold, and closeout. | Incident rehearsal record with timestamps, evidence links, decisions, owner, and follow-up items. | `open` |

Until all rows close, launch material must continue to say that telemetry,
automated alerting, and formal on-call are not mature. Real provider setup,
alert delivery, schedules, or external coordination require the corresponding
credentials and named human owners; repo edits cannot manufacture that proof.
