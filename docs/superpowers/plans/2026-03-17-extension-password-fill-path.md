# Extension Password Fill Path Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a background-gated password fill path so the extension can explicitly fill password fields only when the current page has exactly one exact-origin vault match.

**Architecture:** Keep secret release inside the background runtime by adding a narrow `read_autofill_fill_data` action that validates auth, unlock state, exact-origin matching, and single-match gating before returning one `username/password` payload. Then upgrade content autofill to request that fill data and populate password fields conservatively while preserving the existing explicit trigger and single-match behavior.

**Tech Stack:** TypeScript, Vitest, JSDOM, Chrome extension messaging, background runtime protocol, existing unlocked vault reader

---

## File Structure

- Modify: `apps/browser-extension/src/background/protocol.ts`
  Add request/response types for autofill fill-data reads.
- Modify: `apps/browser-extension/src/background/runtime.ts`
  Add the new fill-data action and single-match password gating logic.
- Modify: `apps/browser-extension/src/content/autofill.ts`
  Add a `readAutofillFillData` helper and extend DOM autofill to fill password fields.
- Modify: `apps/browser-extension/tests/background-unlocked-vault.spec.ts`
  Cover fill-data status cases and single-match password release behavior.
- Modify: `apps/browser-extension/tests/autofill.spec.ts`
  Cover password-field filling, password-only pages, and fail-closed DOM behavior.
- Modify: `docs/superpowers/specs/2026-03-17-extension-password-fill-path-design.md`
  Only if implementation reveals a spec correction worth recording.

## Chunk 1: Add failing background tests for fill-data reads

### Task 1: Extend background tests with password fill-data coverage

**Files:**
- Modify: `apps/browser-extension/tests/background-unlocked-vault.spec.ts`

- [ ] **Step 1: Write the failing fill-data tests**

Add tests that prove:

```ts
it("returns ready autofill fill data when exactly one exact-origin match has a password", async () => {
  // pageUrl matches one item and returns username + password
});

it("returns multiple_matches when more than one exact-origin match exists", async () => {
  // pageUrl matches two items
});

it("returns no_password when the only exact-origin match has no password", async () => {
  // pageUrl matches one item with empty password
});
```

- [ ] **Step 2: Add or extend fail-closed tests**

Cover:

```ts
it("returns signed_out fill data when auth is missing", async () => {});
it("returns locked fill data when unlock is not active", async () => {});
it("returns no_page_url when the page URL is invalid", async () => {});
it("returns no_match when no exact-origin match exists", async () => {});
```

- [ ] **Step 3: Run the focused background test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlocked-vault.spec.ts`
Expected: FAIL because `read_autofill_fill_data` does not exist yet

- [ ] **Step 4: Implement the smallest background fill-data action**

Implementation notes:
- add `read_autofill_fill_data` to the background protocol
- add an `AutofillFillData` result union
- in background:
  - validate auth and unlock state
  - parse `pageUrl`
  - derive `pageOrigin`
  - read unlocked login items
  - filter exact-origin matches
  - return `multiple_matches` when more than one match exists
  - return `no_password` when the sole match has no password
  - return `ready` only with one `username/password` pair

- [ ] **Step 5: Re-run the focused background test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlocked-vault.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit the background fill-data slice**

```bash
git add apps/browser-extension/src/background/protocol.ts apps/browser-extension/src/background/runtime.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts
git commit -m "feat: add extension autofill fill data"
```

## Chunk 2: Add failing content tests for password DOM fill

### Task 2: Extend content autofill for password fields

**Files:**
- Modify: `apps/browser-extension/tests/autofill.spec.ts`
- Modify: `apps/browser-extension/src/content/autofill.ts`

- [ ] **Step 1: Write the failing content tests**

Add tests that prove:

```ts
it("requests autofill fill data for a page URL", async () => {
  // sendMessage receives read_autofill_fill_data
});

it("fills both username and password when fill data is ready", async () => {
  // page has username and password inputs
});

it("fills only the password when only a password field exists", async () => {
  // page has a visible password field only
});
```

- [ ] **Step 2: Add fail-closed content tests**

Cover:

```ts
it("does not mutate the DOM when fill data reports multiple_matches", async () => {});
it("does not mutate the DOM when fill data reports no_password", async () => {});
it("maps malformed fill-data responses to unavailable", async () => {});
```

- [ ] **Step 3: Run the focused autofill test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/autofill.spec.ts`
Expected: FAIL because `readAutofillFillData` and password fill behavior do not exist yet

- [ ] **Step 4: Implement the smallest content fill-data helper**

Implementation notes:
- add `readAutofillFillData(pageUrl)`
- validate the background response narrowly
- map malformed or failed responses to `unavailable`

- [ ] **Step 5: Upgrade DOM autofill to fill password fields**

Implementation notes:
- request fill data from `readAutofillFillData(pageUrl)`
- if status is not `ready`, return it directly
- detect password fields only via `input[type="password"]`
- fill username and password independently
- dispatch `input` and `change` after each successful fill
- return `no_fillable_fields` only if neither field is fillable

- [ ] **Step 6: Re-run the focused autofill test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/autofill.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit the content password-fill slice**

```bash
git add apps/browser-extension/src/content/autofill.ts apps/browser-extension/tests/autofill.spec.ts
git commit -m "feat: add extension password autofill"
```

## Chunk 3: Verify extension compatibility

### Task 3: Run focused extension coverage

**Files:**
- Modify: any extension files only if focused verification reveals a real regression

- [ ] **Step 1: Run focused extension tests**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlock.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/autofill.spec.ts`
Expected: PASS

- [ ] **Step 2: Fix only compatibility regressions**

Implementation notes:
- do not widen candidate reads to include passwords
- do not introduce automatic page-load fill
- preserve popup auth and unlock behavior

- [ ] **Step 3: Re-run the focused extension suite**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlock.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/autofill.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit any compatibility fixes**

```bash
git add <exact files>
git commit -m "test: finalize extension password fill path"
```

## Chunk 4: Full verification and handoff

### Task 4: Run full repository verification

**Files:**
- Modify: any files needed only if full verification reveals regressions

- [ ] **Step 1: Run project lint**

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

- [ ] **Step 2: Run project tests**

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

- [ ] **Step 3: Run diff hygiene**

Run: `git diff --check`
Expected: PASS

- [ ] **Step 4: Commit any final fixes from full verification**

```bash
git add <exact files>
git commit -m "test: finalize extension password fill path"
```

- [ ] **Step 5: Summarize results for review**

Capture:
- the new `read_autofill_fill_data` action
- exact conditions under which background releases password fill data
- the updated `attemptAutofillForCurrentPage` behavior
- explicit note that automatic page-load fill is still out of scope
