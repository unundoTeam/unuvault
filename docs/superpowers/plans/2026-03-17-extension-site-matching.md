# Extension Site Matching Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a background-owned site-matching API so the browser extension can return real vault candidates for the current page URL using strict `origin === websiteOrigin` matching.

**Architecture:** Extend the background protocol with a `read_autofill_candidates` action, implement exact-origin filtering in the background runtime on top of the unlocked vault reader, and add a content-side helper that requests page-specific candidates without exposing decrypted passwords or performing DOM autofill.

**Tech Stack:** TypeScript, Vitest, Chrome extension messaging, background runtime protocol, shared login payload metadata

---

## File Structure

- Modify: `apps/browser-extension/src/background/protocol.ts`
  Add request/response types for autofill candidate reads.
- Modify: `apps/browser-extension/src/background/runtime.ts`
  Route the new background action and keep auth/unlock/match checks in background.
- Optionally create: `apps/browser-extension/src/background/autofill-matching.ts`
  If matching logic feels too dense for `runtime.ts`, isolate exact-origin filtering here.
- Modify: `apps/browser-extension/src/content/autofill.ts`
  Add page-specific candidate reading.
- Modify: `apps/browser-extension/tests/background-unlocked-vault.spec.ts`
  Cover exact-origin match, no-match, invalid URL, signed-out, and locked behavior.
- Modify: `apps/browser-extension/tests/autofill.spec.ts`
  Cover content-side candidate requests and `unavailable` fallback.
- Modify: any protocol-focused tests if additional request coverage is needed.

## Chunk 1: Add failing tests for background candidate matching

### Task 1: Add failing background tests for exact-origin matching

**Files:**
- Modify: `apps/browser-extension/tests/background-unlocked-vault.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that prove:

```ts
it("returns ready with candidates when page origin exactly matches websiteOrigin", async () => {
  // pageUrl https://github.com/login matches item.websiteOrigin https://github.com
});

it("returns no_match when page origin differs", async () => {
  // pageUrl https://app.github.com does not match https://github.com
});

it("returns no_page_url when pageUrl is invalid", async () => {
  // blank or malformed pageUrl
});
```

- [ ] **Step 2: Run the focused background test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlocked-vault.spec.ts`
Expected: FAIL because no candidate API exists yet

- [ ] **Step 3: Implement the smallest protocol types and background matcher**

Implementation notes:
- add `read_autofill_candidates` request type with `pageUrl`
- add a narrow candidate response/result type
- in background, check auth and unlock first
- parse `pageUrl` with `new URL(pageUrl)`
- filter unlocked login items where `item.websiteOrigin === pageOrigin`
- return `signed_out`, `locked`, `no_page_url`, `no_match`, or `ready`

- [ ] **Step 4: Re-run the focused background test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlocked-vault.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the background matching slice**

```bash
git add apps/browser-extension/src/background/protocol.ts apps/browser-extension/src/background/runtime.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts
git commit -m "feat: add extension site matching protocol"
```

## Chunk 2: Add content-side candidate requests

### Task 2: Add failing content autofill tests

**Files:**
- Modify: `apps/browser-extension/tests/autofill.spec.ts`

- [ ] **Step 1: Write the failing content tests**

Add tests that prove:

```ts
it("requests autofill candidates for a page URL", async () => {
  const result = await readAutofillCandidates("https://github.com/login");
  expect(sendMessage).toHaveBeenCalledWith({
    type: "read_autofill_candidates",
    pageUrl: "https://github.com/login",
  });
  expect(result.status).toBe("ready");
});

it("maps background failures to unavailable", async () => {
  // sendMessage rejects or returns a malformed response
});
```

- [ ] **Step 2: Run the focused content test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/autofill.spec.ts`
Expected: FAIL because `readAutofillCandidates` does not exist yet

- [ ] **Step 3: Implement the smallest content-side candidate helper**

Implementation notes:
- keep `shouldOfferAutofill`
- keep `readAutofillStatus` unless simplification is clearly safe
- add `readAutofillCandidates(pageUrl: string)`
- validate the background response shape narrowly
- map all failures to `{ status: "unavailable" }`

- [ ] **Step 4: Re-run the focused content test**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/autofill.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the content matching client**

```bash
git add apps/browser-extension/src/content/autofill.ts apps/browser-extension/tests/autofill.spec.ts
git commit -m "feat: add content autofill candidate reads"
```

## Chunk 3: Broader verification for the matching boundary

### Task 3: Re-run focused extension coverage for auth/unlock compatibility

**Files:**
- Modify: any extension test files needed if protocol additions require updated fixtures

- [ ] **Step 1: Run focused extension tests that cover the new boundary**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlock.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/autofill.spec.ts`
Expected: PASS

- [ ] **Step 2: Fix only compatibility regressions revealed by the focused suite**

Implementation notes:
- do not widen scope into DOM fill
- keep candidate data free of decrypted password values
- preserve existing popup unlock and auth behavior

- [ ] **Step 3: Re-run the focused extension suite**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlock.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/autofill.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit any compatibility fixes**

```bash
git add <exact files>
git commit -m "test: finalize extension site matching"
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
git commit -m "test: finalize extension site matching"
```

- [ ] **Step 5: Summarize results for review**

Capture:
- background protocol changes
- candidate result shape
- strict-origin matching behavior
- explicit note that DOM autofill is still out of scope
