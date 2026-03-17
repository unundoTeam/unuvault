# Extension Password Fill Path Design

## Summary

The browser extension now has:

- background-owned auth and unlock state
- strict exact-origin matching for the current page
- explicit username DOM autofill when exactly one candidate matches

What it still lacks is a safe way to fill passwords. The current content helper can fill the username field, but it still cannot request a password or write it into a password field. That means the extension can assist with login pages, but it still cannot complete a real login flow end-to-end.

This slice adds a **background-gated password fill path**. It keeps the trust boundary narrow by requiring background to validate the current page, confirm there is exactly one exact-origin match, and only then return a single set of fill data to content. Content continues to use an explicit trigger and fill fields conservatively.

## Scope

### In scope

- add a background action that returns fill data for the current page only when there is exactly one exact-origin match
- reuse the existing unlocked vault reader for password access
- fail closed on signed-out, locked, invalid URL, zero matches, multiple matches, and no-password cases
- add a content helper that reads fill data for the current page
- upgrade DOM autofill so it can fill password fields in addition to username fields
- keep username and password fill explicit and single-match only
- add focused tests for background fill-data reads and content-side password fill behavior

### Out of scope

- automatic fill on page load
- in-page candidate picker UI
- content passing `itemId` to request secrets
- broadening the candidate API to always include passwords
- iframe traversal
- shadow DOM traversal
- broader hostname or subdomain matching
- multi-step delayed form detection

## Chosen Approach

The chosen approach is **background-owned single-match fill data plus explicit DOM fill**.

That means:

- content provides only the current `pageUrl`
- background performs all auth, unlock, and exact-origin checks
- background reuses unlocked login items, requires exactly one match, and returns only one `username/password` pair
- content uses that narrow fill payload to populate safe username and password fields

This approach is preferred over a two-step `itemId` flow because it keeps the decision about "which login item is eligible to reveal secrets" inside the background runtime. It is preferred over attaching passwords to `read_autofill_candidates` because the candidate API was intentionally narrowed in the previous slice to avoid exposing secrets during general matching.

## Architecture

### Background fill-data action

Extend `apps/browser-extension/src/background/protocol.ts` and `apps/browser-extension/src/background/runtime.ts` with a new action:

- `read_autofill_fill_data`

Request:

```ts
{
  type: "read_autofill_fill_data";
  pageUrl: string;
}
```

Response shape:

```ts
type AutofillFillData =
  | { status: "signed_out" }
  | { status: "locked" }
  | { status: "no_page_url" }
  | { status: "no_match" }
  | { status: "multiple_matches"; count: number }
  | { status: "no_password" }
  | {
      status: "ready";
      fillData: {
        username: string;
        password: string;
      };
    };
```

Responsibilities:

- read auth state
- read unlock state
- parse `pageUrl` and derive `pageOrigin`
- read unlocked login items
- filter by exact `websiteOrigin === pageOrigin`
- require exactly one match
- require that match to contain a non-empty password
- return one narrow fill payload only for that match

This keeps secret release tied to the current page and the current unlock session.

### Content fill-data helper

Extend `apps/browser-extension/src/content/autofill.ts` with:

- `readAutofillFillData(pageUrl: string)`

Responsibilities:

- call the new background action
- preserve fail-closed statuses
- map malformed or unsuccessful background responses to `unavailable`

### DOM autofill helper

Upgrade `attemptAutofillForCurrentPage({ document, pageUrl })` to:

- call `readAutofillFillData(pageUrl)` instead of using candidate data directly
- fill username and password fields independently when each field exists and the corresponding value is non-empty
- dispatch `input` and `change` after each successful field fill

The content helper should still be explicit and still fail closed on any ambiguous state.

## Matching And Secret Release Rules

The rules should be strict and centralized in background.

### Fill data is returned only when:

- auth state is `signed_in`
- unlock state is `unlocked`
- `pageUrl` parses successfully
- exactly one unlocked login item matches `pageOrigin`
- the matched item contains a non-empty password

### Fill data is withheld when:

- auth is missing -> `signed_out`
- unlock is inactive -> `locked`
- `pageUrl` is invalid -> `no_page_url`
- no items match -> `no_match`
- more than one item matches -> `multiple_matches`
- the only matching item has no password -> `no_password`

This means content never gets a password for ambiguous pages or pages with no password stored.

## Field Detection Rules

### Username field

Keep the current conservative strategy:

- `input[autocomplete="username"]`
- `input[autocomplete="email"]`
- `input[type="email"]`
- text input with `name` or `id` containing `user`, `email`, or `login`
- first visible `input[type="text"]`

### Password field

Recognize only:

- `input[type="password"]`

Ignore any field that is:

- `disabled`
- `readOnly`
- hidden via `type="hidden"`
- not visible because it has no client rects

## Fill Behavior

When fill data is `ready`:

- if a fillable username field exists and `fillData.username` is non-empty, fill it
- if a fillable password field exists and `fillData.password` is non-empty, fill it
- dispatch `input` and `change` after each successful fill

Return shape:

```ts
{
  status: "filled",
  filledUsername: boolean,
  filledPassword: boolean,
}
```

Rules:

- if neither field can be filled, return `no_fillable_fields`
- if only the password field exists, it is valid to return `filled` with:

```ts
{
  status: "filled",
  filledUsername: false,
  filledPassword: true,
}
```

- if only the username field exists, it is valid to return `filled` with:

```ts
{
  status: "filled",
  filledUsername: true,
  filledPassword: false,
}
```

This allows login surfaces that reveal fields in stages to still benefit from the explicit helper.

## Data Flow

### Successful username + password fill

1. caller invokes `attemptAutofillForCurrentPage({ document, pageUrl })`
2. content calls `readAutofillFillData(pageUrl)`
3. background validates auth and unlock state
4. background derives `pageOrigin`
5. background reads unlocked login items
6. background finds exactly one exact-origin match with a non-empty password
7. background returns `{ status: "ready", fillData }`
8. content finds safe username and password fields
9. content writes values and dispatches `input/change`
10. helper returns `{ status: "filled", filledUsername: true, filledPassword: true }`

### Multiple matches

1. content requests fill data
2. background finds more than one exact-origin match
3. background returns `{ status: "multiple_matches", count }`
4. content does not mutate DOM

### No password stored

1. content requests fill data
2. background finds exactly one exact-origin match
3. that item has an empty password
4. background returns `{ status: "no_password" }`
5. content does not mutate DOM

## Error Handling

### Background

- invalid URLs should map to `no_page_url`
- empty passwords should map to `no_password`
- unexpected errors should still surface as generic background failures that content maps to `unavailable`

### Content

- malformed background responses should map to `unavailable`
- DOM lookup failures should not throw outward
- filling one field must not require the other field to exist

## Components

### `apps/browser-extension/src/background/protocol.ts`

Add:

- request type for `read_autofill_fill_data`
- fill-data result type definitions
- response shape for fill-data results

### `apps/browser-extension/src/background/runtime.ts`

Add:

- a small helper to build fill-data responses from unlocked login items
- routing for `read_autofill_fill_data`

Keep:

- existing candidate matching behavior

### `apps/browser-extension/src/background/unlocked-vault.ts`

Reuse as-is. It already returns decrypted passwords under the unlock-gated background boundary.

### `apps/browser-extension/src/content/autofill.ts`

Add:

- `readAutofillFillData(pageUrl)`
- password field detection
- password DOM fill logic inside `attemptAutofillForCurrentPage`

Keep:

- explicit trigger behavior
- current username field detection
- `readAutofillCandidates` for non-secret matching reads

## Testing

### Background tests

Extend `apps/browser-extension/tests/background-unlocked-vault.spec.ts` to prove:

- `signed_out` returns `signed_out`
- locked returns `locked`
- invalid URL returns `no_page_url`
- zero matches returns `no_match`
- multiple exact-origin matches returns `multiple_matches`
- single exact-origin match with empty password returns `no_password`
- single exact-origin match with password returns `ready` and `username/password`

### Content tests

Extend `apps/browser-extension/tests/autofill.spec.ts` to prove:

- `readAutofillFillData(pageUrl)` sends the correct background request
- a single ready fill result fills the password field
- when both fields exist, both are filled
- when only the password field exists, password-only fill still succeeds
- `multiple_matches`, `no_password`, `locked`, and `unavailable` do not mutate DOM

## Risks And Mitigations

### Secret boundary drift

Risk:

- content could gain a broader secret-reading capability than intended

Mitigation:

- keep the new API page-scoped and single-match only
- do not accept `itemId` from content
- do not change `read_autofill_candidates`

### Wrong-account password fill

Risk:

- password fill on multi-account sites is more damaging than username-only overfill

Mitigation:

- return `multiple_matches` and do not reveal secrets when more than one exact-origin match exists

### Partial-form pages

Risk:

- some pages may expose only one field at a time

Mitigation:

- allow filling whichever safe fields are present
- return `filled` only when at least one field was successfully written
