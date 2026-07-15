# iOS Product Composition Parity Implementation Plan

> **For Codex:** Execute this plan task by task with test-driven development. Do not change Pencil assets; the promoted current frames named below are the visual authority.

**Goal:** Make the shipped SwiftUI host match `current/unuvault/ios-product-composition-v1` and `current/unuvault/ios-pairing-invite-receive-v3`: Vault and Pairing are always reachable, startup and post-import loads use the app-default received store, and the app switches to Vault only after a fresh successful reload exposes received metadata.

**Architecture:** Add one `@MainActor` composition model that owns destination selection and the received-vault async state. Keep the existing parser, exchange, decrypt/import, encrypted store, and metadata projection intact. Pairing reports an import receipt through an async completion hook; the composition model then performs a new load from `PairingReceivedVaultStoreConfiguration.appDefault()` and decides whether navigation may change. The root SwiftUI view renders a native `TabView`, while loading, failure, retry, and accessibility roles follow `current/unuvault/design-system-v1` (`y3gA1q`).

**Tech Stack:** Swift 6, SwiftUI, Observation through `ObservableObject`, XCTest, Swift Package Manager, XcodeGen, `xcodebuild`, and `simctl`.

## Scope and invariants

- Design authority: `current/unuvault/ios-product-composition-v1` (`ZIaie`), `current/unuvault/ios-pairing-invite-receive-v3` (`HWLlN`), and the native roles in `current/unuvault/design-system-v1` (`y3gA1q`).
- `Vault` and `Pairing` remain selectable in every non-modal state.
- Startup begins in a loading state. Non-empty received metadata selects `Vault`; a missing or empty store selects `Pairing`; an unreadable store stays recoverable and exposes `Retry` without leaking the underlying error.
- Import completion alone never changes tabs. A new app-default-store load must return non-empty metadata before selecting `Vault`.
- A failed or unexpectedly empty post-import reload stays on `Pairing`, shows a safe error, and offers a single-flight retry.
- While import or reload is in flight, a second import and a second incoming deep link are ignored. Each accepted deep link is decoded and passed to `replaceInviteText(_:)` exactly once.
- The composition surface contains metadata only. No password, secret, raw invite, endpoint, handoff identifier, or underlying error description is rendered or announced.
- Native safe areas, Dynamic Type wrapping, VoiceOver labels/status announcements, selected-state cues beyond color, and at least 44-point interactive targets are acceptance requirements.

## Current implementation and gap boundary

Already implemented and retained:

- `PairingInviteParser`, target identity, claim exchange, handoff opening, replay/target validation, and encrypted import.
- `PairingReceivedVaultStoreConfiguration.appDefault()` with Application Support storage and a Keychain-held 256-bit key.
- `VaultListModel` metadata projection containing only id, label, username, and website origin.
- Pairing invite validation, hidden raw invite after recognition, Dynamic Type metrics, safe diagnostic strings, and 48-point primary action.

Implementation gaps this plan closes:

- The host currently mounts `PairingInviteReceiveView` directly; no app-level `TabView` or state-driven startup route exists.
- `VaultListModel.loadReceivedVault` currently catches every store error and collapses failure into an empty list, so the UI cannot distinguish Pairing-first empty state from recoverable load failure.
- The pairing model reports `.imported` immediately after persistence but has no async completion hook for a fresh app-default reload.
- No composition-level reload failure, retry, import/reload single-flight, or deep-link parse-once coordinator exists.
- The simulator evidence script captures only the promoted-v2 pairing screen and its README wording still points to v2 rather than the promoted composition/v3 authority.

## State and interface contract

Create `apps/ios/App/Sources/Features/ProductComposition/IOSProductCompositionView.swift` with these production interfaces:

```swift
enum IOSProductDestination: Hashable {
    case vault
    case pairing
}

enum ReceivedVaultLoadState: Equatable {
    case idle
    case loading
    case available(VaultListModel)
    case empty
    case failed
}

typealias ReceivedVaultLoader = @MainActor () async throws -> VaultListModel
typealias PairingImportCompletion = @MainActor (PairingHandoffImportReceipt) async -> Void

@MainActor
final class IOSProductCompositionViewModel: ObservableObject {
    @Published private(set) var receivedVaultState: ReceivedVaultLoadState
    @Published var selectedDestination: IOSProductDestination
    @Published private(set) var postImportReloadFailed: Bool

    init(
        receivedVaultLoader: @escaping ReceivedVaultLoader = IOSProductCompositionViewModel.appDefaultLoader(),
        initialDestination: IOSProductDestination = .pairing
    )

    func start() async
    func reloadAfterImport(_ receipt: PairingHandoffImportReceipt) async
    func retryPostImportReload() async
    func acceptDeepLinkInvite(_ inviteText: String, into pairingViewModel: PairingInviteViewModel)
    static func appDefaultLoader(
        configuration: PairingReceivedVaultStoreConfiguration = .appDefault()
    ) -> ReceivedVaultLoader
}

struct IOSProductCompositionView: View {
    init(
        viewModel: IOSProductCompositionViewModel = IOSProductCompositionViewModel(),
        pairingViewModel: PairingInviteViewModel? = nil
    )
}
```

Change the vault loader in `apps/ios/App/Sources/Features/Vault/VaultListView.swift` to preserve error identity:

```swift
static func loadReceivedVault(
    from configuration: PairingReceivedVaultStoreConfiguration = .appDefault()
) throws -> VaultListModel
```

Keep a convenience `VaultListView(model:)`; the composition model, not the view initializer, owns loading and retry.

Extend `PairingInviteViewModel` in `apps/ios/App/Sources/Features/Pairing/PairingInviteReceiveView.swift` with:

```swift
private let onImportSucceeded: PairingImportCompletion

init(
    now: @escaping @Sendable () -> Date = Date.init,
    targetIdentityProvider: @escaping PairingTargetIdentityProvider = {
        try DefaultPairingTargetIdentityProvider().makeIdentity()
    },
    exchange: PairingInviteExchange? = nil,
    handoffImporter: PairingHandoffImporter? = nil,
    onImportSucceeded: @escaping PairingImportCompletion = { _ in }
)
```

After the importer returns a receipt, publish the safe imported state and `await onImportSucceeded(receipt)`. Add `isBusy` derived from `.pairing`; `replaceInviteText(_:)` must return without mutation while busy. Composition reload state provides the second half of single-flight, so `reloadAfterImport` and `retryPostImportReload` return immediately while `receivedVaultState == .loading`.

## Task 1: Make received-vault load results explicit

**Files:**

- Modify: `apps/ios/App/Sources/Features/Vault/VaultListView.swift`
- Modify: `apps/ios/App/Tests/VaultListModelTests.swift`

1. Add RED tests asserting a missing store returns an empty model while a corrupt store throws `PairingHandoffImportError.invalidEncryptedStore`. Assert encoded successful and error-facing state contains none of `password`, test secrets, or the underlying corrupt bytes.
2. Run:

```bash
cd apps/ios/App
available_simulators="$(xcrun simctl list devices available)"
simulator_name=""
for candidate in "iPhone 17" "iPhone 16" "iPhone 15"; do
  if grep -Fq "$candidate" <<<"$available_simulators"; then
    simulator_name="$candidate"
    break
  fi
done
[[ -n "$simulator_name" ]] || { echo "No supported iPhone simulator was found." >&2; exit 1; }
xcodebuild test \
  -scheme App \
  -destination "platform=iOS Simulator,name=$simulator_name" \
  -only-testing:AppTests/VaultListModelTests
```

Expected RED: the corrupt-store assertion cannot compile or fails because `loadReceivedVault(from:)` is non-throwing and returns `[]`.
3. Change `loadReceivedVault(from:)` to `throws`, directly construct `PairingHandoffImportStore`, and return its metadata model. A missing encrypted file remains a successful empty model because `PairingHandoffImportStore` already treats a nonexistent path as empty. Remove the configuration-loading initializer from `VaultListView`; retain `init(model:)`.
4. Rerun the filtered test command and require PASS.

## Task 2: Add the deterministic composition state machine

**Files:**

- Create: `apps/ios/App/Sources/Features/ProductComposition/IOSProductCompositionView.swift`
- Create: `apps/ios/App/Tests/IOSProductCompositionTests.swift`

1. Add RED tests using a queued loader spy for all transitions:
   - `start()` publishes loading, then non-empty `.available(model)` and selects `.vault`.
   - `start()` with an empty model publishes `.empty` and selects `.pairing`.
   - `start()` failure publishes `.failed`, selects `.pairing`, and exposes no error string.
   - `reloadAfterImport(_:)` does not select Vault before its suspended loader resumes.
   - successful non-empty post-import reload selects Vault and clears `postImportReloadFailed`.
   - thrown or empty post-import reload stays on Pairing and sets `postImportReloadFailed`.
   - retry is single-flight and selects Vault only after a later non-empty result.
   - a second `start`, reload, or retry while loading does not increment loader call count.
2. Run:

```bash
cd apps/ios/App
available_simulators="$(xcrun simctl list devices available)"
simulator_name=""
for candidate in "iPhone 17" "iPhone 16" "iPhone 15"; do
  if grep -Fq "$candidate" <<<"$available_simulators"; then
    simulator_name="$candidate"
    break
  fi
done
[[ -n "$simulator_name" ]] || { echo "No supported iPhone simulator was found." >&2; exit 1; }
xcodebuild test \
  -scheme App \
  -destination "platform=iOS Simulator,name=$simulator_name" \
  -only-testing:AppTests/IOSProductCompositionTests
```

Expected RED: `IOSProductCompositionViewModel`, destinations, and load states do not exist.
3. Implement the interfaces above. Use one private `loadReceivedVault(context:)` transition function with an internal context enum (`startup` or `postImport`) so navigation rules cannot drift. Do not store an `Error`; map failures to `.failed` plus the safe Boolean post-import flag.
4. Rerun the filtered tests and require PASS.

## Task 3: Wire import completion and input single-flight

**Files:**

- Modify: `apps/ios/App/Sources/Features/Pairing/PairingInviteReceiveView.swift`
- Modify: `apps/ios/App/Tests/PairingInviteFlowTests.swift`
- Modify: `apps/ios/App/Tests/IOSProductCompositionTests.swift`

1. Add RED tests proving:
   - `onImportSucceeded` runs once and only after encrypted import returns a receipt.
   - the tab remains Pairing while the async completion hook is suspended.
   - a second `pair()` and `replaceInviteText(_:)` during `.pairing` do not start another exchange or replace the accepted invite.
   - `acceptDeepLinkInvite` selects Pairing and calls invite parsing once; a second deep link during pairing or post-import loading is ignored.
2. Run:

```bash
cd apps/ios/App
available_simulators="$(xcrun simctl list devices available)"
simulator_name=""
for candidate in "iPhone 17" "iPhone 16" "iPhone 15"; do
  if grep -Fq "$candidate" <<<"$available_simulators"; then
    simulator_name="$candidate"
    break
  fi
done
[[ -n "$simulator_name" ]] || { echo "No supported iPhone simulator was found." >&2; exit 1; }
xcodebuild test \
  -scheme App \
  -destination "platform=iOS Simulator,name=$simulator_name" \
  -only-testing:AppTests/PairingInviteFlowTests \
  -only-testing:AppTests/IOSProductCompositionTests
```

Expected RED: there is no completion hook, busy guard, or composition deep-link entrypoint.
3. Add the async completion dependency, await it after receipt publication, and guard `pair()` plus `replaceInviteText(_:)` with the accepted single-flight rules. Connect the default `PairingInviteViewModel` created by `IOSProductCompositionView` to `viewModel.reloadAfterImport(_:)`.
4. Rerun both filtered suites and require PASS.

## Task 4: Build the promoted native composition UI

**Files:**

- Modify: `apps/ios/App/Sources/Features/ProductComposition/IOSProductCompositionView.swift`
- Modify: `apps/ios/App/Sources/Features/Vault/VaultListView.swift`
- Modify: `apps/ios/App/Sources/Features/Pairing/PairingInviteReceiveView.swift`
- Modify: `apps/ios/App/Tests/IOSProductCompositionTests.swift`
- Modify: `apps/ios/App/Tests/VaultListModelTests.swift`

1. Add RED contract tests for exact user-facing roles: `Vault`, `Pairing`, `Loading received vault…`, `Vault metadata unavailable`, `Retry`, and the post-import message `Imported, but the received vault could not be reloaded.` Assert minimum action height is at least 44 points and selected destinations have semantic labels/values independent of color.
2. Run the two filtered composition/vault suites and require the new copy/accessibility assertions to fail.
3. Implement a native `TabView(selection:)` with `.tabItem` label plus system symbol for both destinations. Render:
   - Vault startup loading with `ProgressView`, a combined accessibility label, and a status announcement value.
   - `.available` using `VaultListView(model:)`.
   - `.empty` with the promoted empty-state copy and a Pairing route that remains reachable through the tab bar.
   - `.failed` with safe semantic error styling and a 48-point `Retry` button that calls `start()`.
   - Pairing using the existing receive view plus a safe post-import reload error panel and 48-point retry button.
4. Use `NavigationStack` within each tab only; do not push one product destination from the other. Apply `.lineLimit(nil)`, vertical fixed sizing, semantic system colors/dark-mode-compatible custom colors, `accessibilityLabel`, and `accessibilityValue("Selected")` on selected destination content. On each transition into startup or post-import failure, post exactly one safe `AccessibilityNotification.Announcement` containing the visible recovery message. Preserve safe areas by avoiding full-screen content overlays over the native tab bar.
5. Rerun the filtered composition and vault suites with the same first-available simulator selection:

```bash
cd apps/ios/App
available_simulators="$(xcrun simctl list devices available)"
simulator_name=""
for candidate in "iPhone 17" "iPhone 16" "iPhone 15"; do
  if grep -Fq "$candidate" <<<"$available_simulators"; then
    simulator_name="$candidate"
    break
  fi
done
[[ -n "$simulator_name" ]] || { echo "No supported iPhone simulator was found." >&2; exit 1; }
xcodebuild test \
  -scheme App \
  -destination "platform=iOS Simulator,name=$simulator_name" \
  -only-testing:AppTests/IOSProductCompositionTests \
  -only-testing:AppTests/VaultListModelTests
```

Then return to the repository root and run the canonical full iOS runner:

```bash
cd ../../..
bash scripts/testing/run-ios.sh
```

Expected GREEN: the full iOS package suite passes on the first available iPhone 17/16/15 simulator.

## Task 5: Replace the host root and centralize deep-link decoding

**Files:**

- Modify: `apps/ios/HostApp/Sources/UnuVaultIOSHostApp.swift`
- Modify: `apps/ios/HostApp/project.yml`
- Modify: `apps/ios/App/Tests/IOSProductCompositionTests.swift`

1. Extract the pure URL conversion into the composition source as:

```swift
enum IOSPairingDeepLink {
    static func inviteText(from url: URL) -> String?
}
```

2. Add RED tests for the accepted `unuvault-ioshost://pair?invite=<base64url>` form, wrong scheme/host, missing invite, invalid base64URL, and non-UTF-8 data. Test that one accepted URL selects Pairing and produces one parser transition.
3. Replace `PairingInviteHostRootView` with a host root holding one `IOSProductCompositionViewModel` and one `PairingInviteViewModel`. Forward accepted URLs once through `IOSPairingDeepLink` and `acceptDeepLinkInvite`. Keep the physical receipt logger by observing the same pairing model receipt; do not auto-call `pair()` for normal simulator launch. For the physical deep-link harness, call `pair()` once only after the accepted invite is ready.
4. Update `project.yml` to compile `Features/ProductComposition/IOSProductCompositionView.swift` and `Features/Vault/VaultListView.swift` in addition to the existing pairing sources.
5. Run:

```bash
cd apps/ios/App
available_simulators="$(xcrun simctl list devices available)"
simulator_name=""
for candidate in "iPhone 17" "iPhone 16" "iPhone 15"; do
  if grep -Fq "$candidate" <<<"$available_simulators"; then
    simulator_name="$candidate"
    break
  fi
done
[[ -n "$simulator_name" ]] || { echo "No supported iPhone simulator was found." >&2; exit 1; }
xcodebuild test \
  -scheme App \
  -destination "platform=iOS Simulator,name=$simulator_name" \
  -only-testing:AppTests/IOSProductCompositionTests
cd ../../..
bash scripts/testing/run-ios.sh
```

Expected GREEN: URL tests and full simulator tests pass; the receipt line retains the `UNUVAULT_IOS_PAIRING_RECEIPT imported` prefix plus handoff, source-device, target-device, imported-count, and material fields for the physical harness.

## Task 6: Produce simulator parity evidence

**Files:**

- Modify: `scripts/testing/run-ios-ui-host.sh`
- Modify: `apps/ios/HostApp/Sources/UnuVaultIOSHostApp.swift`
- Create: `docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-empty.png`
- Create: `docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-vault.png`
- Create: `docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-reload-failed.png`
- Create: `docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-accessibility3.png`

1. Add deterministic launch arguments handled only by the host: `--unuvault-composition-state empty|vault|reload-failed` and the existing `--unuvault-dynamic-type large|accessibility3`. Inject fixture loaders/models; never write fixture data into the app-default store.
2. Update the script to build/install once, launch each state, and capture the four exact paths above. Keep the existing first-available iPhone 17/16/15 selection and bounded launch/install retries.
3. Run:

```bash
bash scripts/testing/run-ios-ui-host.sh
```

Expected GREEN: all four PNG files are newly written.
4. Visually inspect all four screenshots at original resolution. Confirm both tabs remain visible, the selected destination is identifiable without color, no secret/raw invite appears, reload failure retains Pairing and Retry, no text or controls clip at `accessibility3`, no content enters the sensor/home-indicator safe areas, and every primary/retry control is at least 44 points high. If any check fails, correct SwiftUI layout and repeat the script before proceeding.

## Task 7: Update canonical documentation and run final verification

**Files:**

- Modify: `README.md`
- Modify: `apps/ios/README.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

1. Record the existing lockfile RED before changing configuration:

```bash
pnpm install --frozen-lockfile
```

Expected RED: the root importer in `pnpm-lock.yaml` still lists `libsodium-wrappers-sumo`, although the root `package.json` no longer declares it. The separate `packages/security` dependency is valid and must remain.
2. Repair only the lockfile importer from the current manifests, then prove frozen installation succeeds:

```bash
pnpm install --lockfile-only --no-frozen-lockfile
git diff -- pnpm-lock.yaml
pnpm install --frozen-lockfile
```

Expected GREEN: the root importer no longer contains `libsodium-wrappers-sumo`; `packages/security` still declares and resolves `libsodium-wrappers-sumo`; no iOS deployment target or unrelated macOS platform is added.
3. Add `test:ios` as the canonical package alias for `bash scripts/testing/run-ios.sh`; retain `test:ios:ui-host`.
4. Update both READMEs from pairing v2 to the promoted composition/v3 authority. State precisely that startup loads the app-default encrypted received store, routes metadata to Vault and empty to Pairing, and post-import navigation waits for fresh reload success. Preserve all non-claims: no camera scan, password reveal/copy, editing, search, biometric unlock, cloud sync, or shipped full mobile vault.
5. Document the four new simulator evidence paths and state that screenshots prove simulator composition and Dynamic Type layout, not manual VoiceOver rotor behavior or physical-device import.
6. Run the canonical verification set:

```bash
pnpm test:ios
pnpm test:ios:ui-host
pnpm lint
pnpm test
```

Expected GREEN: every command exits 0. If repository-wide `pnpm test` exposes an unrelated environmental failure, preserve the complete command/error evidence and do not weaken the iOS gate.
7. Run consistency and unfinished-marker scans:

```bash
rg -n "ios-pairing-invite-receive-v2|PairingInviteHostRootView|loadReceivedVault\(" README.md apps/ios package.json
rg -n "FIXME|fatalError\(" apps/ios README.md package.json docs/superpowers/plans/2026-07-14-ios-product-composition-parity.md
```

Expected: the first command finds no v2 authority claim or old host root, and every `loadReceivedVault` call is typed as throwing or awaited through the loader. The second command finds only this verification command itself; production and test changes contain no unfinished implementation marker.

## Final acceptance checklist

- Startup metadata, empty, and error routes are distinct and covered by tests.
- Import success cannot switch tabs before a fresh non-empty app-default-store reload.
- Reload failure remains on Pairing and Retry is single-flight.
- Accepted deep links parse once and are ignored while import/reload is in flight.
- Vault/Pairing stay reachable; selected state is not color-only.
- Visible and announced content remains metadata-only and safe-error-only.
- Dynamic Type `accessibility3`, VoiceOver semantics, safe areas, dark mode, and 44-point controls match the promoted design roles.
- `pnpm test:ios`, `pnpm test:ios:ui-host`, `pnpm lint`, and `pnpm test` have recorded results.
- README authority and evidence paths describe exactly what the implementation and simulator proof establish.
