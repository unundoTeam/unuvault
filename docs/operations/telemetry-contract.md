# API Telemetry Contract

> Status: Provider-neutral API foundation implemented; provider/export remains open

## Purpose

Define the smallest privacy-safe, provider-neutral telemetry boundary for the
`unuvault` API. The implementation provides an injectable structured-event
sink for tests and future adapters. Production uses a default no-op sink until
a provider, retention policy, credentials, and non-secret export evidence are
approved and configured.

Provider/export status: `open`

This foundation is not evidence of a mature telemetry platform, a configured
dashboard, automated alerting, or an operating on-call program.

## Event Contract

The API emits one allowlist-only completion event per completed HTTP response.
A single Fastify `onResponse` hook runs after the final response is sent, so
thrown and custom-mapped errors use the final status and completion latency
without relying on an earlier error-hook event.

| Field | Allowed values or boundary |
| --- | --- |
| `schemaVersion` | `1` |
| `signalClass` | `api_http_request` |
| `routeTemplate` | Fastify route template, or `__unmatched__` for 404/unmatched requests; never the raw URL |
| `method` | `DELETE`, `GET`, `HEAD`, `OPTIONS`, `PATCH`, `POST`, `PUT`, or `OTHER` |
| `statusClass` | `1xx`, `2xx`, `3xx`, `4xx`, `5xx`, or `other` |
| `latencyBucket` | `under_100ms`, `100ms_to_499ms`, `500ms_to_1999ms`, or `2000ms_and_over` |
| `requestId` | 1-64 characters from ASCII letters, digits, `.`, `_`, `:`, and `-`; otherwise `invalid` |

No timestamp, hostname, deployment identifier, account identifier, device
identifier, or provider metadata is part of this repo-owned event schema. A
future adapter must be reviewed before adding such context.

## Data That Must Never Enter An Event

The event builder does not receive or inspect:

- request or response body
- query parameters or raw URL/path values
- headers, `Authorization`, cookies, or bearer tokens
- local bridge tokens or account/session tokens
- passwords, vault payloads, plaintext credentials, notes, or imported data
- ciphertext, encrypted envelopes, key material, or recovery material
- raw error objects, stack traces, or error messages

Routes are represented only by the Fastify route template. Unmatched requests
use the fixed `__unmatched__` sentinel, so attacker-controlled path and query
values cannot become telemetry dimensions.

## Sink And Failure Boundary

- `buildApp()` accepts an optional event sink for repo-owned tests and a future
  provider adapter.
- Without an injected sink, the API uses the default no-op sink.
- Synchronous throws and rejected promises from a sink are swallowed at the
  observability boundary and must not change request status or response data.
- The foundation does not retry, buffer, persist, or send events over a network.
- No telemetry SDK, endpoint, service account, API key, or credential is added
  by this foundation.

## Evidence And Remaining Gate

Repo-owned tests cover status and latency classifications, request-ID bounds,
Fastify route-template use, unmatched routes, thrown and custom-mapped error
completion timing, exactly-once emission, secret canaries, and sink-failure
isolation.

The telemetry maturity row remains `open` until a decision owner records all of
the following:

1. provider and data-region decision
2. retention, sampling, access, and deletion policy
3. configured production adapter without committed credentials
4. captured non-secret test signal and query/dashboard evidence
5. redaction review against the configured provider payload
