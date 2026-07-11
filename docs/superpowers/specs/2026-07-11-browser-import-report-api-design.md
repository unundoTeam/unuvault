# Browser Import Report Receipt API Design

> Status: approved implementation design for the non-UI report-receipt API.
> Scope: a bearer-authenticated, account-scoped receipt for a sanitized
> client-side Chrome or Edge browser-import report.

## Goal

Replace the fixed `/imports/browser` scaffold with a narrow receipt endpoint.
The client continues to parse the browser export and encrypt accepted vault
items locally. The API records only sanitized counts and row-level reason codes;
it never receives the browser export or imported credentials.

## Design Gate

```md
Design Gate: not applicable
Classification: no-ui-impact
Implementation source: no UI source needed
Pencil sync: not applicable
Draft cleanup: not applicable
Pencil lease: not applicable
```

This authority does not approve an upload control, report layout, progress
state, cancellation interaction, or any other UI behavior.

## HTTP Contract

The endpoint is `POST /imports/browser`. It requires:

- `Authorization: Bearer <token>` with one non-empty token and no surrounding
  whitespace, control characters, or additional segments
- `Content-Type: application/json`
- a maximum request body of **512 KiB** (`512 * 1024` bytes)

The request body is exactly:

```json
{
  "source": "chrome",
  "report": {
    "counts": {
      "total_rows": 3,
      "accepted_rows": 1,
      "malformed_rows": 1,
      "duplicate_rows": 1
    },
    "issues": [
      { "row_index": 3, "reason_code": "invalid_url" },
      {
        "row_index": 4,
        "reason_code": "duplicate",
        "duplicate_of_row_index": 2
      }
    ]
  }
}
```

On success the API returns HTTP `201` with exactly:

```json
{ "job_id": "server-generated-uuid", "status": "recorded" }
```

`source` is exactly `chrome` or `edge`. All wire keys are snake_case. Unknown
keys are rejected at the top level, report level, counts level, and every issue
object. The request cannot claim a status, account, profile, job id, timestamp,
or vault-item result.

An issue uses exactly `row_index` and `reason_code`, except that a `duplicate`
issue also requires `duplicate_of_row_index`. Non-duplicate issues must not
contain `duplicate_of_row_index`. Allowed reason codes are:

- `empty_row`
- `malformed_row`
- `empty_url`
- `empty_password`
- `url_too_long`
- `username_too_long`
- `password_too_long`
- `name_too_long`
- `unsupported_note`
- `invalid_url`
- `unsupported_url_scheme`
- `duplicate`

## Strict Report Invariants

The API rebuilds a new sanitized DTO after validation; it never forwards the
request object directly to persistence. Every count, `row_index`, and
`duplicate_of_row_index` must satisfy `Number.isSafeInteger`.

Counts are in `0..3000` and must satisfy all of these formulas:

```text
accepted_rows + malformed_rows + duplicate_rows === total_rows
issues.length === malformed_rows + duplicate_rows
issues.filter((issue) => issue.reason_code === "duplicate").length === duplicate_rows
issues.filter((issue) => issue.reason_code !== "duplicate").length === malformed_rows
```

Issue rows must be strictly increasing and unique. A logical `row_index` is in
`2..total_rows + 1`, because CSV record 1 is the header. A
`duplicate_of_row_index` is in `2..row_index - 1`, must point to an earlier row,
and must not point to any row that appears in `issues`. This makes every
duplicate target an earlier accepted row rather than another malformed or
duplicate row.

Any key, source, reason, value type, number, order, target, range, or formula
outside this contract fails as `invalid_import_report`. Validation errors do not
echo request values.

## Authentication And Account Scope

The bearer token is the only caller-supplied identity input. The server resolves
scope through the existing product identity bridge:

```text
Bearer token
  -> authenticated identity user
  -> identity account_id
  -> unuvault users_profile for that account_id
  -> server-derived user_profile_id
  -> import_jobs.user_profile_id
```

The API must reject a missing or malformed bearer header as
`missing_bearer_token`, an unauthenticated token as `invalid_token`, and an
authenticated account without a product profile as `profile_not_found`. The
request body cannot provide or override `account_id`, `auth_user_id`, or
`user_profile_id`.

The insert uses the product-data service-role adapter only after this scope
derivation. The bearer token and identity records are not persisted in the
receipt and must not be logged.

## Persistence Mapping

The service inserts one `import_jobs` row scoped by the server-derived
`user_profile_id`:

```text
source         <- validated request source
status         <- "recorded"
totals         <- rebuilt validated counts
duplicates     <- rebuilt duplicate issues only
malformed_rows <- rebuilt non-duplicate issues only
finished_at    <- server clock
```

`job_id` is the UUID returned by the database insert. The server chooses
`status: "recorded"`; the client cannot choose it.

The current database schema has no `CHECK` constraint for `import_jobs.source`,
`import_jobs.status`, or the JSON shapes in `totals`, `duplicates`, and
`malformed_rows`. It also has no RLS policy for `import_jobs` and no idempotency
constraint or request key. In this slice, strict validation and account-scope
isolation are application-layer service-role guarantees, not database-enforced
claims.

## Receipt Semantics

This endpoint has **at-least-once** receipt semantics and **no idempotency
guarantee**. A client retry after an uncertain network result may record another
receipt and return another `job_id`. Callers must not infer deduplication from
matching report contents.

`recorded` means only that the sanitized report receipt was inserted. It **does
not prove vault-item persistence**, does not prove that `/vault/sync` accepted
any item, and does not link this receipt to encrypted vault items. The endpoint
does not start or represent a background import job.

## Raw Credential Prohibition

The endpoint does not accept raw CSV, raw rows, a URL, username, password,
display name, note, browser-export fragment, accepted-entry object, encrypted
vault item, password ciphertext, or credential reference. These values must not
enter `import_jobs`, Supabase payloads, logs, telemetry, response bodies, or
error messages.

Only the exact sanitized counts and issue fields defined above may cross the
client-to-server boundary. Route and service code must never log the request
body. Static error codes must replace parser, provider, and database messages.

## Stable HTTP Results

- `201`: `{ "job_id": "...", "status": "recorded" }`
- `400`: `invalid_import_report`, including malformed JSON
- `401`: `missing_bearer_token` or `invalid_token`
- `404`: `profile_not_found`
- `413`: `import_report_too_large`
- `415`: `unsupported_media_type`
- `500`: `import_report_create_failed`

Error responses contain only the stable code and must not expose request,
identity-provider, Supabase, or stack-trace details.

## Remaining Gates

This contract intentionally leaves these items open:

- a UI call site and its approved Pencil interaction authority
- worker isolation, cancellation, progress behavior, and representative Argon2
  performance evidence before interactive bulk import
- linkage between an import receipt and `/vault/sync` item persistence
- an end-to-end receipt proving which encrypted items reached account storage
- database `CHECK` constraints for source, status, and JSON shapes
- `import_jobs` RLS or an equivalent database-enforced tenant boundary
- an idempotency key and database uniqueness rule
- retention, deletion, and operator policy for report receipts
- production telemetry, alert routing, and on-call ownership for receipt
  failures
- an external security review of the implemented route, service, and adapter

Until those gates close, this API is an authenticated sanitized-report receipt,
not a complete browser-import workflow.
