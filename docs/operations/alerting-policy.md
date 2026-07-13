# Alerting Policy

> Status: Policy scaffold only; no alert destination or delivery is configured

## Current Status

- Alert destination status: `open`
- Test-alert delivery status: `open`
- Named responder status: `open`
- Automated alerting maturity gate: `open`

The provider-neutral API event foundation does not send alerts. This document
does not authorize a provider, create an SLO, assign an on-call responder, or
prove that any notification was delivered.

## Candidate Signal Classes

Future alert design may derive aggregate signals from the fixed API event
contract for:

- availability and `5xx` rate
- hosted auth bridge failures
- sync failures
- sustained latency-bucket regression
- client-security boundary denial trends

These are design inputs only. Thresholds, evaluation windows, severity,
destinations, and paging behavior remain unset so the repo cannot silently
manufacture an operating alert program.

## Required Decisions Before Enablement

For each enabled alert, record:

1. aggregate query and low-cardinality dimensions
2. threshold, evaluation window, recovery condition, and severity
3. destination and service-account owner
4. named primary and backup responders
5. acknowledgement target and escalation path
6. expected false-positive and missing-data behavior
7. rollback or disable procedure

No alert may include raw URLs, request/response bodies, headers, tokens,
passwords, vault content, ciphertext, or raw error messages.

## Required Evidence Before Closing The Gate

- timestamped test-alert delivery receipt
- destination and acknowledged responder
- recovery notification or explicit resolved-state evidence
- redaction review of the delivered payload
- link from the incident rehearsal record

Until this evidence exists, launch material must continue to state that
automated alerting is not configured or mature.
