# Extension DOM Autofill Username Design

## Summary

The browser extension can now:

- authenticate and hydrate a local vault cache in the background
- share unlock state through a background-owned session
- match the current page URL against login items using strict `origin === websiteOrigin`

What it still does not do is fill any real page fields. The current content-side autofill helper can answer "is autofill available?" and "which candidates match this page?", but it does not inspect DOM fields or write values into the page.

This slice adds the first real DOM autofill behavior. It intentionally keeps the scope narrow:

- content code must be triggered explicitly
- autofill only runs when there is exactly one exact-origin match
- only the username field is filled
- password fields may be detected, but password values are not read or written yet

This gives the extension a safe end-to-end autofill path without widening the background protocol to expose decrypted passwords to content scripts.

## Scope

### In scope

- add a content-side helper that attempts autofill for the current page
- reuse `readAutofillCandidates(pageUrl)` as the only candidate source
- autofill only when there is exactly one matching candidate
- detect a username/email input conservatively
- write the matched username into the detected field
- dispatch `input` and `change` events after writing the value
- return structured autofill result states so callers can react safely
- add focused content tests for single-match fill, no-match, multi-match, and no-field cases

### Out of scope

- automatic autofill on page load
- user-facing in-page picker UI
- reading or filling password values
- any background protocol that returns decrypted passwords
- iframe traversal
- shadow DOM traversal
- multi-step login flows that reveal fields later
- broad heuristics or subdomain fallback beyond current exact-origin matching

## Chosen Approach

The chosen approach is **explicit, single-match, username-only DOM autofill**.

That means:

- callers provide `document` and `pageUrl`
- content code reads current candidates through the existing background-backed helper
- if the result is not `ready`, the helper returns the underlying failure state
- if the result contains zero matches, nothing is filled
- if the result contains more than one match, nothing is filled
- if the result contains exactly one match, content code finds a safe username field and writes only the username

This approach is preferred over page-load autofill because the project does not yet have a stable content-script wiring surface visible in this repository, and automatic fill is harder to reason about safely. It is preferred over adding password fill now because the background protocol was intentionally narrowed in the previous slice to avoid exposing decrypted secrets to content code too early.

## Architecture

### Content autofill helper

Extend `apps/browser-extension/src/content/autofill.ts` with a higher-level helper, for example:

```ts
attemptAutofillForCurrentPage({
  document,
  pageUrl,
}): Promise<
  | { status: "unavailable" }
  | { status: "signed_out" }
  | { status: "locked" }
  | { status: "no_page_url" }
  | { status: "no_match" }
  | { status: "multiple_matches"; count: number }
  | { status: "no_fillable_fields" }
  | { status: "filled"; filledUsername: boolean; filledPassword: boolean }
>
```

Responsibilities:

- call `readAutofillCandidates(pageUrl)`
- preserve fail-closed states from the candidate layer
- gate filling on exactly one match
- locate a safe username/email field in the supplied document
- write the candidate username into that field
- dispatch the minimum events needed for common reactive forms

This helper remains content-only. It does not change background protocol behavior.

### Field detection helpers

Keep field detection inside `apps/browser-extension/src/content/autofill.ts` unless the file becomes hard to read during implementation. Small internal helpers are enough for this slice:

- `findUsernameField(document)`
- `findPasswordField(document)` for detection only
- `isFillableInput(element)`
- `dispatchAutofillEvents(input)`

The helper boundaries should stay narrow and testable.

### Candidate boundary

Reuse the candidate shape from the current protocol:

```ts
type AutofillCandidate = {
  hasPassword: boolean;
  id: string;
  title: string;
  username: string;
  websiteOrigin: string;
  websiteUrl: string;
};
```

This slice must not widen that type with password values.

## Field Detection Rules

The rules should be conservative and fail closed.

### Username field candidates

Eligible fields:

- `input[autocomplete="username"]`
- `input[autocomplete="email"]`
- `input[type="email"]`
- `input[type="text"]`

Preferred order:

1. `autocomplete="username"`
2. `autocomplete="email"`
3. `type="email"`
4. input with `name` or `id` containing `user`, `email`, or `login`
5. the first visible text input

### Password field candidates

Detect, but do not fill:

- `input[type="password"]`

This is useful for future expansion and for tests that confirm the page looks like a login surface, but it does not change current fill behavior.

### Inputs to ignore

Ignore any input that is:

- `disabled`
- `readOnly`
- hidden by `type="hidden"`
- missing from layout because it has no client rects

If no safe username field is found, return `no_fillable_fields`.

## Fill Behavior

When the helper finds exactly one match and exactly one usable username field:

1. assign `input.value = candidate.username`
2. dispatch an `input` event with bubbling enabled
3. dispatch a `change` event with bubbling enabled

The returned result should be:

```ts
{
  status: "filled",
  filledUsername: true,
  filledPassword: false,
}
```

If the candidate username is blank, the helper should fail closed and return `no_fillable_fields` rather than silently writing an empty string.

## Data Flow

### Successful username fill

1. caller invokes `attemptAutofillForCurrentPage({ document, pageUrl })`
2. content helper requests candidates through `readAutofillCandidates(pageUrl)`
3. background returns `{ status: "ready", matches: [candidate] }`
4. content helper detects exactly one match
5. content helper finds a fillable username field
6. content helper writes `candidate.username`
7. content helper dispatches `input` and `change`
8. helper returns `{ status: "filled", filledUsername: true, filledPassword: false }`

### Zero matches

1. candidate helper returns `{ status: "no_match" }`
2. content helper returns `{ status: "no_match" }`
3. no DOM mutation occurs

### Multiple matches

1. candidate helper returns `{ status: "ready", matches: [a, b] }`
2. content helper returns `{ status: "multiple_matches", count: 2 }`
3. no DOM mutation occurs

### No usable field

1. candidate helper returns exactly one match
2. content helper fails to locate a safe username field
3. content helper returns `{ status: "no_fillable_fields" }`
4. no DOM mutation occurs

## Error Handling

### Content-side errors

- malformed background response should still map to `unavailable`
- DOM lookup failures should not throw
- event dispatch should not throw outward to callers

### Safety posture

- multiple matches means no fill
- missing field means no fill
- missing username means no fill
- password is never requested and never written in this slice

## Components

### `apps/browser-extension/src/content/autofill.ts`

Add:

- new autofill-attempt helper
- conservative username field detection
- DOM write and event dispatch logic

Keep:

- `shouldOfferAutofill`
- `readAutofillStatus`
- `readAutofillCandidates`

### `apps/browser-extension/tests/autofill.spec.ts`

Extend to cover:

- single exact match fills username field
- zero matches return `no_match`
- multiple matches return `multiple_matches`
- no safe field returns `no_fillable_fields`
- locked and unavailable states pass through without mutation

## Testing

Focused tests should prove:

- the helper fills username when there is one exact match and one safe field
- the helper dispatches `input` and `change`
- the helper does not fill when there are zero matches
- the helper does not fill when there are multiple matches
- the helper does not fill when no safe username field exists
- the helper preserves `locked`, `signed_out`, `unavailable`, and `no_page_url`

Focused extension verification should continue to include:

- `apps/browser-extension/tests/background-unlocked-vault.spec.ts`
- `apps/browser-extension/tests/background-unlock.spec.ts`
- `apps/browser-extension/tests/popup.spec.tsx`
- `apps/browser-extension/tests/autofill.spec.ts`

## Risks And Mitigations

### Wrong-field autofill

Risk:

- generic text inputs could capture credentials into the wrong field

Mitigation:

- prefer `autocomplete` and explicit username/email signals first
- ignore hidden, disabled, and read-only inputs
- do not fill when field confidence is too low

### Over-eager filling on multi-account sites

Risk:

- automatic selection of the wrong account could be worse than not filling at all

Mitigation:

- require exactly one exact-origin match
- return `multiple_matches` without DOM mutation

### Secret exposure

Risk:

- password fill now would require widening the content-visible secret boundary

Mitigation:

- keep this slice username-only
- preserve the current background protocol shape
