# Client Browser Import Core Design

> Status: approved implementation design for a non-UI browser-import core.
> Scope: Chrome and Edge CSV analysis plus an encrypted Web import plan.

## Goal

Build a client-side import core that can safely analyze Chrome and Edge password
CSV exports and convert accepted rows into encrypted `VaultSyncItem` values
without changing any page, component, API route, README, or Pencil authority.

The original core slice ends before network or persistence. A separately
approved receipt slice now records only its sanitized report; it does not choose
whether the encrypted plan is sent to account sync, a Mac-local vault, or
another client-owned destination.

## Current Implementation Status

The non-UI domain analyzer, encrypted Web import plan, camelCase-to-wire mapper,
API/client primitive, and bearer-authenticated `POST /imports/browser` recorded
report receipt are implemented and repo-tested. The receipt accepts only the
sanitized source, counts, and row issue codes; it does not accept raw CSV,
credential fields, encrypted vault items, or credential references.

Receipt scope follows
`Bearer token` -> identity `account_id` -> `users_profile.account_id` ->
`profile.id` -> `import_jobs.user_profile_id`.
Its `recorded` result has at-least-once semantics and no idempotency guarantee.
It does not prove vault item persistence or `/vault/sync` acceptance and does
not link the report to imported encrypted items.

The browser UI call site, worker isolation, progress, cancellation, and
representative Argon2 performance evidence remain open. `/vault/sync` linkage,
database `CHECK` constraints and RLS, idempotency, and an end-to-end
imported-item receipt also remain open. Production telemetry/on-call ownership
and an external security review remain open as well. This status update does
not approve or change any UI or Pencil authority.

## Design Gate

```md
Design Gate: not applicable
Classification: no-ui-impact
Implementation source: no UI source needed
Pencil sync: not applicable
Draft cleanup: not applicable
Pencil lease: not applicable
```

This spec is non-visual product and security authority only. It does not approve
an upload control, report layout, duplicate-review interaction, progress state,
or any other UI behavior.

## Official Format And Safety Inputs

- [Google Chrome Help](https://support.google.com/chrome/answer/13068232)
  documents CSV import with first-line `url`, `username`, and `password`
  columns, caps one import at 3,000 passwords, and warns users to delete the
  plaintext CSV after use.
- [Microsoft Support](https://support.microsoft.com/en-US/edge/export-passwords-in-microsoft-edge)
  documents Edge desktop password export as CSV and warns that the exported
  file is unprotected and should be erased after use.

The 10 MiB input limit and per-field limits below are repo-local resource and
abuse boundaries, not claims about browser vendor limits.

## Scope

### In scope

- Sources `chrome` and `edge` only.
- UTF-8 JavaScript strings with an optional leading BOM.
- RFC 4180-style comma-separated records:
  - CRLF, LF, or CR record endings
  - quoted fields
  - commas and record endings inside quoted fields
  - escaped quotes represented by `""`
- Required headers `url`, `username`, and `password`.
- Optional headers `name` and `note`.
- Unknown extra headers, which are ignored.
- Row-level malformed and duplicate reporting without raw values.
- Conversion of accepted rows into encrypted `VaultSyncItem` values.
- Deterministic dependency injection for ids, time, and password sealing.

### Out of scope

- Safari or any source other than Chrome and Edge.
- UI controls, copy, layout, progress, report rendering, or file pickers.
- Network requests, API job creation, Supabase writes, localStorage, or logs.
- Import into the Mac companion or browser extension.
- Automatic overwrite, merge, delete, or mutation of existing vault items.
- Duplicate comparison against an existing vault; this slice detects duplicates
  only within the current CSV.
- A claim that JavaScript can reliably zero plaintext memory.

## Architecture

### Domain analyzer

`packages/domain/src/browser-import.ts` owns format parsing, resource limits,
normalization, row classification, and the sanitized report. It has no React,
browser API, server, Supabase, or crypto dependency.

The analyzer returns:

- `acceptedEntries`: transient in-memory credentials needed by the encryption
  adapter; these contain a plaintext password but never carry `note`, and must
  not be persisted or logged.
- `report`: counts and sanitized row issues only.

The analyzer never returns the raw CSV or raw row arrays.

### Web encryption adapter

`apps/web/src/lib/import/encrypted-import-plan.ts` converts accepted entries into
`VaultSyncItem` values. It defaults to the existing
`sealVaultPassword(password, passphrase)` helper and accepts injected
`idFactory`, `now`, and `sealPassword` dependencies for deterministic tests.
`sealPassword` is a trusted test-only seam; production code must not select a
runtime or user-controlled sealer. Even injected output must pass the shared
canonical Argon2/ciphertext policy and exact version-3 envelope-key check.

The adapter returns a plan only after every accepted password has been sealed
into a supported version-3 vault envelope. If any row fails, the promise rejects
with a sanitized error and returns no partial plan. Both a synchronous throw and
a rejected promise from an injected sealer map to `encryption_failed`.

## Input Limits

All byte limits use UTF-8 byte length.

| Boundary | Limit |
| --- | ---: |
| CSV input | 10 MiB (`10 * 1024 * 1024`) |
| Data records | 3,000 |
| Header columns | 256 |
| `url` | 8 KiB |
| `username` | 4 KiB |
| `password` | 16 KiB |
| `name` | 4 KiB |

`note` has no accepted field-length boundary in this slice because every
non-empty value is rejected as `unsupported_note`. The 10 MiB whole-file cap is
the resource boundary applied before row classification.

The header record is not included in the 3,000-row limit. A trailing record
delimiter does not create an extra data row. An empty record between two record
delimiters is a data row and is reported as `empty_row`.

The analyzer checks the total input limit before parsing. The CSV state machine
fails while completing the 257th header field or immediately after completing
the 3,001st data record. It does not first allocate the excess header slot, scan
a later malformed suffix, or retain data fields beyond the accepted header
width. Limit failures run before row classification and produce no partial
analysis.

## Header Contract

- Remove one leading UTF-8 BOM before parsing.
- Normalize header names by trimming surrounding whitespace and converting
  ASCII letters to lowercase.
- Require one occurrence each of `url`, `username`, and `password`.
- Accept `name`, `note`, and unknown extra columns.
- Reject more than 256 total header columns as `too_many_columns` before
  materializing the excess slot.
- Reject duplicate normalized header names.
- A data record with more fields than the header is `malformed_row`.
- Missing trailing optional fields are treated as empty strings. Missing
  required fields therefore follow the normal `empty_*` classification.

## Row Normalization

Classification uses this stable precedence:

1. `empty_row`
2. `malformed_row`
3. `empty_url`
4. `empty_password`
5. `url_too_long`
6. `username_too_long`
7. `password_too_long`
8. `name_too_long`
9. `unsupported_note`
10. `invalid_url`
11. `unsupported_url_scheme`
12. `duplicate`

Normalization rules:

- Measure both the raw field and its normalized value when the stable
  `*_too_long` step is reached, so whitespace padding cannot bypass the resource
  boundary. Trim `url`, `username`, and `name`; preserve `password` exactly.
- The `username` header is required, but an empty username value is valid. This
  preserves password-only credentials supported by the current
  `VaultLoginPayload`.
- A non-empty `note` is `unsupported_note` and the row is not accepted. The
  implementation must not silently discard it. Supporting notes waits for a
  complete item-envelope migration because the current sync schema has no
  separate note ciphertext boundary.
- Require URL parsing to succeed.
- Allow only `http:` and `https:`.
- Store only `URL.origin`, which removes path, query, fragment, and userinfo and
  normalizes host casing and default ports through the platform URL parser.
- Normalize the trimmed username to Unicode NFC without changing case.
- The duplicate key is `normalized origin + U+0000 + normalized username`.
- The first row for a duplicate key is accepted. Later rows are omitted from
  accepted entries and reported as `duplicate` with
  `duplicateOfRowIndex` pointing to the first accepted row.

`rowIndex` is the one-based logical CSV record index, including the header as
record 1. Therefore the first data row is row 2. Embedded newlines inside a
quoted field do not change the logical row index.

## Error Contract

Whole-file failures throw `BrowserImportError` with one stable code and no raw
input in the message:

- `unsupported_source`
- `file_too_large`
- `empty_csv`
- `malformed_csv`
- `missing_required_header`
- `duplicate_header`
- `too_many_columns`
- `too_many_rows`

Row issues contain exactly:

- `rowIndex`
- `reasonCode`
- `duplicateOfRowIndex` only when `reasonCode` is `duplicate`

Report counts contain exactly:

- `totalRows`
- `acceptedRows`
- `malformedRows`
- `duplicateRows`

Reports and thrown errors must never contain a raw row, URL, username,
password, name, note, or CSV fragment.

## Encrypted Plan Contract

Each accepted entry maps to one `VaultSyncItem`:

- `id`: injected `idFactory()` result, limited to 1..200 characters matching
  `^[A-Za-z0-9][A-Za-z0-9._:-]*$`; ids must also be unique within the plan
- `item_type`: `login`
- `title`: trimmed `name`, or the normalized origin hostname when name is empty
- `encrypted_payload.schema_version`: `1`
- `encrypted_payload.username`: normalized username
- `encrypted_payload.password_ciphertext`: version-3 output from
  `sealVaultPassword`
- `encrypted_payload.notes`: always `""`; a row with a non-empty source note
  never reaches the plan
- `encrypted_payload.website_url`: normalized origin
- `favorite`: `false`
- `source`: `browser_import_chrome` or `browser_import_edge`
- `last_used_at`: `null`
- `created_at` and `updated_at`: one shared injected `now()` timestamp

The returned plan contains only `items` and the sanitized `report`. It contains
neither the raw CSV nor a `password` field. A non-empty passphrase is mandatory.

Adapter failures throw `EncryptedImportPlanError` with a stable code:

- `empty_passphrase`
- `invalid_timestamp`
- `invalid_id`
- `invalid_ciphertext`
- `encryption_failed`

No underlying crypto error message is forwarded.

## Security Boundary

- Raw CSV and plaintext passwords remain in the caller's in-memory execution
  path only.
- Browser-export notes are not sent as server-readable vault metadata. A
  non-empty note fails closed as `unsupported_note` until a complete item
  envelope can protect it.
- They must not be sent to `/imports/browser`, Supabase, `import_jobs`, Web
  storage, logs, telemetry, error messages, or reports.
- A later `/imports/browser` contract may accept bearer-authenticated sanitized
  counts/status or encrypted item references, but never the raw browser export.
- Duplicate rows are review candidates only. The core never overwrites, merges,
  or deletes credentials.
- The implementation makes no false zeroization promise. Callers should avoid
  retaining the CSV or analysis after encryption and should drop references as
  soon as the plan is built.
- The 3,000-row parse ceiling is not evidence that 3,000 serial Argon2id
  operations are interactively usable. Before a UI adopts this core, that slice
  must add worker isolation, cancellation and progress behavior, plus a
  representative benchmark gate; none is approved by this non-UI design.
- Tests use synthetic secrets and assert that serialized reports, errors, and
  encrypted plans do not contain them.

## TDD And Verification

Implementation follows strict red-green-refactor cycles.

Domain tests cover:

- BOM, CRLF/LF/CR, quoted commas/newlines, and escaped quotes
- required/optional/unknown headers
- source, size, row, header-column, and field limits
- stable whole-file and row reason codes
- HTTP(S) origin normalization
- deterministic duplicate review candidates
- empty-username acceptance and non-empty-note rejection
- report redaction

Web tests cover:

- injected id/time/sealer behavior through real plan output
- Chrome and Edge source mapping
- version-3 ciphertext and correct-passphrase round trip using the real crypto
  helper
- empty passphrase and sanitized failure paths
- no partial plan on any sealing failure
- absence of plaintext password and raw CSV from serialized output

Focused verification:

```bash
pnpm --filter @unuvault/domain exec vitest --run tests/browser-import.spec.ts
pnpm --filter @unuvault/web exec vitest --run tests/encrypted-import-plan.spec.ts
pnpm --filter @unuvault/domain lint
pnpm --filter @unuvault/web lint
git diff --check
```

## Acceptance Criteria

- Chrome and Edge CSV inputs satisfying the contract produce deterministic
  accepted entries and a sanitized report.
- Safari and unknown sources fail closed.
- A header-column or data-row bomb fails at the parser boundary without scanning
  a later malformed suffix.
- Malformed rows and duplicates do not enter the accepted set.
- Password-only rows with an empty username remain importable.
- Rows with non-empty notes report `unsupported_note` and are not accepted.
- No report or thrown error leaks credential values.
- Every accepted password becomes a supported version-3 ciphertext before a
  plan is returned.
- A failure on any item returns no partial plan.
- The original core implementation introduced no UI, API route, README, or
  Pencil changes. The later report-receipt API and this documentation update are
  separately approved slices and still introduce no UI or Pencil change.
