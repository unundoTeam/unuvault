# Extension DOM Autofill Username Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a content-side DOM autofill helper that fills a username field only when the current page has exactly one exact-origin vault match.

**Architecture:** Keep the background boundary unchanged and build the first real DOM autofill behavior entirely on top of `readAutofillCandidates(pageUrl)`. Add a conservative content helper that finds a safe username field, writes the matched username, dispatches `input/change`, and fail-closes on zero matches, multiple matches, missing fields, or unavailable auth/unlock state.

**Tech Stack:** TypeScript, Vitest, JSDOM, Chrome extension messaging, existing background autofill candidate protocol

---

## File Structure

- Modify: `apps/browser-extension/src/content/autofill.ts`
  Add a high-level username autofill attempt helper, conservative field detection helpers, and DOM event dispatch behavior.
- Modify: `apps/browser-extension/tests/autofill.spec.ts`
  Add DOM-focused tests for single-match fills, multiple matches, no-fill states, and fail-closed status passthrough.
- Modify: `docs/superpowers/specs/2026-03-17-extension-dom-autofill-username-design.md`
  Only if implementation reveals a spec correction that must be documented.

## Chunk 1: Add failing DOM autofill tests

### Task 1: Extend content autofill tests with username fill coverage

**Files:**
- Modify: `apps/browser-extension/tests/autofill.spec.ts`

- [ ] **Step 1: Write the failing single-match autofill tests**

Add tests that prove:

```ts
it("fills a username field when exactly one candidate matches", async () => {
  // page has one fillable username field
  // background returns exactly one ready match
  // helper writes the username and returns filled
});

it("dispatches input and change after filling the username", async () => {
  // capture bubbled events and confirm both fire
});
```

- [ ] **Step 2: Write the failing no-fill tests**

Add tests that prove:

```ts
it("returns multiple_matches and does not mutate the DOM when more than one candidate matches", async () => {
  // ready + 2 matches
});

it("returns no_fillable_fields when no safe username field exists", async () => {
  // page has no eligible visible username/email input
});

it("passes through locked and unavailable states without mutating the DOM", async () => {
  // background returns locked or malformed/unavailable
});
```

- [ ] **Step 3: Run the focused autofill test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/autofill.spec.ts`
Expected: FAIL because `attemptAutofillForCurrentPage` does not exist yet

- [ ] **Step 4: Commit nothing yet**

Stay in red until the helper exists and the tests pass.

## Chunk 2: Implement the minimal DOM autofill helper

### Task 2: Add username-only autofill behavior

**Files:**
- Modify: `apps/browser-extension/src/content/autofill.ts`
- Modify: `apps/browser-extension/tests/autofill.spec.ts`

- [ ] **Step 1: Implement the smallest public helper**

Add a helper shaped like:

```ts
attemptAutofillForCurrentPage({
  document,
  pageUrl,
})
```

Implementation notes:
- call `readAutofillCandidates(pageUrl)`
- if result is not `ready`, return it directly
- if `matches.length === 0`, return `no_match`
- if `matches.length > 1`, return `multiple_matches`
- if exactly one match exists, continue to field detection

- [ ] **Step 2: Implement conservative username field detection**

Implementation notes:
- prefer `autocomplete="username"`
- then `autocomplete="email"`
- then `type="email"`
- then `name` or `id` containing `user`, `email`, or `login`
- then the first visible `input[type="text"]`
- ignore `disabled`, `readOnly`, `type="hidden"`, and invisible inputs

- [ ] **Step 3: Implement the minimal fill behavior**

Implementation notes:
- require a non-empty candidate username
- assign `input.value = candidate.username`
- dispatch `input` and `change` with `bubbles: true`
- return:

```ts
{
  status: "filled",
  filledUsername: true,
  filledPassword: false,
}
```

- [ ] **Step 4: Re-run the focused autofill test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/autofill.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the content autofill slice**

```bash
git add apps/browser-extension/src/content/autofill.ts apps/browser-extension/tests/autofill.spec.ts
git commit -m "feat: add extension username autofill"
```

## Chunk 3: Verify compatibility with existing extension boundaries

### Task 3: Run focused extension coverage

**Files:**
- Modify: any extension test files only if a real compatibility regression appears

- [ ] **Step 1: Run focused extension tests**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlock.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/autofill.spec.ts`
Expected: PASS

- [ ] **Step 2: Fix only compatibility regressions**

Implementation notes:
- do not widen background protocol to include passwords
- do not add automatic page-load behavior
- preserve existing `readAutofillStatus` and `readAutofillCandidates`

- [ ] **Step 3: Re-run the focused extension suite**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlock.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/autofill.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit any compatibility fixes**

```bash
git add <exact files>
git commit -m "test: finalize extension username autofill"
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
git commit -m "test: finalize extension username autofill"
```

- [ ] **Step 5: Summarize results for review**

Capture:
- the new `attemptAutofillForCurrentPage` API
- exact conditions under which username autofill happens
- explicit note that password fill is still out of scope
- focused and full verification evidence
