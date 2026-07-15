# PR #78 Invite and Receipt Remediation Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Clear every failed pairing attempt from memory and UI, align current physical-receipt documentation on the `imported` sentinel, and retain the 2026-07-08 `paired` record only as historical transport evidence.
**Architecture:** Keep the existing `@MainActor` pairing state machine and SwiftUI composition. Add one private reset helper that clears failed-attempt input, parsed invite, handoff, receipt, and Mac-derived display fields without clearing the safe failure copy or allowlisted diagnostic; cover exchange and import failures through focused model and rendered-view tests. Lock current-versus-historical receipt wording with the existing workspace contract suite.
**Tech Stack:** Swift 6, SwiftUI, XCTest, XcodeGen, `xcodebuild`, Bash test wrappers, TypeScript, Vitest, pnpm, and Markdown.
## Global Constraints
- Work only in the existing isolated unuvault worktree for PR #78; do not touch the `unuOS` checkout.
- Follow test-driven development: observe each focused assertion fail before adding its production or documentation change.
- Failure reset must clear `inviteText`, private `invite`, `handoff`, `importReceipt`, `macDisplayName`, `macEndpointText`, and `macInviteDetailText`.
- Failure reset must preserve the selected safe `state`, exact safe `statusMessage`, and allowlisted `pairingFailureDiagnostic`.
- Never place an underlying error description, raw invite, endpoint, credential value, handoff material, or secret in UI, logs, assertions, or receipts.
- `.invalid`, `.failed`, and `.importFailed` keep `canPair == false`; the existing editor is visible and empty, and a newly pasted valid invite can return the model to `.ready`.
- Preserve success, single-flight, post-import reload, Dynamic Type, and accessibility behavior.
- This is a state reset and documentation correction only: add no control, navigation change, Pencil change, cryptographic primitive, persistence schema, migration, or telemetry field.
- Current harness instructions must expect `UNUVAULT_IOS_PAIRING_RECEIPT imported` in both README files.
- The recorded 2026-07-08 `UNUVAULT_IOS_PAIRING_RECEIPT paired ... material=AES-GCM-256` line remains historical transport-only evidence and must not be rewritten as import proof.
- Do not push, update PR #78, or merge as part of this plan; those remain separately approval-gated.
---
## Files and interfaces
- Modify: `apps/ios/App/Sources/Features/Pairing/PairingInviteReceiveView.swift`
  - Add private `discardFailedAttempt()` on `PairingInviteViewModel`.
  - Call it before publishing exchange-expired, exchange-failed, or import-failed state.
- Modify: `apps/ios/App/Tests/PairingInviteFlowTests.swift`
  - Add focused model regressions for HTTP 410, other exchange failure, and import failure.
  - Add view-level proof that failure renders the existing empty editor without recognized-Mac or raw-invite data.
- Modify: `README.md`
  - Change only the current physical receipt wait target from `paired` to `imported`.
  - Keep the 2026-07-08 `paired` record explicitly transport-only.
- Modify: `apps/ios/README.md`
  - Apply the same current-versus-historical distinction.
- Modify: `tests/workspace-entrypoints.spec.ts`
  - Enforce `imported` in both current harness instructions and retain the historical transport-only `paired` record.
**Interfaces:**
- Consumes: existing `PairingInviteViewModel.replaceInviteText(_:)`, `pair()`, safe diagnostic mappers, and `PairingInviteReceiveView` failure rendering.
- Produces: private `discardFailedAttempt() -> Void`; no public API or stored-data contract changes.
- Produces: current receipt-doc contract `UNUVAULT_IOS_PAIRING_RECEIPT imported` plus historical transport-only contract `UNUVAULT_IOS_PAIRING_RECEIPT paired` dated 2026-07-08.
### Task 1: Prove failed attempts are discarded
**Files:**
- Modify: `apps/ios/App/Tests/PairingInviteFlowTests.swift`
- Test: `apps/ios/App/Tests/PairingInviteFlowTests.swift`
**Interfaces:**
- Consumes: `PairingInviteViewModel`, `makeInvite()`, `makeTarget()`, `makeHandoff(invite:target:)`, and `inviteJSON(_:)`.
- Produces: regression expectations for `.invalid`, `.failed`, and `.importFailed`, plus fresh-invite recovery and empty failure rendering.
- [ ] **Step 1: Add the expired-exchange RED test**
```swift
func testExpiredExchangeDiscardsFailedAttemptAndAcceptsFreshInvite() async throws {
    let failedInvite = makeInvite()
    let viewModel = PairingInviteViewModel(
        now: { Date(timeIntervalSince1970: 1_060) },
        targetIdentity: makeTarget(),
        exchange: { _, _ in throw PairingExchangeClientError.httpStatus(410) }
    )
    let failedInviteText = try inviteJSON(failedInvite)
    viewModel.replaceInviteText(failedInviteText)
    await viewModel.pair()
    XCTAssertEqual(viewModel.state, .invalid)
    XCTAssertEqual(viewModel.statusMessage, "Invite expired. Generate a fresh invite on your Mac.")
    XCTAssertEqual(viewModel.pairingFailureDiagnostic, "httpStatus(410)")
    assertFailedAttemptWasDiscarded(viewModel, rawInvite: failedInviteText)
    viewModel.replaceInviteText(try inviteJSON(makeInvite()))
    XCTAssertEqual(viewModel.state, .ready)
    XCTAssertTrue(viewModel.canPair)
}
```
- [ ] **Step 2: Add RED tests for other exchange and import failures**
```swift
func testExchangeFailureDiscardsFailedAttemptAndPreservesSafeDiagnostic() async throws {
    let invite = makeInvite()
    let rawInvite = try inviteJSON(invite)
    let viewModel = PairingInviteViewModel(
        now: { Date(timeIntervalSince1970: 1_060) },
        targetIdentity: makeTarget(),
        exchange: { _, _ in throw PairingExchangeClientError.httpStatus(423) }
    )
    viewModel.replaceInviteText(rawInvite)
    await viewModel.pair()
    XCTAssertEqual(viewModel.state, .failed)
    XCTAssertEqual(viewModel.statusMessage, "Pairing failed. Generate a fresh invite on your Mac.")
    XCTAssertEqual(viewModel.pairingFailureDiagnostic, "httpStatus(423)")
    assertFailedAttemptWasDiscarded(viewModel, rawInvite: rawInvite)
}
func testImportFailureDiscardsHandoffAndFailedAttempt() async throws {
    let invite = makeInvite()
    let target = makeTarget()
    let rawInvite = try inviteJSON(invite)
    let viewModel = PairingInviteViewModel(
        now: { Date(timeIntervalSince1970: 1_060) },
        targetIdentity: target,
        exchange: { _, _ in self.makeHandoff(invite: invite, target: target) },
        handoffImporter: { _, _ in throw SecretBearingImportFailure() }
    )
    viewModel.replaceInviteText(rawInvite)
    await viewModel.pair()
    XCTAssertEqual(viewModel.state, .importFailed)
    XCTAssertEqual(viewModel.statusMessage, "Import failed. Generate a fresh invite on your Mac.")
    XCTAssertEqual(viewModel.pairingFailureDiagnostic, "importFailed(unavailable)")
    assertFailedAttemptWasDiscarded(viewModel, rawInvite: rawInvite)
}
```
- [ ] **Step 3: Add the shared assertion with rendered-view coverage**
```swift
private func assertFailedAttemptWasDiscarded(
    _ viewModel: PairingInviteViewModel,
    rawInvite: String,
    file: StaticString = #filePath,
    line: UInt = #line
) {
    XCTAssertEqual(viewModel.inviteText, "", file: file, line: line)
    XCTAssertNil(viewModel.handoff, file: file, line: line)
    XCTAssertNil(viewModel.importReceipt, file: file, line: line)
    XCTAssertEqual(viewModel.macDisplayName, "", file: file, line: line)
    XCTAssertEqual(viewModel.macEndpointText, "", file: file, line: line)
    XCTAssertEqual(viewModel.macInviteDetailText, "", file: file, line: line)
    XCTAssertFalse(viewModel.canPair, file: file, line: line)
    let renderedBody = String(describing: PairingInviteReceiveView(viewModel: viewModel).body)
    XCTAssertTrue(renderedBody.contains("Paste invite"), file: file, line: line)
    XCTAssertTrue(renderedBody.contains("Paste invite from Mac"), file: file, line: line)
    XCTAssertFalse(renderedBody.contains("Yuchen Mac"), file: file, line: line)
    XCTAssertFalse(renderedBody.contains(rawInvite), file: file, line: line)
    XCTAssertFalse(renderedBody.contains("192.168.1.42"), file: file, line: line)
}
```
- [ ] **Step 4: Run the focused suite and record RED**
Run:
```bash
available_simulators="$(xcrun simctl list devices available)"
simulator_name=""
for candidate in "iPhone 17" "iPhone 16" "iPhone 15"; do
  if grep -Fq "$candidate" <<<"$available_simulators"; then simulator_name="$candidate"; break; fi
done
[[ -n "$simulator_name" ]] || { echo "No supported iPhone simulator was found." >&2; exit 1; }
cd apps/ios/App
xcodebuild test -scheme App -destination "platform=iOS Simulator,name=$simulator_name" -only-testing:AppTests/PairingInviteFlowTests
```
Expected RED: assertions show `inviteText` and Mac fields still contain the failed invite, and import failure still retains `handoff`.
### Task 2: Clear the failed attempt while preserving safe failure output
**Files:**
- Modify: `apps/ios/App/Sources/Features/Pairing/PairingInviteReceiveView.swift`
- Test: `apps/ios/App/Tests/PairingInviteFlowTests.swift`
**Interfaces:**
- Consumes: the diagnostic returned by `importFailureDiagnostic(for:)` or `pairingFailureDiagnostic(for:)` before reset.
- Produces: private `discardFailedAttempt()` that clears only failed-attempt material.
- [ ] **Step 1: Add the minimal reset helper**
```swift
private func discardFailedAttempt() {
    inviteText = ""
    invite = nil
    handoff = nil
    importReceipt = nil
    macDisplayName = ""
    macEndpointText = ""
    macInviteDetailText = ""
}
```
- [ ] **Step 2: Use the helper in all three failure paths**
```swift
} catch {
    let diagnostic = Self.importFailureDiagnostic(for: error)
    discardFailedAttempt()
    pairingFailureDiagnostic = diagnostic
    state = .importFailed
    statusMessage = "Import failed. Generate a fresh invite on your Mac."
}
```
For `httpStatus`, compute `"httpStatus(\(status))"`, call `discardFailedAttempt()`, then publish `.invalid` or `.failed`. For the final exchange catch, compute the allowlisted diagnostic, call the helper, then publish `.failed`. Do not call `clearInvite()` because it erases the required diagnostic and safe failure copy.
- [ ] **Step 3: Run the focused suite and require GREEN**
Run:
```bash
bash -lc 'available_simulators="$(xcrun simctl list devices available)"; simulator_name=""; for candidate in "iPhone 17" "iPhone 16" "iPhone 15"; do if grep -Fq "$candidate" <<<"$available_simulators"; then simulator_name="$candidate"; break; fi; done; [[ -n "$simulator_name" ]] || exit 1; cd apps/ios/App; xcodebuild test -scheme App -destination "platform=iOS Simulator,name=$simulator_name" -only-testing:AppTests/PairingInviteFlowTests'
```
Expected GREEN: `PairingInviteFlowTests` passes with zero failures; all three failure states retain safe copy/diagnostic, render an empty editor, and expose no failed-attempt fields.
- [ ] **Step 4: Commit the state-reset slice**
```bash
git add apps/ios/App/Sources/Features/Pairing/PairingInviteReceiveView.swift apps/ios/App/Tests/PairingInviteFlowTests.swift
git commit -m "fix: discard failed pairing invites"
```
### Task 3: Align current receipt docs and lock the evidence boundary
**Files:**
- Modify: `tests/workspace-entrypoints.spec.ts`
- Modify: `README.md`
- Modify: `apps/ios/README.md`
**Interfaces:**
- Consumes: `scripts/testing/run-pairing-physical-receipt.sh`, which already waits for `UNUVAULT_IOS_PAIRING_RECEIPT imported`.
- Produces: current `imported` sentinel docs and preserved historical `paired` transport-only evidence.
- [ ] **Step 1: Add RED workspace contract assertions**
```ts
expect(readme).toContain("`UNUVAULT_IOS_PAIRING_RECEIPT imported`");
expect(iosReadme).toContain("`UNUVAULT_IOS_PAIRING_RECEIPT imported`");
expect(readme).toContain("on 2026-07-08");
expect(readme).toContain("`UNUVAULT_IOS_PAIRING_RECEIPT paired ... material=AES-GCM-256`");
expect(iosReadme).toContain("The latest recorded hardware run on 2026-07-08 passed");
expect(readme).toContain("physical pairing-transport receipt only");
expect(iosReadme).toContain("physical pairing transport only");
```
- [ ] **Step 2: Run the contract test and record RED**
Run:
```bash
corepack pnpm exec vitest run tests/workspace-entrypoints.spec.ts
```
Expected RED: both current README instructions still contain the `paired` sentinel and do not contain the current `imported` sentinel.
- [ ] **Step 3: Update only current harness wording**
Use this current instruction in both README files:
```md
waits for `UNUVAULT_IOS_PAIRING_RECEIPT imported` in the iPhone console
```
Keep the dated evidence as:
```md
On 2026-07-08, the recorded `UNUVAULT_IOS_PAIRING_RECEIPT paired ... material=AES-GCM-256` receipt proved physical pairing transport only; it did not prove physical-device local open, encrypted import, or read-only reload.
```
- [ ] **Step 4: Rerun the contract test and require GREEN**
Run: `corepack pnpm exec vitest run tests/workspace-entrypoints.spec.ts`
Expected GREEN: the workspace suite passes and distinguishes current `imported` harness behavior from historical transport-only `paired` evidence.
- [ ] **Step 5: Commit the docs-contract slice**
```bash
git add README.md apps/ios/README.md tests/workspace-entrypoints.spec.ts
git commit -m "docs: align physical import receipt sentinel"
```
### Task 4: Run full verification and prepare the gated handoff
**Files:**
- Verify: `apps/ios/App/Sources/Features/Pairing/PairingInviteReceiveView.swift`
- Verify: `apps/ios/App/Tests/PairingInviteFlowTests.swift`
- Verify: `README.md`
- Verify: `apps/ios/README.md`
- Verify: `tests/workspace-entrypoints.spec.ts`
**Interfaces:**
- Consumes: repo-owned iOS test wrapper and workspace contract suite.
- Produces: current-head verification evidence; no push, PR mutation, or merge.
- [ ] **Step 1: Run the repo-owned full iOS gate**
```bash
corepack pnpm test:ios
```
Expected: `xcodebuild test` exits 0 with zero failures, retaining success, single-flight, secret-redaction, and post-import reload coverage.
- [ ] **Step 2: Rerun the workspace contract at current HEAD**
```bash
corepack pnpm exec vitest run tests/workspace-entrypoints.spec.ts
```
Expected: all tests in `workspace-entrypoints.spec.ts` pass.
- [ ] **Step 3: Inspect evidence wording and whitespace**
```bash
rg -n "UNUVAULT_IOS_PAIRING_RECEIPT (imported|paired)|2026-07-08|transport only|transport-only" README.md apps/ios/README.md scripts/testing/run-pairing-physical-receipt.sh tests/workspace-entrypoints.spec.ts
git diff --check
git status --short
```
Expected: current instructions and the script use `imported`; `paired` appears only in dated historical transport evidence and its contract assertions; `git diff --check` exits 0.
- [ ] **Step 4: Record the handoff boundary**
Report the two unuvault commit SHAs, focused and full verification results, and remaining separately gated actions: push, PR #78 Cross-Repo Impact update, `unuOS` authority sync, and merge. Do not claim physical import evidence beyond an actual recorded physical `imported` receipt.
