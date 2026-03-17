# Extension Runtime Bridge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the background runtime bridge logic so popup/content request handling can derive trusted caller context from Chrome sender metadata, while deferring manifest/build wiring to a later packaging slice.

**Architecture:** Keep `apps/browser-extension/src/background/runtime.ts` as the pure background domain layer. Add a background entrypoint that registers `chrome.runtime.onMessage`, derives `BackgroundCallerContext` from `sender`, and routes requests into the existing runtime. Preserve fallback behavior for isolated unit tests. Do not land manifest/popup runtime files until the repo has a real extension packaging pipeline.

**Tech Stack:** TypeScript, Vitest, Chrome extension MV3 messaging, JSDOM, existing background protocol/runtime

---

## File Structure

- Create: `apps/browser-extension/src/background/index.ts`
  Register the real `runtime.onMessage` bridge and map sender metadata into caller context.
- Modify: `apps/browser-extension/src/background/runtime.ts`
  Export caller-context types/helpers as needed and keep runtime request handling Chrome-agnostic.
- Modify: `apps/browser-extension/src/content/autofill.ts`
  Preserve `sendMessage` usage while keeping fallback support aligned with runtime caller-context rules.
- Modify: `apps/browser-extension/src/popup/background-client.ts`
  Preserve `sendMessage` usage while keeping fallback support aligned with runtime caller-context rules.
- Create or Modify: `apps/browser-extension/tests/background-message-bridge.spec.ts`
  Add focused tests for sender-derived caller context and runtime message routing.
- Modify: `apps/browser-extension/tests/background-unlocked-vault.spec.ts`
  Reuse runtime tests where needed if bridge behavior exposes mismatches.
- Modify: `apps/browser-extension/tests/popup.spec.tsx`
  Only if real bridge integration reveals request-shape regressions.
- Modify: `apps/browser-extension/tests/autofill.spec.ts`
  Only if content-side bridge assumptions need updating.

## Chunk 1: Add the failing bridge tests

### Task 1: Write the minimal service-worker routing tests first

**Files:**
- Create: `apps/browser-extension/tests/background-message-bridge.spec.ts`

- [ ] **Step 1: Write a failing test for content sender mapping**

Add a test like:

```ts
it("maps sender.tab.url into trusted content caller context", async () => {
  // onMessage callback receives a content-style sender
  // handleBackgroundRequest is called with source=content and trustedPageUrl
});
```

- [ ] **Step 2: Write a failing test for popup sender mapping**

Add a test like:

```ts
it("maps extension-page senders to popup caller context", async () => {
  // sender has no tab url
  // handleBackgroundRequest is called with source=popup
});
```

- [ ] **Step 3: Write a failing test for popup fail-closed password reads**

Add a test like:

```ts
it("fails closed on password fill-data reads from popup senders", async () => {
  // popup sender hits read_autofill_fill_data
  // response is no_page_url or equivalent fail-closed state
});
```

- [ ] **Step 4: Run the new focused bridge test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-message-bridge.spec.ts`
Expected: FAIL because the service worker bridge does not exist yet

## Chunk 2: Add the real background service worker entry

### Task 2: Implement the minimum message bridge

**Files:**
- Create: `apps/browser-extension/src/background/index.ts`
- Modify: `apps/browser-extension/src/background/runtime.ts`

- [ ] **Step 1: Add a sender-to-caller-context helper**

Implementation notes:
- derive `source: "content"` only from `sender.tab?.url`
- derive `source: "popup"` from extension-page senders without tab URL
- default everything else to `source: "internal"`

- [ ] **Step 2: Register `chrome.runtime.onMessage`**

Implementation notes:
- route each message into `handleBackgroundRequest(request, undefined, callerContext)`
- return `true` for async handling if needed by the MV3 listener shape
- keep the adapter thin; do not move domain logic out of `runtime.ts`

- [ ] **Step 3: Export any runtime helper types needed by the bridge tests**

Implementation notes:
- export `BackgroundCallerContext` if the bridge test needs it
- keep Chrome-specific types out of `runtime.ts`

- [ ] **Step 4: Run the focused bridge tests**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-message-bridge.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the bridge entry slice**

```bash
git add apps/browser-extension/src/background/index.ts apps/browser-extension/src/background/runtime.ts apps/browser-extension/tests/background-message-bridge.spec.ts
git commit -m "feat: add extension background message bridge"
```

## Chunk 3: Keep packaging explicitly out of scope

### Task 3: Leave manifest/build wiring for a later slice

**Files:**
- Modify: `docs/superpowers/specs/2026-03-17-extension-runtime-bridge-design.md`
- Modify: `docs/superpowers/plans/2026-03-17-extension-runtime-bridge.md`

- [ ] **Step 1: Document the packaging gap explicitly**

Record that:
- the repo still lacks a real extension build/publish pipeline
- manifest entries must point at built JavaScript assets, not source `.ts` / `.tsx`
- this slice therefore stops at the bridge module and tests

- [ ] **Step 2: Verify the codebase no longer contains placeholder runtime assets for this slice**

Check:
- no new manifest is added in this branch
- no popup HTML entry points at source TSX
- the runtime bridge remains testable without pretending the extension is fully loadable

## Chunk 4: Reconcile clients with the real bridge

### Task 4: Keep popup/content clients compatible with real runtime execution

**Files:**
- Modify: `apps/browser-extension/src/content/autofill.ts`
- Modify: `apps/browser-extension/src/popup/background-client.ts`
- Modify: `apps/browser-extension/tests/autofill.spec.ts`
- Modify: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Verify content still prefers `chrome.runtime.sendMessage`**

Check:
- `readAutofillCandidates`
- `readAutofillFillData`
- fallback only when no runtime is available

- [ ] **Step 2: Verify popup still prefers `chrome.runtime.sendMessage`**

Check:
- auth state reads
- unlock reads
- hydrate requests
- sign-in / sign-out / lock / unlock actions

- [ ] **Step 3: Adjust tests only if the real bridge shapes expose mismatches**

Implementation notes:
- do not change request APIs without necessity
- keep fallback-based unit tests intact

- [ ] **Step 4: Run focused popup/content tests**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/autofill.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit any client compatibility fixes**

```bash
git add apps/browser-extension/src/content/autofill.ts apps/browser-extension/src/popup/background-client.ts apps/browser-extension/tests/autofill.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/background-unlocked-vault.spec.ts
git commit -m "test: align clients with extension runtime bridge"
```

## Chunk 5: Full verification and handoff

### Task 5: Verify the branch is clean and ready for implementation review

**Files:**
- Modify: any files needed only if verification reveals regressions

- [ ] **Step 1: Run focused extension suite**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/background-unlock.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts apps/browser-extension/tests/background-message-bridge.spec.ts apps/browser-extension/tests/popup.spec.tsx apps/browser-extension/tests/autofill.spec.ts`
Expected: PASS

- [ ] **Step 2: Run project lint**

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

- [ ] **Step 3: Run project tests**

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

- [ ] **Step 4: Run diff hygiene**

Run: `git diff --check`
Expected: PASS

- [ ] **Step 5: Commit any final verification fixes**

```bash
git add <exact files>
git commit -m "test: finalize extension runtime bridge"
```

- [ ] **Step 6: Summarize results for review**

Capture:
- the new background service worker entry module
- the sender-to-caller-context mapping
- explicit note that manifest/build wiring is deferred until extension packaging exists
- explicit note that password reads now depend on sender-derived context in bridge execution/tests
