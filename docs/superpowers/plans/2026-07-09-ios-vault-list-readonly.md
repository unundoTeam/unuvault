# iOS Vault List Read-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render imported iOS vault metadata in a read-only list without exposing passwords.

**Architecture:** Keep `VaultListModel` as the data boundary and make
`VaultListView` render only `VaultListItem` metadata. The view stays native
SwiftUI and intentionally avoids edit, delete, fill, search, and sync actions.

**Tech Stack:** SwiftUI, XCTest, existing iOS App package scripts.

---

### Task 1: Vault List Rendering

**Files:**
- Modify: `apps/ios/App/Tests/VaultListModelTests.swift`
- Modify: `apps/ios/App/Sources/Features/Vault/VaultListView.swift`

- [x] **Step 1: Write the failing rendering test**

Add a test that renders `VaultListView(model:)` with two metadata items and
asserts that the visible body includes `label`, `username`, and `websiteOrigin`
but not password-related strings:

```swift
func testVaultListViewRendersMetadataWithoutPasswords() {
    let model = VaultListModel(
        items: [
            VaultListItem(
                id: "github-login",
                label: "github.com",
                username: "yuchen",
                websiteOrigin: "https://github.com"
            ),
            VaultListItem(
                id: "bank-login",
                label: "Bank",
                username: "me@example.com",
                websiteOrigin: "https://bank.example"
            )
        ]
    )

    let renderedBody = String(describing: VaultListView(model: model).body)

    XCTAssertTrue(renderedBody.contains("github.com"))
    XCTAssertTrue(renderedBody.contains("yuchen"))
    XCTAssertTrue(renderedBody.contains("https://github.com"))
    XCTAssertTrue(renderedBody.contains("Bank"))
    XCTAssertTrue(renderedBody.contains("me@example.com"))
    XCTAssertTrue(renderedBody.contains("https://bank.example"))
    XCTAssertFalse(renderedBody.contains("secret"))
    XCTAssertFalse(renderedBody.contains("password"))
}
```

- [x] **Step 2: Run the focused iOS test to verify it fails**

Run:

```bash
bash scripts/testing/run-ios.sh
```

Expected: `VaultListModelTests` fails because `VaultListModel(items:)` and
`VaultListView(model:)` do not exist yet.

- [x] **Step 3: Implement the minimal rendering surface**

Add a direct `VaultListModel(items:)` initializer and make `VaultListView`
accept a model:

```swift
struct VaultListModel: Equatable, Sendable {
    let items: [VaultListItem]

    init(items: [VaultListItem] = []) {
        self.items = items
    }

    init(importStore: PairingHandoffImportStore) {
        self.init(
            items: importStore.importedCredentialMetadata().map {
                VaultListItem(
                    id: $0.id,
                    label: $0.label,
                    username: $0.username,
                    websiteOrigin: $0.websiteOrigin
                )
            }
        )
    }
}
```

Render rows with native SwiftUI text:

```swift
struct VaultListView: View {
    let model: VaultListModel

    init(model: VaultListModel = VaultListModel()) {
        self.model = model
    }

    var body: some View {
        List {
            ForEach(model.items) { item in
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.label)
                    Text(item.username)
                    Text(item.websiteOrigin)
                }
            }
        }
    }
}
```

- [x] **Step 4: Run the iOS test to verify it passes**

Run:

```bash
bash scripts/testing/run-ios.sh
```

Expected: all iOS tests pass.

### Task 2: Empty State

**Files:**
- Modify: `apps/ios/App/Tests/VaultListModelTests.swift`
- Modify: `apps/ios/App/Sources/Features/Vault/VaultListView.swift`

- [x] **Step 1: Write the failing empty state test**

Add:

```swift
func testVaultListViewShowsEmptyStateWhenNoImportedItemsExist() {
    let renderedBody = String(
        describing: VaultListView(model: VaultListModel(items: [])).body
    )

    XCTAssertTrue(renderedBody.contains("No imported vault items yet"))
    XCTAssertTrue(renderedBody.contains("Pair with your Mac to receive local vault metadata."))
}
```

- [x] **Step 2: Run the focused iOS test to verify it fails**

Run:

```bash
bash scripts/testing/run-ios.sh
```

Expected: `testVaultListViewShowsEmptyStateWhenNoImportedItemsExist` fails
because the empty state copy is not rendered.

- [x] **Step 3: Implement the empty state**

Update `VaultListView.body`:

```swift
var body: some View {
    List {
        if model.items.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text("No imported vault items yet")
                Text("Pair with your Mac to receive local vault metadata.")
            }
        } else {
            ForEach(model.items) { item in
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.label)
                    Text(item.username)
                    Text(item.websiteOrigin)
                }
            }
        }
    }
}
```

- [x] **Step 4: Run full validation**

Run:

```bash
bash scripts/testing/run-ios.sh
bash scripts/testing/run-pairing-boundary.sh
git diff --check
```

Expected: all commands exit 0. The LAN pairing smoke may remain skipped unless
`UNUVAULT_PAIRING_LAN_HOST` is set.
