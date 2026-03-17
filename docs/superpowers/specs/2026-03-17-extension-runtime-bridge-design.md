# Extension Runtime Bridge Design

## Summary

The browser extension now has a real background protocol layer, popup/background clients, and content autofill helpers, but it still lacks a real extension runtime entrypoint. Today, `handleBackgroundRequest()` is exercised through tests and local fallback calls, not through an actual service worker receiving `chrome.runtime` messages.

That gap matters because the password autofill authorization model now depends on background-owned caller context. The current code can model `trustedPageUrl` in tests and fallback paths, but there is still no real `runtime.onMessage` bridge that derives trusted caller state from `sender.tab.url`.

This slice adds the minimum viable browser-extension runtime skeleton:

- a manifest
- a background service worker entrypoint
- a real `runtime.onMessage` bridge
- sender-derived caller context
- existing popup/content clients routed through the real background bridge

The goal is not to finish packaging the entire extension. The goal is to make the existing auth, unlock, popup, and autofill protocol run through a real background runtime, especially for password reads.

## Scope

### In scope

- add a minimal MV3 manifest for the current extension surfaces
- add a background service worker entrypoint
- register `chrome.runtime.onMessage` and route requests into `handleBackgroundRequest()`
- derive `BackgroundCallerContext` from `sender`
- map content callers to `trustedPageUrl = sender.tab?.url`
- keep `handleBackgroundRequest()` as a pure logic layer
- keep popup and content clients on the existing request API
- preserve current fallback behavior for tests and non-extension execution
- add focused tests for sender-to-caller-context mapping and message routing

### Out of scope

- changing auth, unlock, or vault sync product behavior
- new popup UI
- automatic content-script registration changes beyond the minimum required manifest support
- frame traversal, tab tracking, or per-tab session state
- changing candidate matching rules
- reworking save-prompt or content injection strategy
- production bundling/publishing workflow beyond the minimum runtime entry shape

## Chosen Approach

The chosen approach is **a thin service worker adapter over the existing background runtime**.

That means:

- `runtime.ts` remains the background domain layer
- the new background entry is responsible only for:
  - receiving messages
  - deriving caller context from `sender`
  - calling `handleBackgroundRequest(request, deps, callerContext)`
  - returning the response
- popup/content code continues to call `chrome.runtime.sendMessage` with the same request shapes

This is preferred over moving Chrome-specific logic into `runtime.ts` because the current runtime is already well structured for direct testing. It is preferred over a more ambitious runtime refactor because the immediate requirement is to make the existing security boundary real, not to redesign the extension architecture.

## Architecture

### Manifest

Add a minimum MV3 manifest for the current surfaces:

- `manifest_version: 3`
- `name`, `version`
- `background.service_worker`
- `action.default_popup`
- minimal `permissions`
- minimal `host_permissions` needed by current content behavior

The manifest should support:

- popup access
- background message handling
- content-side message sending for autofill

This slice should not add permissions that are not required by the current code.

### Background service worker entry

Add `apps/browser-extension/src/background/index.ts`.

Responsibilities:

- define a helper that converts Chrome message sender metadata into `BackgroundCallerContext`
- register `chrome.runtime.onMessage`
- validate the inbound request shape at a coarse level
- call `handleBackgroundRequest(request, undefined, callerContext)`
- return the promise result to the caller

This file is the only place where Chrome sender types should leak into the runtime flow.

### Caller context

Continue using:

```ts
type BackgroundCallerContext = {
  source: "content" | "popup" | "internal";
  trustedPageUrl?: string | null;
};
```

Derivation rules:

- if `sender.tab?.url` exists:
  - `source = "content"`
  - `trustedPageUrl = sender.tab.url`
- otherwise if the sender is an extension page:
  - `source = "popup"`
  - `trustedPageUrl = null`
- otherwise:
  - `source = "internal"`
  - `trustedPageUrl = null`

This keeps password release decisions on trusted extension runtime metadata rather than caller-supplied request fields.

### Runtime/domain layer

`apps/browser-extension/src/background/runtime.ts` should remain Chrome-agnostic. It should keep:

- request switching
- dependency injection
- caller-context-aware authorization
- current auth/unlock/autofill logic

The only change needed for this slice is to make sure the real background bridge is the primary production path, while tests can still call the runtime directly.

### Client adapters

Keep:

- `apps/browser-extension/src/content/autofill.ts`
- `apps/browser-extension/src/popup/background-client.ts`

as thin clients that:

- prefer `chrome.runtime.sendMessage`
- fall back to direct runtime calls only when the Chrome runtime is absent

This preserves the existing tests without forcing the new service worker entry into every isolated unit test.

## Security Model

The key security invariant is:

**request bodies do not decide whether password autofill is allowed.**

`read_autofill_fill_data` should continue to authorize secrets only from:

- `source === "content"`
- `trustedPageUrl` derived from background-side sender metadata

Popup callers should never satisfy this condition. Internal callers should also fail closed unless explicitly given a trusted content-page context in tests.

This makes the current password autofill boundary meaningful in real runtime execution instead of only in fallback/test execution.

## Data Flow

### Popup request

1. popup calls `chrome.runtime.sendMessage`
2. background entry receives request and sender
3. sender is mapped to `source: "popup"`
4. request is forwarded to `handleBackgroundRequest`
5. popup-safe actions succeed, content-only secret actions fail closed

### Content autofill request

1. content calls `chrome.runtime.sendMessage`
2. background entry receives request and sender
3. sender is mapped to `source: "content"` with `trustedPageUrl = sender.tab.url`
4. request is forwarded to `handleBackgroundRequest`
5. password fill-data is returned only if current auth, unlock, and exact-origin rules succeed

## Testing Strategy

### Background bridge tests

Add tests for:

- content sender -> `source: "content"` and `trustedPageUrl`
- popup sender -> `source: "popup"`
- `read_autofill_fill_data` failing closed for popup senders
- content sender with matching tab URL releasing fill data

### Regression coverage

Re-run:

- popup auth flow tests
- popup unlock tests
- background unlock tests
- autofill candidate/fill-data tests

### Full verification

Run:

- `bash scripts/testing/lint-runner.sh`
- `bash scripts/testing/test-runner.sh`
- `git diff --check`

## Risks

### No existing packaging structure

The repo currently has no manifest or service worker entry. That means this slice must introduce the minimal extension runtime skeleton without overreaching into a broader packaging project.

### Sender shape differences

`sender.url` and `sender.tab?.url` can differ by source. The design intentionally treats only `sender.tab?.url` as trusted content page context for password reads. That keeps the rule simple and fail-closed.

### Test harness divergence

Many current tests rely on direct runtime fallback. This slice should preserve that path for unit tests while still making the real runtime bridge the production path.

## Acceptance Criteria

- a minimal manifest exists for the extension
- a background service worker entry exists and registers `runtime.onMessage`
- sender metadata is mapped into `BackgroundCallerContext`
- password fill-data authorization uses sender-derived context in real runtime execution
- popup and content clients continue to function through the current request API
- focused extension tests and full repo verification pass
