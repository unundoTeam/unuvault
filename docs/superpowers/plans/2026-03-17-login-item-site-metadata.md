# Login Item Site Metadata Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single `website_url` field to login items, validate and sync it through the web vault flow, and expose normalized site metadata to extension background readers without implementing true matching or DOM autofill yet.

**Architecture:** Introduce one shared login-payload helper in `packages/api-client` for payload normalization and website URL parsing. Update API, web, and extension consumers to use that helper, then extend web vault editing and extension background reading so site metadata flows end-to-end through the existing sync/cache path.

**Tech Stack:** TypeScript, React, Vitest, Next.js, Fastify, `chrome.storage.local`, shared workspace packages

---

## File Structure

- Modify: `packages/api-client/src/vault.ts`
  Add `website_url` to `VaultLoginPayload`.
- Create: `packages/api-client/src/login-payload.ts`
  Own shared login-payload normalization and website metadata parsing.
- Modify: `packages/api-client/tests/vault-client.spec.ts`
  Cover the new field and shared helper behavior.
- Modify: `apps/api/src/services/vault-service.ts`
  Reuse the shared payload helper.
- Modify: `apps/api/tests/login-payload-fixture.ts`
  Include the new field in fixtures.
- Modify: `apps/web/src/components/vault/login-payload.ts`
  Keep password helpers but import shared normalization.
- Modify: `apps/web/src/components/vault/use-vault-sync.ts`
  Accept and persist `websiteUrl` in create and update payloads.
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
  Add `Website` create/edit inputs and validation wiring.
- Modify: `apps/web/tests/vault-page.spec.tsx`
  Cover valid, invalid, blank, and edit flows for `website_url`.
- Modify: `apps/browser-extension/src/popup/login-payload.ts`
  Reuse the shared payload helper or thinly wrap it.
- Modify: `apps/browser-extension/src/popup/popup-vault-storage.ts`
  Accept stored items that now include `website_url` while preserving old-item compatibility.
- Modify: `apps/browser-extension/src/background/unlocked-vault.ts`
  Return normalized site metadata alongside unlocked login data.
- Modify: `apps/browser-extension/tests/popup-vault-storage.spec.ts`
  Cover cache validation compatibility for `website_url`.
- Modify: `apps/browser-extension/tests/background-unlocked-vault.spec.ts`
  Cover returned `websiteUrl`, `websiteOrigin`, and `websiteHostname`.

## Chunk 1: Add the shared login-payload helper

### Task 1: Add failing tests for shared payload normalization

**Files:**
- Modify: `packages/api-client/tests/vault-client.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that prove:

```ts
it("normalizes missing website_url to an empty string", () => {
  expect(normalizeVaultLoginPayload({ schema_version: 1 })).toMatchObject({
    website_url: "",
  });
});

it("normalizes website input by defaulting missing schemes to https", () => {
  expect(normalizeVaultWebsiteUrl("github.com")).toBe("https://github.com/");
});

it("derives origin and hostname from a normalized website URL", () => {
  expect(parseVaultWebsiteMetadata("https://github.com/login")).toEqual({
    websiteUrl: "https://github.com/login",
    websiteOrigin: "https://github.com",
    websiteHostname: "github.com",
  });
});
```

- [ ] **Step 2: Run the focused shared-helper test to verify it fails**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts`
Expected: FAIL because the shared login-payload helper does not exist yet

- [ ] **Step 3: Implement the smallest shared helper**

Implementation notes:
- create `packages/api-client/src/login-payload.ts`
- keep payload normalization and website URL parsing together
- return `""` for invalid or missing website values at the low-level normalizer
- update `VaultLoginPayload` in `packages/api-client/src/vault.ts`

- [ ] **Step 4: Re-run the focused shared-helper test**

Run: `./node_modules/.bin/vitest --run packages/api-client/tests/vault-client.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the shared helper**

```bash
git add packages/api-client/src/vault.ts packages/api-client/src/login-payload.ts packages/api-client/tests/vault-client.spec.ts
git commit -m "feat: add shared login site metadata helpers"
```

### Task 2: Move API normalization onto the shared helper

**Files:**
- Modify: `apps/api/src/services/vault-service.ts`
- Modify: `apps/api/tests/login-payload-fixture.ts`
- Modify: relevant API tests under `apps/api/tests`

- [ ] **Step 1: Add failing API compatibility coverage**

Add tests that prove:

```ts
it("returns website_url as an empty string for old rows", async () => {
  // row payload omits website_url
});

it("preserves website_url on synced items", async () => {
  // payload includes website_url and round-trips through the sync service
});
```

- [ ] **Step 2: Run the focused API tests to verify they fail**

Run: `./node_modules/.bin/vitest --run apps/api/tests`
Expected: FAIL because the service still uses a local payload parser without `website_url`

- [ ] **Step 3: Implement the smallest API integration**

Implementation notes:
- remove the local payload-shape duplication in `vault-service.ts`
- import the shared normalizer from `packages/api-client`
- update login-payload fixtures to include `website_url`
- keep backward compatibility for payloads that omit the new field

- [ ] **Step 4: Re-run the focused API tests**

Run: `./node_modules/.bin/vitest --run apps/api/tests`
Expected: PASS

- [ ] **Step 5: Commit the API payload integration**

```bash
git add apps/api/src/services/vault-service.ts apps/api/tests
git commit -m "feat: normalize login website metadata in api sync"
```

## Chunk 2: Add website editing to the web vault

### Task 3: Add failing web tests for create and edit website fields

**Files:**
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing web tests**

Add tests that prove:

```tsx
it("saves website_url when creating a login item", async () => {
  // fill Website with "github.com" and expect synced payload to include https://github.com/
});

it("blocks save when the website URL is invalid", async () => {
  // fill Website with invalid text and expect validation error
});

it("prefills and updates website_url in edit mode", async () => {
  // existing item includes website_url, edit form shows it, save writes the updated value
});
```

- [ ] **Step 2: Run the focused web test to verify it fails**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: FAIL because the web vault has no website field or validation yet

- [ ] **Step 3: Implement the smallest web create/edit support**

Implementation notes:
- add create/edit draft state for `websiteUrl`
- extend `VaultLoginFields` in `use-vault-sync.ts`
- use the shared normalizer when constructing payloads
- keep blank values allowed
- show `Enter a valid website URL.` when the user typed a non-empty invalid value

- [ ] **Step 4: Re-run the focused web test**

Run: `./node_modules/.bin/vitest --run apps/web/tests/vault-page.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit the web vault website field**

```bash
git add apps/web/src/components/vault/login-payload.ts apps/web/src/components/vault/use-vault-sync.ts apps/web/src/components/vault/vault-panel.tsx apps/web/tests/vault-page.spec.tsx
git commit -m "feat: add website metadata to web vault items"
```

## Chunk 3: Extend extension cache parsing and unlocked reader output

### Task 4: Add failing extension tests for `website_url` compatibility

**Files:**
- Modify: `apps/browser-extension/tests/popup-vault-storage.spec.ts`
- Modify: `apps/browser-extension/tests/background-unlocked-vault.spec.ts`

- [ ] **Step 1: Write the failing extension tests**

Add tests that prove:

```ts
it("accepts cached items that include website_url", async () => {
  // stored item survives readPopupVaultItems()
});

it("still reads old cached items that omit website_url", async () => {
  // old shape remains readable after normalization
});

it("returns derived website metadata from unlocked login items", async () => {
  // expect websiteUrl, websiteOrigin, websiteHostname in reader output
});
```

- [ ] **Step 2: Run the focused extension tests to verify they fail**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup-vault-storage.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts`
Expected: FAIL because the extension parser and unlocked reader do not know about `website_url`

- [ ] **Step 3: Implement the smallest extension site-metadata read path**

Implementation notes:
- update popup storage validation to accept the new payload field without breaking old cached items
- move popup payload parsing onto the shared helper or a thin wrapper
- update `unlocked-vault.ts` to derive `websiteOrigin` and `websiteHostname`
- keep blank website values safe and non-throwing

- [ ] **Step 4: Re-run the focused extension tests**

Run: `./node_modules/.bin/vitest --run apps/browser-extension/tests/popup-vault-storage.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the extension site-metadata reader**

```bash
git add apps/browser-extension/src/popup/login-payload.ts apps/browser-extension/src/popup/popup-vault-storage.ts apps/browser-extension/src/background/unlocked-vault.ts apps/browser-extension/tests/popup-vault-storage.spec.ts apps/browser-extension/tests/background-unlocked-vault.spec.ts
git commit -m "feat: expose login site metadata in extension readers"
```

## Chunk 4: Full verification and cleanup

### Task 5: Run full verification on the integrated slice

**Files:**
- Modify: any files needed to address failures discovered during full verification

- [ ] **Step 1: Run the full project lint**

Run: `bash scripts/testing/lint-runner.sh`
Expected: PASS

- [ ] **Step 2: Run the full project test suite**

Run: `bash scripts/testing/test-runner.sh`
Expected: PASS

- [ ] **Step 3: Run diff hygiene checks**

Run: `git diff --check`
Expected: PASS

- [ ] **Step 4: Commit any final verification fixes**

```bash
git add <exact files>
git commit -m "test: finalize login item site metadata"
```

- [ ] **Step 5: Summarize results and hand off for review**

Capture:
- which files changed
- focused tests that covered each chunk
- full lint/test results
- explicit note that true site matching and DOM autofill are still out of scope
