# Mac Companion Local User Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a testable macOS local user-presence authorization boundary before the Mac companion opens its local vault session.

**Architecture:** Add a small injectable authorizer protocol backed by `LocalAuthentication.LAContext` in production and deterministic authorizers in tests/proof mode. Make `CompanionViewModel` call that authorizer before reading the local encrypted vault, then register a focused proof command and docs boundary that do not claim full Touch ID UX proof.

**Tech Stack:** Swift 6, SwiftUI, LocalAuthentication, XCTest, bash, pnpm/Vitest entrypoint contract tests.

---

## File Structure

- Create `apps/macos/App/Sources/MacCompanionCore/LocalUserPresenceAuthorizer.swift`
  - Owns the local user-presence result enum, protocol, production
    `LocalAuthentication` implementation, and deterministic allow/deny
    authorizers for proof injection.
- Create `apps/macos/App/Tests/MacCompanionCoreTests/CompanionViewModelLocalUserPresenceTests.swift`
  - Proves allow, deny, and unavailable authorization outcomes against
    `CompanionViewModel`.
- Create `scripts/testing/run-mac-local-user-presence.sh`
  - Runs the focused Swift tests and prints stable receipt lines.
- Create `tests/mac-local-user-presence.spec.ts`
  - Proves the package script, wrapper, README, and evidence docs register the
    proof without claiming full Touch ID UX evidence.
- Modify `apps/macos/App/Sources/MacCompanionCore/LocalCompanionVaultStore.swift`
  - Extract a small `CompanionVaultStoring` protocol so tests can prove denied
    authorization prevents vault reads.
- Modify `apps/macos/App/Sources/UnuVaultMacCompanion/CompanionViewModel.swift`
  - Inject `localUserPresenceAuthorizer`, make unlock async, and require
    successful authorization before loading credentials.
- Modify `apps/macos/App/Sources/UnuVaultMacCompanion/CompanionAppConfiguration.swift`
  - Inject deterministic allow authorizer in explicit proof mode so smoke tests
    do not hang on a system prompt.
- Modify `apps/macos/App/Sources/UnuVaultMacCompanion/CompanionMenuView.swift`
  - Wrap unlock button action in `Task { await ... }`.
- Modify `apps/macos/App/Sources/UnuVaultMacCompanion/Resources/en.lproj/Localizable.strings`
  and `apps/macos/App/Sources/UnuVaultMacCompanion/Resources/zh-Hans.lproj/Localizable.strings`
  - Add local-auth prompt and failure copy.
- Modify `package.json`, `README.md`, and
  `docs/design/mac-companion-mvp-evidence.md`
  - Register `pnpm test:macos:local-user-presence` and keep Touch ID UX proof
    out of scope.

---

### Task 1: Add Failing Swift Tests For Local User Presence

**Files:**
- Create: `apps/macos/App/Tests/MacCompanionCoreTests/CompanionViewModelLocalUserPresenceTests.swift`

- [ ] **Step 1: Write the failing tests**

```swift
import Foundation
import XCTest
@testable import MacCompanionCore
@testable import UnuVaultMacCompanion

@MainActor
final class CompanionViewModelLocalUserPresenceTests: XCTestCase {
    func testAllowAuthorizationUnlocksLocalVault() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .authorized
            )
        )

        await viewModel.unlockLocalVault()

        XCTAssertTrue(store.didLoadCredentials)
        XCTAssertTrue(viewModel.isUnlocked)
        XCTAssertEqual(viewModel.lastDecisionText, L10n.string("decision.unlocked"))
    }

    func testDeniedAuthorizationDoesNotReadVaultOrUnlock() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .denied
            )
        )

        await viewModel.unlockLocalVault()

        XCTAssertFalse(store.didLoadCredentials)
        XCTAssertFalse(viewModel.isUnlocked)
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.string("decision.local_auth_failed")
        )
    }

    func testUnavailableAuthorizationDoesNotReadVaultOrUnlock() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .unavailable
            )
        )

        await viewModel.unlockLocalVault()

        XCTAssertFalse(store.didLoadCredentials)
        XCTAssertFalse(viewModel.isUnlocked)
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.string("decision.local_auth_unavailable")
        )
    }

    private static func githubCredential() -> CompanionCredential {
        CompanionCredential(
            id: "github-login",
            label: "github.com",
            username: "yuchen",
            password: "secret-github",
            profileId: "personal",
            websiteOrigin: "https://github.com"
        )
    }
}

private final class RecordingCompanionVaultStore: CompanionVaultStoring {
    private let credentials: [CompanionCredential]
    private(set) var didLoadCredentials = false

    init(credentials: [CompanionCredential]) {
        self.credentials = credentials
    }

    func save(credentials: [CompanionCredential]) throws {}

    func loadCredentials() throws -> [CompanionCredential] {
        didLoadCredentials = true
        return credentials
    }
}
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
swift test --package-path apps/macos/App --filter CompanionViewModelLocalUserPresenceTests
```

Expected: FAIL because `CompanionVaultStoring`,
`StaticLocalUserPresenceAuthorizer`, and the new `CompanionViewModel`
initializer do not exist yet.

---

### Task 2: Add The Local User Presence Authorizer Boundary

**Files:**
- Create: `apps/macos/App/Sources/MacCompanionCore/LocalUserPresenceAuthorizer.swift`

- [ ] **Step 1: Implement the authorizer protocol and default implementations**

```swift
import Foundation
import LocalAuthentication

public enum LocalUserPresenceAuthorizationResult: Equatable {
    case authorized
    case denied
    case unavailable
}

public protocol LocalUserPresenceAuthorizing {
    func authorize(reason: String) async -> LocalUserPresenceAuthorizationResult
}

public struct StaticLocalUserPresenceAuthorizer: LocalUserPresenceAuthorizing {
    private let result: LocalUserPresenceAuthorizationResult

    public init(result: LocalUserPresenceAuthorizationResult) {
        self.result = result
    }

    public func authorize(reason: String) async -> LocalUserPresenceAuthorizationResult {
        result
    }
}

public final class LocalAuthenticationUserPresenceAuthorizer:
    LocalUserPresenceAuthorizing
{
    public init() {}

    public func authorize(reason: String) async -> LocalUserPresenceAuthorizationResult {
        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            return .unavailable
        }

        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            ) ? .authorized : .denied
        } catch {
            return .denied
        }
    }
}
```

- [ ] **Step 2: Run the focused test again**

Run:

```bash
swift test --package-path apps/macos/App --filter CompanionViewModelLocalUserPresenceTests
```

Expected: still FAIL because `CompanionVaultStoring` and view-model injection
are not implemented yet.

---

### Task 3: Make Vault Store Reads Injectable

**Files:**
- Modify: `apps/macos/App/Sources/MacCompanionCore/LocalCompanionVaultStore.swift`

- [ ] **Step 1: Add the vault store protocol above `LocalCompanionVaultStore`**

```swift
public protocol CompanionVaultStoring {
    func save(credentials: [CompanionCredential]) throws
    func loadCredentials() throws -> [CompanionCredential]
}
```

- [ ] **Step 2: Make `LocalCompanionVaultStore` conform**

Change:

```swift
public final class LocalCompanionVaultStore {
```

to:

```swift
public final class LocalCompanionVaultStore: CompanionVaultStoring {
```

- [ ] **Step 3: Run the focused test again**

Run:

```bash
swift test --package-path apps/macos/App --filter CompanionViewModelLocalUserPresenceTests
```

Expected: still FAIL because `CompanionViewModel` does not accept the injected
authorizer or protocol-typed vault store yet.

---

### Task 4: Gate `CompanionViewModel` Unlock Behind User Presence

**Files:**
- Modify: `apps/macos/App/Sources/UnuVaultMacCompanion/CompanionViewModel.swift`
- Modify: `apps/macos/App/Sources/UnuVaultMacCompanion/CompanionMenuView.swift`

- [ ] **Step 1: Update stored properties and initializer**

In `CompanionViewModel`, change the vault store property and add the
authorizer:

```swift
private let localUserPresenceAuthorizer: LocalUserPresenceAuthorizing
private let vaultStore: CompanionVaultStoring?
```

Update the initializer parameters:

```swift
init(
    vaultStore: CompanionVaultStoring? = try? LocalCompanionVaultStore.defaultStore(),
    localUserPresenceAuthorizer: LocalUserPresenceAuthorizing =
        LocalAuthenticationUserPresenceAuthorizer(),
    accessToken: String = "local-dev-bridge-token",
    addLoginDraftCredential: CompanionCredential? = nil,
    bridgeBindHost: String = "127.0.0.1",
    bridgePort: UInt16 = 17666,
    pairingBaseURL: URL? = nil,
    pairingSourceDeviceDisplayName: String = Host.current().localizedName ?? "This Mac",
    pairingSourceDeviceId: String = "mac-companion-local",
    pairingTransferKeyData: Data = CompanionViewModel.makePairingTransferKeyData(),
    startupCredential: CompanionCredential? = nil,
    unlockOnStart: Bool = false
) {
    self.accessToken = accessToken
    self.addLoginDraftCredential = addLoginDraftCredential
    self.bridgeBindHost = bridgeBindHost
    self.bridgePort = bridgePort
    self.localUserPresenceAuthorizer = localUserPresenceAuthorizer
    self.pairingBaseURL = pairingBaseURL ?? CompanionViewModel.defaultPairingBaseURL(
        bridgePort: bridgePort
    )
    self.pairingSourceDeviceDisplayName = pairingSourceDeviceDisplayName
    self.pairingSourceDeviceId = pairingSourceDeviceId
    self.pairingTransferKeyData = pairingTransferKeyData
    self.startupCredential = startupCredential
    self.unlockOnStart = unlockOnStart
    self.vaultStore = vaultStore
}
```

- [ ] **Step 2: Convert unlock calls to async**

Update `applyStartupStateIfNeeded()`:

```swift
if unlockOnStart {
    Task { @MainActor in
        await unlockLocalVault()
    }
}
```

Update `toggleLockState()`:

```swift
func toggleLockState() {
    if isUnlocked {
        lock()
    } else {
        Task { @MainActor in
            await unlockLocalVault()
        }
    }
}
```

Update `unlockLocalVault()` signature and authorization gate:

```swift
func unlockLocalVault() async {
    let authorization = await localUserPresenceAuthorizer.authorize(
        reason: L10n.string("local_auth.unlock_reason")
    )

    guard authorization == .authorized else {
        lastDecisionText = authorization == .unavailable
            ? L10n.string("decision.local_auth_unavailable")
            : L10n.string("decision.local_auth_failed")
        refresh()
        return
    }

    guard let vaultStore else {
        lastDecisionText = L10n.string("decision.vault_unavailable")
        return
    }

    do {
        let credentials = try vaultStore.loadCredentials()

        guard !credentials.isEmpty else {
            lastDecisionText = L10n.string("decision.no_logins")
            refresh()
            return
        }

        session.unlock(credentials: credentials, ttl: 300)
        lastDecisionText = L10n.string("decision.unlocked")
    } catch {
        lastDecisionText = L10n.string("decision.open_failed")
    }

    refresh()
}
```

- [ ] **Step 3: Update the menu view action**

In `CompanionMenuView`, keep the button calling `toggleLockState()`:

```swift
CompanionActionButton(
    title: viewModel.primaryActionTitle,
    style: .primary
) {
    viewModel.toggleLockState()
}
```

No UI label change is required in this task.

- [ ] **Step 4: Run the focused test**

Run:

```bash
swift test --package-path apps/macos/App --filter CompanionViewModelLocalUserPresenceTests
```

Expected: FAIL only on missing localization keys.

---

### Task 5: Add Localization And Proof-Mode Injection

**Files:**
- Modify: `apps/macos/App/Sources/UnuVaultMacCompanion/CompanionAppConfiguration.swift`
- Modify: `apps/macos/App/Sources/UnuVaultMacCompanion/Resources/en.lproj/Localizable.strings`
- Modify: `apps/macos/App/Sources/UnuVaultMacCompanion/Resources/zh-Hans.lproj/Localizable.strings`

- [ ] **Step 1: Add production/proof authorizer injection**

In `CompanionAppConfiguration.makeViewModel`, pass the proof authorizer:

```swift
localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(result: .authorized),
```

The surrounding initializer call should keep all existing proof parameters and
only add this argument after `vaultStore`.

- [ ] **Step 2: Add English strings**

Add to `en.lproj/Localizable.strings`:

```text
"local_auth.unlock_reason" = "Unlock UnuVault local vault on this Mac";
"decision.local_auth_failed" = "Local authorization was canceled or denied.";
"decision.local_auth_unavailable" = "Local authorization is unavailable on this Mac.";
```

- [ ] **Step 3: Add Simplified Chinese strings**

Add to `zh-Hans.lproj/Localizable.strings`:

```text
"local_auth.unlock_reason" = "解锁这台 Mac 上的 UnuVault 本机保险库";
"decision.local_auth_failed" = "本机授权已取消或被拒绝。";
"decision.local_auth_unavailable" = "这台 Mac 暂时无法进行本机授权。";
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
swift test --package-path apps/macos/App --filter CompanionViewModelLocalUserPresenceTests
```

Expected: PASS.

---

### Task 6: Register The Local User Presence Proof Entrypoint

**Files:**
- Create: `scripts/testing/run-mac-local-user-presence.sh`
- Create: `tests/mac-local-user-presence.spec.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/design/mac-companion-mvp-evidence.md`

- [ ] **Step 1: Add the shell wrapper**

```bash
#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
mac_package="$repo_root/apps/macos/App"

echo "UNUVAULT_MAC_LOCAL_USER_PRESENCE status=running check=CompanionViewModelLocalUserPresenceTests"

swift test \
  --package-path "$mac_package" \
  --filter CompanionViewModelLocalUserPresenceTests

echo "UNUVAULT_MAC_LOCAL_USER_PRESENCE status=ready claim=code_boundary unclaimed=touch_id_prompt_screenshot,notarization,physical_iphone"
```

Then run:

```bash
chmod +x scripts/testing/run-mac-local-user-presence.sh
```

- [ ] **Step 2: Add package script**

In `package.json` scripts:

```json
"test:macos:local-user-presence": "bash scripts/testing/run-mac-local-user-presence.sh"
```

- [ ] **Step 3: Add the Vitest entrypoint test**

```ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
};

const repoRoot = resolve(import.meta.dirname, "..");

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

function readJson<T>(pathFromRepoRoot: string): T {
  return JSON.parse(readText(pathFromRepoRoot)) as T;
}

describe("Mac local user presence proof", () => {
  it("registers a focused code-boundary proof without claiming full Touch ID UX", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const wrapperPath = "scripts/testing/run-mac-local-user-presence.sh";
    const wrapper = readText(wrapperPath);
    const readme = readText("README.md");
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(existsSync(resolve(repoRoot, wrapperPath))).toBe(true);
    expect(rootPackage.scripts?.["test:macos:local-user-presence"]).toBe(
      "bash scripts/testing/run-mac-local-user-presence.sh",
    );
    expect(wrapper).toContain("UNUVAULT_MAC_LOCAL_USER_PRESENCE");
    expect(wrapper).toContain("CompanionViewModelLocalUserPresenceTests");
    expect(wrapper).toContain("unclaimed=touch_id_prompt_screenshot");
    expect(readme).toContain("pnpm test:macos:local-user-presence");
    expect(evidence).toContain("pnpm test:macos:local-user-presence");
    expect(evidence).toContain("code-boundary proof");
  });
});
```

- [ ] **Step 4: Run the entrypoint test and expect failure**

Run:

```bash
pnpm exec vitest --run tests/mac-local-user-presence.spec.ts
```

Expected: FAIL until the package script and docs are updated.

- [ ] **Step 5: Update docs**

Add `pnpm test:macos:local-user-presence` to README and
`docs/design/mac-companion-mvp-evidence.md` near the existing Mac companion
preflight and local-vault receipt entries. The wording must say this is a
`LocalAuthentication` code-boundary proof and must not claim full Touch ID
prompt screenshot, notarization, or physical iPhone proof.

- [ ] **Step 6: Run the entrypoint test again**

Run:

```bash
pnpm exec vitest --run tests/mac-local-user-presence.spec.ts
```

Expected: PASS.

---

### Task 7: Final Verification And Commit

**Files:**
- All files from Tasks 1-6.

- [ ] **Step 1: Run focused Mac proof**

```bash
pnpm test:macos:local-user-presence
pnpm test:macos:security-preflight
pnpm test:macos:local-vault-receipt
```

Expected: all PASS.

- [ ] **Step 2: Run focused TypeScript proof**

```bash
pnpm exec vitest --run tests/mac-local-user-presence.spec.ts tests/mac-local-vault-receipt.spec.ts tests/workspace-entrypoints.spec.ts
```

Expected: all PASS.

- [ ] **Step 3: Run repo-wide checks**

```bash
pnpm test
pnpm lint
git diff --check
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add \
  README.md \
  apps/macos/App/Sources/MacCompanionCore/LocalCompanionVaultStore.swift \
  apps/macos/App/Sources/MacCompanionCore/LocalUserPresenceAuthorizer.swift \
  apps/macos/App/Sources/UnuVaultMacCompanion/CompanionAppConfiguration.swift \
  apps/macos/App/Sources/UnuVaultMacCompanion/CompanionMenuView.swift \
  apps/macos/App/Sources/UnuVaultMacCompanion/CompanionViewModel.swift \
  apps/macos/App/Sources/UnuVaultMacCompanion/Resources/en.lproj/Localizable.strings \
  apps/macos/App/Sources/UnuVaultMacCompanion/Resources/zh-Hans.lproj/Localizable.strings \
  apps/macos/App/Tests/MacCompanionCoreTests/CompanionViewModelLocalUserPresenceTests.swift \
  docs/design/mac-companion-mvp-evidence.md \
  package.json \
  scripts/testing/run-mac-local-user-presence.sh \
  tests/mac-local-user-presence.spec.ts

git commit -m "feat: gate mac local unlock on user presence"
```

Expected: one commit with only the Mac local user-presence implementation,
proof, and documentation updates.

---

## Self-Review Checklist

- Spec coverage: Tasks 1-6 cover authorizer injection, denied/unavailable
  behavior, proof-mode allow injection, docs registration, and verification.
- Red-flag scan: no incomplete markers or unspecified implementation steps.
- Type consistency: the plan consistently uses
  `LocalUserPresenceAuthorizing`, `LocalUserPresenceAuthorizationResult`,
  `CompanionVaultStoring`, and `CompanionViewModelLocalUserPresenceTests`.
