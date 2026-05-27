# UnuVault Mac Companion MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Design authority note:** This plan records the original 2026-05-27 MVP
> implementation slice that used
> `current/unuvault/mac-companion-core-flows-v1.1`. As of 2026-05-28, the
> approved Mac companion design authority is
> `current/unuvault/mac-companion-core-flows-v1.2`; use the current frame, not
> this historical plan, for future UI implementation.

**Goal:** Build the first testable macOS companion proof for UnuVault: a native menu bar app that owns local unlock state, serves a loopback credential bridge, and lets the Web vault request one active-origin fill through explicit local approval.

**Architecture:** Add a Swift Package under `apps/macos/App` with a small `MacCompanionCore` library, a SwiftUI menu bar executable, and XCTest coverage for lock state, bridge policy, approval, timeout, and lost-device boundaries. Keep the existing Web/API bridge intact, then add a separate Web-side Mac companion client that can discover `http://127.0.0.1:17666`, request metadata, and request one approved release without making the Web app the plaintext authority.

**Tech Stack:** Swift 6, SwiftUI, Network.framework, XCTest, pnpm workspace, TypeScript, React, Vitest, current Pencil source `current/unuvault/mac-companion-core-flows-v1.2`

---

## Source Authority

- Product boundary: `README.md`
- Local-first/recovery boundary: `docs/architecture/0006-local-first-recovery-boundary.md`
- Mac companion boundary: `docs/architecture/0007-mac-companion-boundary.md`
- Current design source: `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen`, frame `current/unuvault/mac-companion-core-flows-v1.2`
- Existing local bridge reference: `apps/api/src/services/local-credential-bridge-service.ts`, `apps/api/src/routes/local-credential-bridge.ts`

## File Structure Map

- `apps/macos/App/Package.swift`
  - macOS Swift package manifest for a core library, menu bar executable, and XCTest target.
- `apps/macos/App/Sources/MacCompanionCore/CompanionModels.swift`
  - lock state, credential metadata, bridge errors, approval request, and released credential value types.
- `apps/macos/App/Sources/MacCompanionCore/CompanionVaultSession.swift`
  - in-memory MVP vault session with lock/unlock, credential matching, timeout, revoke, and lost-device clearing.
- `apps/macos/App/Sources/MacCompanionCore/CompanionBridgeService.swift`
  - pure bridge policy: status, metadata, release request, approval, and denial without HTTP parsing.
- `apps/macos/App/Sources/MacCompanionCore/LoopbackHTTPServer.swift`
  - loopback-only HTTP adapter for the bridge service, including CORS headers for the local Web dev origin.
- `apps/macos/App/Sources/UnuVaultMacCompanion/UnuVaultMacCompanionApp.swift`
  - SwiftUI `MenuBarExtra` executable wired to the session and bridge service.
- `apps/macos/App/Sources/UnuVaultMacCompanion/CompanionMenuView.swift`
  - menu bar status, unlock form, lock button, pending fill approval, lost-device/recovery copy.
- `apps/macos/App/Tests/MacCompanionCoreTests/*.swift`
  - XCTest coverage for model, bridge policy, and HTTP codec behavior.
- `scripts/testing/run-macos.sh`
  - stable local macOS test wrapper.
- `tests/workspace-entrypoints.spec.ts`
  - repo contract coverage for the macOS wrapper and design authority entry.
- `apps/web/src/lib/mac-companion/client.ts`
  - Web-side loopback client for status, metadata, and one credential release.
- `apps/web/src/components/vault/mac-companion-panel.tsx`
  - small local companion panel used by the vault screen.
- `apps/web/src/components/vault/vault-panel.tsx`
  - integrates the panel without replacing existing Web vault management.
- `apps/web/tests/mac-companion-client.spec.ts`
  - Vitest coverage for Web loopback client behavior.
- `apps/web/tests/vault-page.spec.tsx`
  - UI coverage for the local companion status/request affordance.
- `docs/design/mac-companion-mvp-evidence.md`
  - records design source, commands, screenshots, and remaining proof gaps.
- `README.md`
  - adds the macOS wrapper to human entrypoints and states the MVP boundary.

## Task 1: Register The macOS Package And Stable Test Wrapper

**Files:**
- Create: `apps/macos/App/Package.swift`
- Create: `apps/macos/App/Sources/MacCompanionCore/CompanionModels.swift`
- Create: `apps/macos/App/Sources/UnuVaultMacCompanion/UnuVaultMacCompanionApp.swift`
- Create: `apps/macos/App/Tests/MacCompanionCoreTests/PackageSmokeTests.swift`
- Create: `scripts/testing/run-macos.sh`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `tests/workspace-entrypoints.spec.ts`

- [ ] **Step 1: Write the failing workspace entrypoint test**

Add this test to `tests/workspace-entrypoints.spec.ts` inside the existing `describe("workspace entrypoints", () => { })` block:

```ts
  it("adds a stable macOS companion test wrapper", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const macosWrapperPath = "scripts/testing/run-macos.sh";

    expect(existsSync(resolve(repoRoot, "apps/macos/App/Package.swift"))).toBe(
      true,
    );
    expect(existsSync(resolve(repoRoot, macosWrapperPath))).toBe(true);
    expect(rootPackage.scripts?.["test:macos"]).toBe(
      "bash scripts/testing/run-macos.sh",
    );

    const wrapper = readText(macosWrapperPath);

    expect(wrapper).toContain("swift test --package-path");
    expect(wrapper).toContain("apps/macos/App");
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm exec vitest --run tests/workspace-entrypoints.spec.ts
```

Expected: FAIL because `apps/macos/App/Package.swift`, `scripts/testing/run-macos.sh`, and `test:macos` do not exist yet.

- [ ] **Step 3: Create the macOS Swift package skeleton**

Create `apps/macos/App/Package.swift`:

```swift
// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "UnuVaultMacCompanion",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(name: "MacCompanionCore", targets: ["MacCompanionCore"]),
        .executable(name: "UnuVaultMacCompanion", targets: ["UnuVaultMacCompanion"])
    ],
    targets: [
        .target(
            name: "MacCompanionCore",
            path: "Sources/MacCompanionCore"
        ),
        .executableTarget(
            name: "UnuVaultMacCompanion",
            dependencies: ["MacCompanionCore"],
            path: "Sources/UnuVaultMacCompanion"
        ),
        .testTarget(
            name: "MacCompanionCoreTests",
            dependencies: ["MacCompanionCore"],
            path: "Tests/MacCompanionCoreTests"
        )
    ]
)
```

Create `apps/macos/App/Sources/MacCompanionCore/CompanionModels.swift`:

```swift
import Foundation

public enum CompanionLockState: Equatable {
    case locked
    case unlocked(expiresAt: Date)
    case attentionNeeded(reason: CompanionAttentionReason)
}

public enum CompanionAttentionReason: String, Equatable {
    case lostDevice
    case revoked
    case unlockExpired
}

public struct CompanionCredential: Equatable, Identifiable {
    public let id: String
    public let label: String
    public let username: String
    public let password: String
    public let profileId: String
    public let websiteOrigin: String

    public init(
        id: String,
        label: String,
        username: String,
        password: String,
        profileId: String,
        websiteOrigin: String
    ) {
        self.id = id
        self.label = label
        self.username = username
        self.password = password
        self.profileId = profileId
        self.websiteOrigin = websiteOrigin
    }
}

public struct CompanionCredentialMetadata: Equatable, Identifiable, Codable {
    public let id: String
    public let label: String
    public let username: String

    public init(id: String, label: String, username: String) {
        self.id = id
        self.label = label
        self.username = username
    }
}
```

Create `apps/macos/App/Sources/UnuVaultMacCompanion/UnuVaultMacCompanionApp.swift`:

```swift
import MacCompanionCore
import SwiftUI

@main
struct UnuVaultMacCompanionApp: App {
    var body: some Scene {
        MenuBarExtra("UnuVault", systemImage: "lock.shield") {
            Text("UnuVault Mac Companion")
            Text("Locked")
        }
    }
}
```

Create `apps/macos/App/Tests/MacCompanionCoreTests/PackageSmokeTests.swift`:

```swift
import XCTest
@testable import MacCompanionCore

final class PackageSmokeTests: XCTestCase {
    func testCompanionCredentialMetadataIsCodable() throws {
        let metadata = CompanionCredentialMetadata(
            id: "github-login",
            label: "github.com",
            username: "yuchen"
        )

        let data = try JSONEncoder().encode(metadata)
        let decoded = try JSONDecoder().decode(
            CompanionCredentialMetadata.self,
            from: data
        )

        XCTAssertEqual(decoded, metadata)
    }
}
```

- [ ] **Step 4: Add the macOS test wrapper**

Create `scripts/testing/run-macos.sh`:

```bash
#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"

swift test --package-path "$repo_root/apps/macos/App"
```

Run:

```bash
chmod +x scripts/testing/run-macos.sh
```

- [ ] **Step 5: Register the root script and README entry**

In `package.json`, add:

```json
"test:macos": "bash scripts/testing/run-macos.sh"
```

In `README.md`, under repo-local verification commands, add:

```md
  - `bash scripts/testing/run-macos.sh`
```

- [ ] **Step 6: Run the focused verification**

Run:

```bash
pnpm exec vitest --run tests/workspace-entrypoints.spec.ts
bash scripts/testing/run-macos.sh
```

Expected: both commands pass.

- [ ] **Step 7: Commit**

```bash
git add package.json README.md tests/workspace-entrypoints.spec.ts scripts/testing/run-macos.sh apps/macos/App
git commit -m "chore: add mac companion package skeleton"
```

## Task 2: Implement The Local Lock Session And Safety States

**Files:**
- Modify: `apps/macos/App/Sources/MacCompanionCore/CompanionModels.swift`
- Create: `apps/macos/App/Sources/MacCompanionCore/CompanionVaultSession.swift`
- Create: `apps/macos/App/Tests/MacCompanionCoreTests/CompanionVaultSessionTests.swift`

- [ ] **Step 1: Write the failing session tests**

Create `apps/macos/App/Tests/MacCompanionCoreTests/CompanionVaultSessionTests.swift`:

```swift
import XCTest
@testable import MacCompanionCore

final class CompanionVaultSessionTests: XCTestCase {
    func testLockedSessionDoesNotReturnCredentials() {
        let session = CompanionVaultSession(
            now: { Date(timeIntervalSince1970: 1_000) }
        )

        XCTAssertEqual(session.lockState, .locked)
        XCTAssertEqual(
            session.metadata(origin: "https://github.com", profileId: "personal"),
            []
        )
    }

    func testUnlockReturnsOnlyExactOriginMetadataUntilTimeout() {
        var now = Date(timeIntervalSince1970: 1_000)
        let session = CompanionVaultSession(now: { now })
        let github = CompanionCredential(
            id: "github-login",
            label: "github.com",
            username: "yuchen",
            password: "secret-github",
            profileId: "personal",
            websiteOrigin: "https://github.com"
        )
        let apple = CompanionCredential(
            id: "apple-login",
            label: "apple.com",
            username: "me@example.com",
            password: "secret-apple",
            profileId: "personal",
            websiteOrigin: "https://apple.com"
        )

        session.unlock(credentials: [github, apple], ttl: 60)

        XCTAssertEqual(
            session.metadata(origin: "https://github.com/login", profileId: "personal"),
            [
                CompanionCredentialMetadata(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen"
                )
            ]
        )

        now = Date(timeIntervalSince1970: 1_061)

        XCTAssertEqual(
            session.metadata(origin: "https://github.com", profileId: "personal"),
            []
        )
        XCTAssertEqual(session.lockState, .attentionNeeded(reason: .unlockExpired))
    }

    func testLostDeviceClearsReleaseMaterial() {
        let session = CompanionVaultSession(
            now: { Date(timeIntervalSince1970: 1_000) }
        )
        session.unlock(
            credentials: [
                CompanionCredential(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    password: "secret-github",
                    profileId: "personal",
                    websiteOrigin: "https://github.com"
                )
            ],
            ttl: 60
        )

        session.markLostDevice()

        XCTAssertEqual(session.lockState, .attentionNeeded(reason: .lostDevice))
        XCTAssertEqual(
            session.metadata(origin: "https://github.com", profileId: "personal"),
            []
        )
    }
}
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
swift test --package-path apps/macos/App --filter CompanionVaultSessionTests
```

Expected: FAIL because `CompanionVaultSession` does not exist.

- [ ] **Step 3: Implement the session model**

Create `apps/macos/App/Sources/MacCompanionCore/CompanionVaultSession.swift`:

```swift
import Foundation

public final class CompanionVaultSession {
    private let now: () -> Date
    private var credentials: [CompanionCredential] = []
    private var expiresAt: Date?
    private var attentionReason: CompanionAttentionReason?

    public init(now: @escaping () -> Date = Date.init) {
        self.now = now
    }

    public var lockState: CompanionLockState {
        if let attentionReason {
            return .attentionNeeded(reason: attentionReason)
        }

        guard let expiresAt else {
            return .locked
        }

        if now() >= expiresAt {
            return .attentionNeeded(reason: .unlockExpired)
        }

        return .unlocked(expiresAt: expiresAt)
    }

    public func unlock(credentials nextCredentials: [CompanionCredential], ttl: TimeInterval) {
        credentials = nextCredentials
        expiresAt = now().addingTimeInterval(ttl)
        attentionReason = nil
    }

    public func lock() {
        credentials = []
        expiresAt = nil
        attentionReason = nil
    }

    public func markLostDevice() {
        credentials = []
        expiresAt = nil
        attentionReason = .lostDevice
    }

    public func markRevoked() {
        credentials = []
        expiresAt = nil
        attentionReason = .revoked
    }

    public func metadata(origin: String, profileId: String) -> [CompanionCredentialMetadata] {
        guard case .unlocked = lockState else {
            return []
        }

        guard let normalizedOrigin = Self.normalizedOrigin(origin) else {
            return []
        }

        return credentials
            .filter { credential in
                credential.websiteOrigin == normalizedOrigin &&
                    credential.profileId == profileId
            }
            .map { credential in
                CompanionCredentialMetadata(
                    id: credential.id,
                    label: credential.label,
                    username: credential.username
                )
            }
    }

    public func credential(id: String, origin: String, profileId: String) -> CompanionCredential? {
        guard case .unlocked = lockState else {
            return nil
        }

        guard let normalizedOrigin = Self.normalizedOrigin(origin) else {
            return nil
        }

        return credentials.first { credential in
            credential.id == id &&
                credential.websiteOrigin == normalizedOrigin &&
                credential.profileId == profileId
        }
    }

    private static func normalizedOrigin(_ value: String) -> String? {
        guard let url = URL(string: value), let scheme = url.scheme else {
            return nil
        }

        guard scheme == "http" || scheme == "https" else {
            return nil
        }

        guard let host = url.host else {
            return nil
        }

        let portPart = url.port.map { ":\($0)" } ?? ""
        return "\(scheme)://\(host)\(portPart)"
    }
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
swift test --package-path apps/macos/App --filter CompanionVaultSessionTests
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/macos/App/Sources/MacCompanionCore apps/macos/App/Tests/MacCompanionCoreTests
git commit -m "feat: add mac companion vault session model"
```

## Task 3: Add Bridge Policy With Explicit Fill Approval

**Files:**
- Modify: `apps/macos/App/Sources/MacCompanionCore/CompanionModels.swift`
- Create: `apps/macos/App/Sources/MacCompanionCore/CompanionBridgeService.swift`
- Create: `apps/macos/App/Tests/MacCompanionCoreTests/CompanionBridgeServiceTests.swift`

- [ ] **Step 1: Write the failing bridge policy tests**

Create `apps/macos/App/Tests/MacCompanionCoreTests/CompanionBridgeServiceTests.swift`:

```swift
import XCTest
@testable import MacCompanionCore

final class CompanionBridgeServiceTests: XCTestCase {
    func testLockedBridgeRejectsMetadataAndRelease() {
        let service = CompanionBridgeService(session: CompanionVaultSession())

        XCTAssertEqual(
            service.metadata(origin: "https://github.com", profileId: "personal"),
            .locked
        )
        XCTAssertEqual(
            service.requestRelease(
                id: "github-login",
                origin: "https://github.com",
                profileId: "personal",
                reason: "fill-active-page"
            ),
            .locked
        )
    }

    func testReleaseRequiresApprovalBeforeReturningSecret() {
        let session = CompanionVaultSession()
        session.unlock(
            credentials: [
                CompanionCredential(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    password: "secret-github",
                    profileId: "personal",
                    websiteOrigin: "https://github.com"
                )
            ],
            ttl: 300
        )
        let service = CompanionBridgeService(session: session)

        XCTAssertEqual(
            service.requestRelease(
                id: "github-login",
                origin: "https://github.com/login",
                profileId: "personal",
                reason: "fill-active-page"
            ),
            .approvalRequired(
                CompanionApprovalRequest(
                    id: "github-login",
                    origin: "https://github.com",
                    profileId: "personal",
                    label: "github.com",
                    username: "yuchen"
                )
            )
        )

        XCTAssertEqual(
            service.approvePendingRelease(id: "github-login"),
            .released(
                CompanionReleasedCredential(
                    username: "yuchen",
                    password: "secret-github"
                )
            )
        )

        XCTAssertEqual(service.pendingApproval, nil)
    }

    func testUnsupportedReleaseReasonFailsClosed() {
        let session = CompanionVaultSession()
        session.unlock(
            credentials: [
                CompanionCredential(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    password: "secret-github",
                    profileId: "personal",
                    websiteOrigin: "https://github.com"
                )
            ],
            ttl: 300
        )
        let service = CompanionBridgeService(session: session)

        XCTAssertEqual(
            service.requestRelease(
                id: "github-login",
                origin: "https://github.com",
                profileId: "personal",
                reason: "bulk-export"
            ),
            .invalidRequest
        )
    }
}
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
swift test --package-path apps/macos/App --filter CompanionBridgeServiceTests
```

Expected: FAIL because bridge service types do not exist.

- [ ] **Step 3: Add bridge result models**

Append to `apps/macos/App/Sources/MacCompanionCore/CompanionModels.swift`:

```swift
public struct CompanionApprovalRequest: Equatable, Identifiable, Codable {
    public let id: String
    public let origin: String
    public let profileId: String
    public let label: String
    public let username: String

    public init(
        id: String,
        origin: String,
        profileId: String,
        label: String,
        username: String
    ) {
        self.id = id
        self.origin = origin
        self.profileId = profileId
        self.label = label
        self.username = username
    }
}

public struct CompanionReleasedCredential: Equatable, Codable {
    public let username: String
    public let password: String

    public init(username: String, password: String) {
        self.username = username
        self.password = password
    }
}

public enum CompanionMetadataResult: Equatable {
    case locked
    case credentials([CompanionCredentialMetadata])
}

public enum CompanionReleaseResult: Equatable {
    case locked
    case invalidRequest
    case notFound
    case approvalRequired(CompanionApprovalRequest)
    case released(CompanionReleasedCredential)
    case denied
}
```

- [ ] **Step 4: Implement bridge service**

Create `apps/macos/App/Sources/MacCompanionCore/CompanionBridgeService.swift`:

```swift
import Foundation

public final class CompanionBridgeService {
    private let session: CompanionVaultSession
    public private(set) var pendingApproval: CompanionApprovalRequest?
    private var pendingCredential: CompanionCredential?

    public init(session: CompanionVaultSession) {
        self.session = session
    }

    public func metadata(origin: String, profileId: String) -> CompanionMetadataResult {
        let credentials = session.metadata(origin: origin, profileId: profileId)

        if credentials.isEmpty {
            guard case .unlocked = session.lockState else {
                return .locked
            }
        }

        return .credentials(credentials)
    }

    public func requestRelease(
        id: String,
        origin: String,
        profileId: String,
        reason: String
    ) -> CompanionReleaseResult {
        guard reason == "fill-active-page" else {
            return .invalidRequest
        }

        guard case .unlocked = session.lockState else {
            return .locked
        }

        guard let credential = session.credential(
            id: id,
            origin: origin,
            profileId: profileId
        ) else {
            return .notFound
        }

        let approval = CompanionApprovalRequest(
            id: credential.id,
            origin: credential.websiteOrigin,
            profileId: credential.profileId,
            label: credential.label,
            username: credential.username
        )
        pendingApproval = approval
        pendingCredential = credential

        return .approvalRequired(approval)
    }

    public func approvePendingRelease(id: String) -> CompanionReleaseResult {
        guard pendingApproval?.id == id, let credential = pendingCredential else {
            return .notFound
        }

        pendingApproval = nil
        pendingCredential = nil

        return .released(
            CompanionReleasedCredential(
                username: credential.username,
                password: credential.password
            )
        )
    }

    public func denyPendingRelease(id: String) -> CompanionReleaseResult {
        guard pendingApproval?.id == id else {
            return .notFound
        }

        pendingApproval = nil
        pendingCredential = nil
        return .denied
    }

    public func clearPendingApproval() {
        pendingApproval = nil
        pendingCredential = nil
    }
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
swift test --package-path apps/macos/App --filter CompanionBridgeServiceTests
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/macos/App/Sources/MacCompanionCore apps/macos/App/Tests/MacCompanionCoreTests
git commit -m "feat: require local approval for mac companion release"
```

## Task 4: Add Loopback HTTP Adapter For The Companion

**Files:**
- Create: `apps/macos/App/Sources/MacCompanionCore/BridgeHTTPCodec.swift`
- Create: `apps/macos/App/Sources/MacCompanionCore/LoopbackHTTPServer.swift`
- Create: `apps/macos/App/Tests/MacCompanionCoreTests/BridgeHTTPCodecTests.swift`

- [ ] **Step 1: Write the failing HTTP codec tests**

Create `apps/macos/App/Tests/MacCompanionCoreTests/BridgeHTTPCodecTests.swift`:

```swift
import XCTest
@testable import MacCompanionCore

final class BridgeHTTPCodecTests: XCTestCase {
    func testStatusResponseDoesNotExposeSecrets() throws {
        let session = CompanionVaultSession()
        session.unlock(
            credentials: [
                CompanionCredential(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    password: "secret-github",
                    profileId: "personal",
                    websiteOrigin: "https://github.com"
                )
            ],
            ttl: 300
        )
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: session),
            accessToken: "bridge-token"
        )

        let response = codec.handle(
            method: "GET",
            path: "/status",
            headers: [:],
            body: Data()
        )

        XCTAssertEqual(response.statusCode, 200)
        XCTAssertTrue(response.bodyString.contains("\"state\":\"unlocked\""))
        XCTAssertFalse(response.bodyString.contains("secret-github"))
    }

    func testReleaseRequiresBearerToken() {
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: CompanionVaultSession()),
            accessToken: "bridge-token"
        )

        let response = codec.handle(
            method: "POST",
            path: "/v1/credentials/release",
            headers: [:],
            body: Data()
        )

        XCTAssertEqual(response.statusCode, 401)
        XCTAssertTrue(response.bodyString.contains("invalid_bridge_token"))
    }
}
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
swift test --package-path apps/macos/App --filter BridgeHTTPCodecTests
```

Expected: FAIL because `BridgeHTTPCodec` does not exist.

- [ ] **Step 3: Implement the HTTP codec**

Create `apps/macos/App/Sources/MacCompanionCore/BridgeHTTPCodec.swift`:

```swift
import Foundation

public struct BridgeHTTPResponse: Equatable {
    public let statusCode: Int
    public let headers: [String: String]
    public let body: Data

    public var bodyString: String {
        String(data: body, encoding: .utf8) ?? ""
    }
}

public final class BridgeHTTPCodec {
    private let service: CompanionBridgeService
    private let accessToken: String

    public init(service: CompanionBridgeService, accessToken: String) {
        self.service = service
        self.accessToken = accessToken
    }

    public func handle(
        method: String,
        path: String,
        headers: [String: String],
        body: Data
    ) -> BridgeHTTPResponse {
        if method == "OPTIONS" {
            return json(statusCode: 204, payload: [:] as [String: String])
        }

        if method == "GET", path == "/status" {
            return statusResponse()
        }

        guard headers["authorization"] == "Bearer \(accessToken)" else {
            return json(
                statusCode: 401,
                payload: ["ok": false, "error": "invalid_bridge_token"] as [String: CodableValue]
            )
        }

        return json(
            statusCode: 404,
            payload: ["ok": false, "error": "not_found"] as [String: CodableValue]
        )
    }

    private func statusResponse() -> BridgeHTTPResponse {
        let state: String

        switch service.metadata(origin: "https://example.invalid", profileId: "status-check") {
        case .locked:
            state = "locked"
        case .credentials:
            state = "unlocked"
        }

        return json(
            statusCode: 200,
            payload: ["ok": true, "state": state] as [String: CodableValue]
        )
    }

    private func json<T: Encodable>(statusCode: Int, payload: T) -> BridgeHTTPResponse {
        let data = (try? JSONEncoder().encode(payload)) ?? Data("{}".utf8)
        return BridgeHTTPResponse(
            statusCode: statusCode,
            headers: [
                "access-control-allow-headers": "authorization, content-type",
                "access-control-allow-methods": "GET, POST, OPTIONS",
                "access-control-allow-origin": "http://127.0.0.1:3001",
                "content-type": "application/json"
            ],
            body: data
        )
    }
}

public enum CodableValue: Codable, Equatable, ExpressibleByBooleanLiteral, ExpressibleByStringLiteral {
    case bool(Bool)
    case string(String)

    public init(booleanLiteral value: Bool) {
        self = .bool(value)
    }

    public init(stringLiteral value: String) {
        self = .string(value)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .bool(let value):
            try container.encode(value)
        case .string(let value):
            try container.encode(value)
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
            return
        }
        self = .string(try container.decode(String.self))
    }
}
```

Add these tests to `apps/macos/App/Tests/MacCompanionCoreTests/BridgeHTTPCodecTests.swift` before running Step 5:

```swift
    func testCredentialMetadataResponseUsesActiveOriginOnly() {
        let session = CompanionVaultSession()
        session.unlock(
            credentials: [
                CompanionCredential(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    password: "secret-github",
                    profileId: "personal",
                    websiteOrigin: "https://github.com"
                ),
                CompanionCredential(
                    id: "apple-login",
                    label: "apple.com",
                    username: "me@example.com",
                    password: "secret-apple",
                    profileId: "personal",
                    websiteOrigin: "https://apple.com"
                )
            ],
            ttl: 300
        )
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: session),
            accessToken: "bridge-token"
        )

        let response = codec.handle(
            method: "GET",
            path: "/v1/credentials?origin=https%3A%2F%2Fgithub.com%2Flogin&profileId=personal",
            headers: ["authorization": "Bearer bridge-token"],
            body: Data()
        )

        XCTAssertEqual(response.statusCode, 200)
        XCTAssertTrue(response.bodyString.contains("github-login"))
        XCTAssertFalse(response.bodyString.contains("apple-login"))
        XCTAssertFalse(response.bodyString.contains("secret-github"))
    }

    func testReleaseResponseCreatesApprovalRequestBeforeSecretRelease() throws {
        let session = CompanionVaultSession()
        session.unlock(
            credentials: [
                CompanionCredential(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    password: "secret-github",
                    profileId: "personal",
                    websiteOrigin: "https://github.com"
                )
            ],
            ttl: 300
        )
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: session),
            accessToken: "bridge-token"
        )

        let releaseResponse = codec.handle(
            method: "POST",
            path: "/v1/credentials/release",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"github-login","origin":"https://github.com/login","profileId":"personal","reason":"fill-active-page"}
            """.utf8)
        )

        XCTAssertEqual(releaseResponse.statusCode, 409)
        XCTAssertTrue(releaseResponse.bodyString.contains("approval_required"))
        XCTAssertFalse(releaseResponse.bodyString.contains("secret-github"))

        let approveResponse = codec.handle(
            method: "POST",
            path: "/v1/credentials/approve",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"github-login"}
            """.utf8)
        )

        XCTAssertEqual(approveResponse.statusCode, 200)
        XCTAssertTrue(approveResponse.bodyString.contains("secret-github"))
    }
```

Extend `BridgeHTTPCodec.handle(method:path:headers:body:)` in the same file so it parses these routes:

- `GET /v1/credentials?origin=https%3A%2F%2Fgithub.com&profileId=personal`
- `POST /v1/credentials/release` with JSON body `{ "id": "github-login", "origin": "https://github.com/login", "profileId": "personal", "reason": "fill-active-page" }`
- `POST /v1/credentials/approve` with JSON body `{ "id": "github-login" }`
- `POST /v1/credentials/deny` with JSON body `{ "id": "github-login" }`

Use these exact response shapes in the tests:

```json
{ "credentials": [{ "id": "github-login", "label": "github.com", "username": "yuchen" }] }
{ "ok": false, "error": "approval_required", "approval": { "id": "github-login", "origin": "https://github.com", "profileId": "personal", "label": "github.com", "username": "yuchen" } }
{ "credential": { "username": "yuchen", "password": "secret-github" } }
```

- [ ] **Step 4: Add the loopback server adapter**

Create `apps/macos/App/Sources/MacCompanionCore/LoopbackHTTPServer.swift`:

```swift
import Foundation
import Network

public final class LoopbackHTTPServer {
    private let codec: BridgeHTTPCodec
    private let port: NWEndpoint.Port
    private var listener: NWListener?

    public init(codec: BridgeHTTPCodec, port: UInt16 = 17666) {
        self.codec = codec
        self.port = NWEndpoint.Port(rawValue: port) ?? 17666
    }

    public func start() throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(
            host: .ipv4(IPv4Address("127.0.0.1")!),
            port: port
        )
        let listener = try NWListener(using: parameters, on: port)
        listener.newConnectionHandler = { [codec] connection in
            connection.start(queue: .global(qos: .userInitiated))
            connection.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { data, _, _, _ in
                guard let data else {
                    connection.cancel()
                    return
                }

                let request = String(data: data, encoding: .utf8) ?? ""
                let response = Self.render(response: Self.route(request: request, codec: codec))
                connection.send(content: response, completion: .contentProcessed { _ in
                    connection.cancel()
                })
            }
        }
        listener.start(queue: .global(qos: .userInitiated))
        self.listener = listener
    }

    public func stop() {
        listener?.cancel()
        listener = nil
    }

    private static func route(request: String, codec: BridgeHTTPCodec) -> BridgeHTTPResponse {
        let lines = request.split(separator: "\r\n", omittingEmptySubsequences: false)
        let requestLine = lines.first?.split(separator: " ") ?? []
        let method = requestLine.first.map(String.init) ?? "GET"
        let path = requestLine.dropFirst().first.map(String.init) ?? "/"
        let headers = Dictionary(
            uniqueKeysWithValues: lines.dropFirst().compactMap { line -> (String, String)? in
                guard let range = line.range(of: ":") else {
                    return nil
                }
                let key = line[..<range.lowerBound].lowercased()
                let value = line[range.upperBound...].trimmingCharacters(in: .whitespaces)
                return (String(key), value)
            }
        )
        let bodyText = request.components(separatedBy: "\r\n\r\n").dropFirst().joined(separator: "\r\n\r\n")

        return codec.handle(
            method: method,
            path: path,
            headers: headers,
            body: Data(bodyText.utf8)
        )
    }

    private static func render(response: BridgeHTTPResponse) -> Data {
        let reason = response.statusCode == 200 ? "OK" : "OK"
        var lines = ["HTTP/1.1 \(response.statusCode) \(reason)"]
        for (key, value) in response.headers {
            lines.append("\(key): \(value)")
        }
        lines.append("content-length: \(response.body.count)")
        lines.append("")
        lines.append("")

        var data = Data(lines.joined(separator: "\r\n").utf8)
        data.append(response.body)
        return data
    }
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
swift test --package-path apps/macos/App --filter BridgeHTTPCodecTests
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/macos/App/Sources/MacCompanionCore apps/macos/App/Tests/MacCompanionCoreTests
git commit -m "feat: add mac companion loopback bridge adapter"
```

## Task 5: Build The Menu Bar Companion Surface

**Files:**
- Modify: `apps/macos/App/Sources/UnuVaultMacCompanion/UnuVaultMacCompanionApp.swift`
- Create: `apps/macos/App/Sources/UnuVaultMacCompanion/CompanionViewModel.swift`
- Create: `apps/macos/App/Sources/UnuVaultMacCompanion/CompanionMenuView.swift`

- [ ] **Step 1: Create the view model**

Create `apps/macos/App/Sources/UnuVaultMacCompanion/CompanionViewModel.swift`:

```swift
import Foundation
import MacCompanionCore

@MainActor
final class CompanionViewModel: ObservableObject {
    @Published var masterPassword = ""
    @Published var statusText = "Locked"
    @Published var pendingApproval: CompanionApprovalRequest?
    @Published var lastDecisionText = "No fill requests yet."

    private let session = CompanionVaultSession()
    private lazy var bridgeService = CompanionBridgeService(session: session)
    private var server: LoopbackHTTPServer?

    func start() {
        let codec = BridgeHTTPCodec(
            service: bridgeService,
            accessToken: "local-dev-bridge-token"
        )
        server = LoopbackHTTPServer(codec: codec)
        try? server?.start()
        refresh()
    }

    func unlockForDemo() {
        session.unlock(
            credentials: [
                CompanionCredential(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    password: "demo-password",
                    profileId: "personal",
                    websiteOrigin: "https://github.com"
                )
            ],
            ttl: 300
        )
        masterPassword = ""
        refresh()
    }

    func lock() {
        session.lock()
        bridgeService.clearPendingApproval()
        pendingApproval = nil
        refresh()
    }

    func approvePendingFill() {
        guard let pendingApproval else {
            return
        }
        _ = bridgeService.approvePendingRelease(id: pendingApproval.id)
        lastDecisionText = "Filled once for \(pendingApproval.origin)"
        self.pendingApproval = nil
        refresh()
    }

    func denyPendingFill() {
        guard let pendingApproval else {
            return
        }
        _ = bridgeService.denyPendingRelease(id: pendingApproval.id)
        lastDecisionText = "Denied fill for \(pendingApproval.origin)"
        self.pendingApproval = nil
        refresh()
    }

    func refresh() {
        pendingApproval = bridgeService.pendingApproval

        switch session.lockState {
        case .locked:
            statusText = "Locked"
        case .unlocked:
            statusText = "Unlocked"
        case .attentionNeeded(let reason):
            statusText = "Attention: \(reason.rawValue)"
        }
    }
}
```

- [ ] **Step 2: Create the menu view**

Create `apps/macos/App/Sources/UnuVaultMacCompanion/CompanionMenuView.swift`:

```swift
import SwiftUI

struct CompanionMenuView: View {
    @ObservedObject var viewModel: CompanionViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("UnuVault")
                    .font(.headline)
                Spacer()
                Text(viewModel.statusText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            SecureField("Master password", text: $viewModel.masterPassword)

            HStack {
                Button("Unlock local vault") {
                    viewModel.unlockForDemo()
                }
                Button("Lock") {
                    viewModel.lock()
                }
            }

            Divider()

            if let approval = viewModel.pendingApproval {
                Text("Allow password fill?")
                    .font(.headline)
                Text("\(approval.origin) requests \(approval.label)")
                    .font(.caption)
                HStack {
                    Button("Deny") {
                        viewModel.denyPendingFill()
                    }
                    Button("Fill once") {
                        viewModel.approvePendingFill()
                    }
                    .keyboardShortcut(.defaultAction)
                }
            } else {
                Text(viewModel.lastDecisionText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Divider()

            Text("Lost-device recovery requires a trusted Mac, user-held recovery key, or encrypted backup. No server-side plaintext recovery.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(width: 340)
    }
}
```

- [ ] **Step 3: Wire the menu bar app**

Replace `apps/macos/App/Sources/UnuVaultMacCompanion/UnuVaultMacCompanionApp.swift` with:

```swift
import SwiftUI

@main
struct UnuVaultMacCompanionApp: App {
    @StateObject private var viewModel = CompanionViewModel()

    var body: some Scene {
        MenuBarExtra("UnuVault", systemImage: "lock.shield") {
            CompanionMenuView(viewModel: viewModel)
                .onAppear {
                    viewModel.start()
                }
        }
        .menuBarExtraStyle(.window)
    }
}
```

- [ ] **Step 4: Run macOS tests**

Run:

```bash
bash scripts/testing/run-macos.sh
```

Expected: PASS.

- [ ] **Step 5: Manual smoke**

Run:

```bash
cd apps/macos/App
swift run UnuVaultMacCompanion
```

Expected: A menu bar item appears. The app shows `Locked`, allows demo unlock, and does not expose the demo password in the menu unless a fill request is approved.

- [ ] **Step 6: Commit**

```bash
git add apps/macos/App
git commit -m "feat: add mac companion menu bar surface"
```

## Task 6: Add The Web Mac Companion Client

**Files:**
- Create: `apps/web/src/lib/mac-companion/client.ts`
- Create: `apps/web/tests/mac-companion-client.spec.ts`

- [ ] **Step 1: Write the failing Web client tests**

Create `apps/web/tests/mac-companion-client.spec.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  getMacCompanionStatus,
  requestMacCompanionCredentialRelease,
} from "../src/lib/mac-companion/client";

describe("mac companion client", () => {
  it("reads status from the local loopback companion", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, state: "locked" }),
    });

    await expect(getMacCompanionStatus({ fetcher })).resolves.toEqual({
      ok: true,
      state: "locked",
    });

    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:17666/status", {
      method: "GET",
    });
  });

  it("requests one active-origin credential release with bearer token", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        error: "approval_required",
        approval: {
          id: "github-login",
          origin: "https://github.com",
          profileId: "personal",
          label: "github.com",
          username: "yuchen",
        },
      }),
    });

    await expect(
      requestMacCompanionCredentialRelease({
        accessToken: "local-dev-bridge-token",
        fetcher,
        id: "github-login",
        origin: "https://github.com/login",
        profileId: "personal",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "approval_required",
      approval: {
        id: "github-login",
        origin: "https://github.com",
        profileId: "personal",
        label: "github.com",
        username: "yuchen",
      },
    });
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm --filter @unuvault/web exec vitest --run tests/mac-companion-client.spec.ts
```

Expected: FAIL because `apps/web/src/lib/mac-companion/client.ts` does not exist.

- [ ] **Step 3: Implement the Web client**

Create `apps/web/src/lib/mac-companion/client.ts`:

```ts
type CompanionFetcher = typeof fetch;

export type MacCompanionStatus = {
  ok: true;
  state: "locked" | "unlocked" | "attention";
};

type RequestReleaseOptions = {
  accessToken: string;
  fetcher?: CompanionFetcher;
  id: string;
  origin: string;
  profileId: string;
};

type StatusOptions = {
  fetcher?: CompanionFetcher;
};

async function readJson<T>(response: Awaited<ReturnType<CompanionFetcher>>): Promise<T> {
  return (await response.json()) as T;
}

export async function getMacCompanionStatus(
  options: StatusOptions = {},
): Promise<MacCompanionStatus | { ok: false; error: string }> {
  const fetcher = options.fetcher ?? fetch;

  try {
    const response = await fetcher("http://127.0.0.1:17666/status", {
      method: "GET",
    });

    return readJson<MacCompanionStatus | { ok: false; error: string }>(response);
  } catch {
    return { ok: false, error: "mac_companion_unavailable" };
  }
}

export async function requestMacCompanionCredentialRelease(
  options: RequestReleaseOptions,
): Promise<
  | { ok: false; error: string; approval?: unknown }
  | { credential: { username: string; password: string } }
> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher("http://127.0.0.1:17666/v1/credentials/release", {
    body: JSON.stringify({
      id: options.id,
      origin: options.origin,
      profileId: options.profileId,
      reason: "fill-active-page",
    }),
    headers: {
      authorization: `Bearer ${options.accessToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });

  return readJson(response);
}
```

- [ ] **Step 4: Run focused Web tests**

Run:

```bash
pnpm --filter @unuvault/web exec vitest --run tests/mac-companion-client.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/mac-companion apps/web/tests/mac-companion-client.spec.ts
git commit -m "feat: add web mac companion client"
```

## Task 7: Surface Companion Status In The Web Vault

**Files:**
- Create: `apps/web/src/components/vault/mac-companion-panel.tsx`
- Modify: `apps/web/src/components/vault/vault-panel.tsx`
- Modify: `apps/web/tests/vault-page.spec.tsx`

- [ ] **Step 1: Write the failing UI test**

Add this test to `apps/web/tests/vault-page.spec.tsx`:

```tsx
  it("shows the Mac companion as the local-first fill authority", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
      },
      error: null,
    });
    mocks.syncVault.mockResolvedValue({
      items: [],
      lastSyncedAt: "2026-05-27T00:00:00.000Z",
    });

    render(<VaultPage />);

    expect(
      await screen.findByText("Mac companion"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Local fill requests require the unlocked Mac companion."),
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm --filter @unuvault/web exec vitest --run tests/vault-page.spec.tsx
```

Expected: FAIL because the Mac companion panel is not rendered.

- [ ] **Step 3: Create the panel component**

Create `apps/web/src/components/vault/mac-companion-panel.tsx`:

```tsx
"use client";

export function MacCompanionPanel() {
  return (
    <section className="vault-card vault-card-muted" aria-label="Mac companion">
      <div className="vault-card-header">
        <div>
          <h2>Mac companion</h2>
          <p>Local fill requests require the unlocked Mac companion.</p>
        </div>
        <span className="status-pill status-pill-neutral">Local-first</span>
      </div>
      <p className="vault-helper-text">
        Web can manage the vault, but plaintext release stays with the trusted
        local Mac app.
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Render it from the vault panel**

In `apps/web/src/components/vault/vault-panel.tsx`, add:

```tsx
import { MacCompanionPanel } from "./mac-companion-panel";
```

Render `<MacCompanionPanel />` near the existing vault status area, above the item list and below the master password section. Keep this component presentational in this task; do not make it release passwords from the browser UI yet.

- [ ] **Step 5: Run focused Web tests**

Run:

```bash
pnpm --filter @unuvault/web exec vitest --run tests/vault-page.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/vault apps/web/tests/vault-page.spec.tsx
git commit -m "feat: show mac companion vault boundary"
```

## Task 8: Record Evidence And Run The Closeout Verification

**Files:**
- Create: `docs/design/mac-companion-mvp-evidence.md`
- Modify: `README.md`

- [ ] **Step 1: Create the evidence document**

Create `docs/design/mac-companion-mvp-evidence.md`:

```md
# Mac Companion MVP Evidence

## Design Source

- Pencil current: `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen`
- Current frame: `current/unuvault/mac-companion-core-flows-v1.2`

## Boundary

- The Mac companion is the local trusted root for local-first fill.
- The Web vault remains the management surface.
- Locked companion state rejects metadata and release.
- Unlocked companion state can return metadata for the active origin.
- Secret release requires `reason: "fill-active-page"` and local approval.
- Lost-device, revoke, lock, and timeout clear release ability.

## Verification Commands

```bash
bash scripts/testing/run-macos.sh
pnpm --filter @unuvault/web exec vitest --run tests/mac-companion-client.spec.ts tests/vault-page.spec.tsx
pnpm exec vitest --run tests/workspace-entrypoints.spec.ts
pnpm lint
pnpm test
```

## Remaining Proof Gaps

- Native app notarization and login-item behavior are not claimed.
- Touch ID is not claimed until LocalAuthentication proof exists.
- Physical iPhone pairing is not claimed until a real LAN pairing run is captured.
- Server-backed account recovery is not claimed to recover plaintext without trusted material.
```

- [ ] **Step 2: Update README with the MVP status**

Under `Workspace Layout`, change the `future apps/macos/` bullet to:

```md
- `apps/macos/` - native Mac companion proof for local unlock, loopback
  credential release, and future device pairing
```

Under `Human Entrypoints`, ensure this line exists:

```md
  - `bash scripts/testing/run-macos.sh`
```

- [ ] **Step 3: Run full verification**

Run:

```bash
bash scripts/testing/run-macos.sh
pnpm --filter @unuvault/web exec vitest --run tests/mac-companion-client.spec.ts tests/vault-page.spec.tsx
pnpm exec vitest --run tests/workspace-entrypoints.spec.ts
pnpm lint
pnpm test
```

Expected: all commands pass. If `bash scripts/testing/run-macos.sh` fails because the host has no usable Swift macOS toolchain, record the exact error in the closeout and do not claim Mac proof complete.

- [ ] **Step 4: Self-review the security boundary**

Check these statements directly in the changed files:

```bash
rg -n "server-side plaintext|bulk plaintext|fill-active-page|lost-device|current/unuvault/mac-companion-core-flows-v1.2" README.md docs apps/macos apps/web
```

Expected:

- `docs/design/mac-companion-mvp-evidence.md` names the current Pencil frame.
- `README.md` names `apps/macos/`.
- Swift bridge policy only releases for `fill-active-page`.
- Web copy does not claim server-side plaintext recovery.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/design/mac-companion-mvp-evidence.md
git commit -m "docs: record mac companion mvp evidence"
```

## Final Verification Before Push

Run:

```bash
git status --short --branch
pnpm lint
pnpm test
bash scripts/testing/run-macos.sh
```

Expected:

- Branch is clean after the final commit.
- `pnpm lint` passes.
- `pnpm test` passes.
- `bash scripts/testing/run-macos.sh` passes on a Mac with Swift 6/macOS 14+ SDK support.

## Execution Notes

- Keep the first Mac proof local-only and loopback-only.
- Do not add hosted account login, cloud conflict resolution, Touch ID, notarization, or physical iPhone pairing to this MVP unless a new plan expands the scope.
- Do not change the existing API bridge behavior unless the Web/Mac integration tests expose a specific compatibility issue.
- Do not promote any further Pencil frames unless visible UI diverges from `current/unuvault/mac-companion-core-flows-v1.2`.

## Self-Review

- Spec coverage: tasks cover package registration, local lock state, loopback bridge policy, local approval, Web companion client, Web vault boundary copy, and evidence docs.
- Placeholder scan: no placeholder markers or undefined follow-up step is required for this MVP.
- Type consistency: Swift model names use the `Companion*` prefix throughout; Web client names use `MacCompanion*`; bridge release reason remains `fill-active-page`.
