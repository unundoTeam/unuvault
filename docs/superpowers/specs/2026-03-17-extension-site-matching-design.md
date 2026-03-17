# Extension Site Matching Design

## Summary

The browser extension now has the two core prerequisites for real autofill matching:

- background-owned auth and unlock state
- vault items that carry normalized `website_url` metadata and expose derived `websiteOrigin`

What it still lacks is a real matching step between the current page and the unlocked vault cache. Today the extension can only report coarse autofill readiness (`signed_out`, `locked`, `empty`, `ready`). That status is enough to prove the unlock boundary works, but not enough to answer the real question: “which login items belong to this page?”

This slice adds a background-owned site-matching API that accepts the current page URL, compares its `origin` against each unlocked login item’s `websiteOrigin`, and returns matching candidates. This slice intentionally stops before any DOM autofill or password-fill actions.

## Scope

### In scope

- add a background API for reading autofill candidates for a specific page URL
- use strict `origin === websiteOrigin` matching only
- keep all matching logic in the background runtime
- reuse the existing unlocked vault reader as the source of candidate items
- return lightweight match results without exposing decrypted passwords to content code yet
- upgrade `apps/browser-extension/src/content/autofill.ts` so content scripts can request real page-specific candidates
- add focused tests for protocol routing, strict-origin matching, and content-side request behavior

### Out of scope

- DOM autofill
- user selection UI for multiple candidates
- returning decrypted passwords to content scripts
- subdomain fallback matching
- public-suffix or registrable-domain matching
- ranking or sorting heuristics beyond current reader order
- multi-site login item support

## Chosen Approach

The chosen approach is **background-only strict origin matching**.

That means:

- content scripts provide the current `pageUrl`
- background parses it into a `pageOrigin`
- background reads unlocked login items
- background filters for `item.websiteOrigin === pageOrigin`
- background returns only simplified match candidates

This approach is preferred over subdomain or eTLD+1 matching because autofill errors are more dangerous than misses. Returning no candidates on `app.example.com` is safer than incorrectly surfacing credentials for `example.com` or another subdomain. It is also preferred over jumping straight to DOM fill because the system first needs a trustworthy and testable match boundary.

## Architecture

### Background candidate matcher

Add a background unit responsible for page-to-item matching.

Responsibilities:

- accept a `pageUrl`
- parse and validate it
- derive `pageOrigin`
- read unlocked login items from the existing unlocked vault reader
- filter items by exact `websiteOrigin`
- return lightweight candidate data for matching items

This unit should not know anything about the DOM. It is a data access and filtering boundary only.

### Background protocol extension

Extend the background request protocol with a candidate-reading action, for example:

- `read_autofill_candidates`

The request should include:

- `pageUrl: string`

The response should stay narrow and structured:

```ts
type AutofillCandidate = {
  id: string;
  title: string;
  username: string;
  hasPassword: boolean;
  websiteUrl: string;
  websiteOrigin: string;
};

type AutofillCandidatesResult =
  | { status: "signed_out"; matches: [] }
  | { status: "locked"; matches: [] }
  | { status: "no_page_url"; matches: [] }
  | { status: "no_match"; matches: [] }
  | { status: "ready"; matches: AutofillCandidate[] };
```

This is intentionally more specific than the existing coarse status API and still narrower than returning full unlocked vault items.

### Content autofill adapter

Upgrade `apps/browser-extension/src/content/autofill.ts` to add a real match query helper.

Responsibilities:

- accept the current `pageUrl`
- call the background candidate API
- return structured candidate results
- map background failures to a safe `unavailable` status

This layer still should not mutate DOM or request decrypted passwords.

## Matching Rules

The rules should be strict and fail closed.

### Match succeeds only when:

- the extension auth state is `signed_in`
- the extension unlock state is `unlocked`
- `pageUrl` parses successfully
- `item.websiteOrigin` is non-empty
- `new URL(pageUrl).origin === item.websiteOrigin`

### Match fails closed when:

- auth is signed out -> `signed_out`
- unlock is not active -> `locked`
- `pageUrl` is blank or invalid -> `no_page_url`
- no items match exact origin -> `no_match`

### Intentional non-matches

These should not match in this slice:

- `https://github.com` page against `https://app.github.com`
- `https://app.github.com` page against `https://github.com`
- `https://www.example.com` page against `https://example.com`

This behavior is a feature, not a limitation, for the current safety posture.

## Components

### `apps/browser-extension/src/background/protocol.ts`

Add:

- request type for `read_autofill_candidates`
- response type for candidate results
- candidate result type definitions

### `apps/browser-extension/src/background/runtime.ts`

Route the new protocol action and keep auth/unlock checks inside background.

### `apps/browser-extension/src/background/unlocked-vault.ts`

Reuse existing output. No major new responsibility is required beyond the metadata already added in the previous slice.

### `apps/browser-extension/src/content/autofill.ts`

Add a helper like:

- `readAutofillCandidates(pageUrl: string)`

Keep the existing `shouldOfferAutofill` helper and coarse status helper unless simplifying them becomes obviously safe in implementation.

## Data Flow

### Exact-match success

1. content script reads `window.location.href`
2. content script calls `read_autofill_candidates`
3. background reads auth state
4. background reads unlock state
5. background parses `pageUrl` and derives `pageOrigin`
6. background reads unlocked login items
7. background filters `item.websiteOrigin === pageOrigin`
8. background returns `ready` and the filtered candidates

### Signed-out request

1. content script calls candidate API
2. background sees `signed_out`
3. background returns `{ status: "signed_out", matches: [] }`

### Locked request

1. content script calls candidate API
2. background sees auth is present but unlock is not active
3. background returns `{ status: "locked", matches: [] }`

### Invalid page URL

1. content script passes an empty or invalid URL
2. background cannot derive a valid origin
3. background returns `{ status: "no_page_url", matches: [] }`

### No exact match

1. content script passes a valid page URL
2. background reads unlocked items successfully
3. no item has the same `websiteOrigin`
4. background returns `{ status: "no_match", matches: [] }`

## Error Handling

### Background

- invalid page URLs should not throw to callers
- malformed or blank item site metadata should simply not match
- any unexpected exception should surface as a generic background error, which content code maps to `unavailable`

### Content

- if the background response is malformed or unsuccessful, map to:

```ts
{ status: "unavailable" }
```

This preserves the current fail-closed behavior.

## Testing

Add or update tests in these areas:

- `apps/browser-extension/tests/background-unlocked-vault.spec.ts`
  - exact origin match returns `ready`
  - different subdomain does not match
  - invalid page URL returns `no_page_url`
  - signed-out and locked behavior still fail closed

- `apps/browser-extension/tests/autofill.spec.ts`
  - `readAutofillCandidates(pageUrl)` sends the correct background request
  - background errors map to `unavailable`

- `apps/browser-extension/tests/background-unlock.spec.ts` or a new protocol-focused spec
  - protocol result shape for the new action is correct

## Risks And Mitigations

### Over-matching

Risk:

- broad domain matching could surface credentials for the wrong surface

Mitigation:

- restrict the first slice to exact origin only

### Exposing too much data too early

Risk:

- returning decrypted passwords during the matching slice would widen the content-script data boundary prematurely

Mitigation:

- return only candidate metadata for now

### Protocol churn

Risk:

- if this API returns full unlocked vault items, future autofill work would inherit a leaky contract

Mitigation:

- define a narrow candidate result shape now

## Success Criteria

This slice is successful when:

- content code can ask for candidates for a specific `pageUrl`
- exact-origin matches return `ready` with candidate metadata
- invalid URLs, signed-out state, locked state, and no-match cases all fail closed
- no DOM fill or password-return behavior is introduced yet
