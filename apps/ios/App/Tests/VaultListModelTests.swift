import CryptoKit
import Foundation
import XCTest
@testable import App

final class VaultListModelTests: XCTestCase {
    @MainActor
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

    @MainActor
    func testVaultListViewRendersReadOnlyContextCopy() {
        let renderedBody = String(
            describing: VaultListView(
                model: VaultListModel(
                    items: [
                        VaultListItem(
                            id: "github-login",
                            label: "github.com",
                            username: "yuchen",
                            websiteOrigin: "https://github.com"
                        )
                    ]
                )
            ).body
        )

        XCTAssertTrue(renderedBody.contains("Vault"))
        XCTAssertTrue(renderedBody.contains("Local items received from your Mac."))
        XCTAssertTrue(renderedBody.contains("Sensitive values stay hidden"))
        XCTAssertTrue(renderedBody.contains("Imported items"))
    }

    @MainActor
    func testVaultListViewShowsEmptyStateWhenNoImportedItemsExist() {
        let renderedBody = String(
            describing: VaultListView(model: VaultListModel(items: [])).body
        )

        XCTAssertTrue(renderedBody.contains("No imported vault items yet"))
        XCTAssertTrue(renderedBody.contains("Pair with your Mac to receive local vault metadata."))
    }

    @MainActor
    func testVaultListViewDefaultInitializerExecutesMetadataOnlyLoading() throws {
        let view = VaultListView()
        let encodedItems = try JSONEncoder().encode(view.model.items)
        let serializedItems = try JSONSerialization.jsonObject(
            with: encodedItems
        ) as? [[String: Any]]

        XCTAssertNotNil(serializedItems)
        XCTAssertTrue(
            serializedItems?.allSatisfy {
                Set($0.keys) == ["id", "label", "username", "websiteOrigin"]
            } ?? false
        )
    }

    func testVaultListModelReadsImportedMetadataWithoutPasswords() throws {
        let storeURL = try temporaryEncryptedStoreURL()
        let encryptionKey = SymmetricKey(size: .bits256)
        var importStore = try PairingHandoffImportStore(
            encryptedStoreURL: storeURL,
            encryptionKey: encryptionKey
        )
        let credentials = [
            PairingImportedCredential(
                id: "github-login",
                label: "github.com",
                username: "yuchen",
                password: "secret-github",
                profileId: "personal",
                websiteOrigin: "https://github.com"
            ),
            PairingImportedCredential(
                id: "bank-login",
                label: "Bank",
                username: "me@example.com",
                password: "secret-bank",
                profileId: "personal",
                websiteOrigin: "https://bank.example"
            )
        ]
        _ = try importStore.importPayload(
            PairingHandoffOpenedPayload(items: credentials),
            from: makeHandoff()
        )
        let reloadedStore = try PairingHandoffImportStore(
            encryptedStoreURL: storeURL,
            encryptionKey: encryptionKey
        )

        let model = VaultListModel(importStore: reloadedStore)

        XCTAssertEqual(
            model.items,
            [
                VaultListItem(
                    id: "bank-login",
                    label: "Bank",
                    username: "me@example.com",
                    websiteOrigin: "https://bank.example"
                ),
                VaultListItem(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    websiteOrigin: "https://github.com"
                )
            ]
        )

        let encodedModel = String(
            data: try JSONEncoder().encode(model.items),
            encoding: .utf8
        ) ?? ""
        XCTAssertFalse(encodedModel.contains("secret-bank"))
        XCTAssertFalse(encodedModel.contains("secret-github"))
        XCTAssertFalse(encodedModel.contains("password"))
    }

    func testReceivedVaultLoaderReadsPersistedMetadataWithoutPasswords() throws {
        let storeURL = try temporaryEncryptedStoreURL()
        let encryptionKey = SymmetricKey(size: .bits256)
        try persistReceivedVault(at: storeURL, encryptionKey: encryptionKey)
        let configuration = PairingReceivedVaultStoreConfiguration(
            encryptedStoreURL: storeURL,
            encryptionKeyProvider: { encryptionKey }
        )

        let model = VaultListModel.loadReceivedVault(from: configuration)

        XCTAssertEqual(model.items, expectedVaultListItems())
        let encodedItems = String(
            data: try JSONEncoder().encode(model.items),
            encoding: .utf8
        ) ?? ""
        XCTAssertFalse(encodedItems.contains("secret-bank"))
        XCTAssertFalse(encodedItems.contains("secret-github"))
        XCTAssertFalse(encodedItems.contains("password"))
    }

    @MainActor
    func testVaultListViewLoadsPersistedMetadataThroughReceivedVaultConfiguration() throws {
        let storeURL = try temporaryEncryptedStoreURL()
        let encryptionKey = SymmetricKey(size: .bits256)
        try persistReceivedVault(at: storeURL, encryptionKey: encryptionKey)
        let configuration = PairingReceivedVaultStoreConfiguration(
            encryptedStoreURL: storeURL,
            encryptionKeyProvider: { encryptionKey }
        )

        let view = VaultListView(receivedVaultStoreConfiguration: configuration)

        XCTAssertEqual(view.model.items, expectedVaultListItems())
    }

    func testReceivedVaultLoaderFailsClosedWhenStoreIsMissing() throws {
        let storeURL = try temporaryEncryptedStoreURL()
        let encryptionKey = SymmetricKey(size: .bits256)
        let configuration = PairingReceivedVaultStoreConfiguration(
            encryptedStoreURL: storeURL,
            encryptionKeyProvider: { encryptionKey }
        )

        let model = VaultListModel.loadReceivedVault(from: configuration)

        XCTAssertEqual(model.items, [])
    }

    func testReceivedVaultLoaderFailsClosedWhenStoreIsUnreadable() throws {
        let storeURL = try temporaryEncryptedStoreURL()
        try Data("not-an-encrypted-vault-envelope".utf8).write(to: storeURL)
        let encryptionKey = SymmetricKey(size: .bits256)
        let configuration = PairingReceivedVaultStoreConfiguration(
            encryptedStoreURL: storeURL,
            encryptionKeyProvider: { encryptionKey }
        )

        let model = VaultListModel.loadReceivedVault(from: configuration)

        XCTAssertEqual(model.items, [])
    }

    private func persistReceivedVault(
        at storeURL: URL,
        encryptionKey: SymmetricKey
    ) throws {
        var importStore = try PairingHandoffImportStore(
            encryptedStoreURL: storeURL,
            encryptionKey: encryptionKey
        )
        _ = try importStore.importPayload(
            PairingHandoffOpenedPayload(
                items: [
                    PairingImportedCredential(
                        id: "github-login",
                        label: "github.com",
                        username: "yuchen",
                        password: "secret-github",
                        profileId: "personal",
                        websiteOrigin: "https://github.com"
                    ),
                    PairingImportedCredential(
                        id: "bank-login",
                        label: "Bank",
                        username: "me@example.com",
                        password: "secret-bank",
                        profileId: "personal",
                        websiteOrigin: "https://bank.example"
                    )
                ]
            ),
            from: makeHandoff()
        )
    }

    private func expectedVaultListItems() -> [VaultListItem] {
        [
            VaultListItem(
                id: "bank-login",
                label: "Bank",
                username: "me@example.com",
                websiteOrigin: "https://bank.example"
            ),
            VaultListItem(
                id: "github-login",
                label: "github.com",
                username: "yuchen",
                websiteOrigin: "https://github.com"
            )
        ]
    }

    private func temporaryEncryptedStoreURL() throws -> URL {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )
        return directoryURL.appendingPathComponent("received-vault.store")
    }

    private func makeHandoff() -> MacPairingHandoff {
        MacPairingHandoff(
            handoffId: "vault-list-model-session",
            version: 1,
            sourceDeviceId: "mac-device-1",
            targetDeviceId: "ios-device-1",
            targetDeviceDisplayName: "Yuchen iPhone",
            targetPublicKeyFingerprint: "sha256:fingerprint",
            createdAt: Date(timeIntervalSince1970: 1_000),
            expiresAt: Date(timeIntervalSince1970: 1_120),
            material: MacPairingHandoffMaterial(
                algorithm: "P256-HKDF-SHA256-AES-GCM-256",
                senderPublicKeyAgreementDERBase64URL: "sender-key",
                nonce: "nonce",
                ciphertext: "ciphertext",
                tag: "tag"
            )
        )
    }
}
