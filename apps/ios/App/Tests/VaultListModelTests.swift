import CryptoKit
import Foundation
import XCTest
@testable import App

final class VaultListModelTests: XCTestCase {
    func testVaultListModelCarriesMetadataWithoutPasswords() throws {
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

        XCTAssertEqual(model.items.count, 2)
        let encodedItems = String(
            data: try JSONEncoder().encode(model.items),
            encoding: .utf8
        ) ?? ""
        XCTAssertFalse(encodedItems.contains("secret"))
        XCTAssertFalse(encodedItems.contains("password"))
    }

    func testVaultListReadOnlyContextCopyContract() {
        XCTAssertEqual(VaultListView.Copy.title, "Vault")
        XCTAssertEqual(
            VaultListView.Copy.readOnlyContext,
            "Read-only metadata received from your Mac. Passwords and secret values are never shown here."
        )
        XCTAssertEqual(VaultListView.Copy.importedItems, "Imported items")
    }

    func testVaultListEmptyStateCopyContract() {
        XCTAssertEqual(
            VaultListView.Copy.emptyTitle,
            "No vault received yet"
        )
        XCTAssertEqual(
            VaultListView.Copy.emptyBody,
            "Open Pairing to import read-only metadata from a trusted Mac."
        )
    }

    @MainActor
    func testVaultListViewRetainsInjectedModel() {
        let model = VaultListModel(
            items: [
                VaultListItem(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    websiteOrigin: "https://github.com"
                )
            ]
        )

        XCTAssertEqual(VaultListView(model: model).model, model)
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

        let model = try VaultListModel.loadReceivedVault(from: configuration)

        XCTAssertEqual(model.items, expectedVaultListItems())
        let encodedItems = String(
            data: try JSONEncoder().encode(model.items),
            encoding: .utf8
        ) ?? ""
        XCTAssertFalse(encodedItems.contains("secret-bank"))
        XCTAssertFalse(encodedItems.contains("secret-github"))
        XCTAssertFalse(encodedItems.contains("password"))
    }

    func testReceivedVaultLoaderReturnsEmptyModelWhenStoreIsMissing() throws {
        let storeURL = try temporaryEncryptedStoreURL()
        let encryptionKey = SymmetricKey(size: .bits256)
        let configuration = PairingReceivedVaultStoreConfiguration(
            encryptedStoreURL: storeURL,
            encryptionKeyProvider: { encryptionKey }
        )

        let model = try VaultListModel.loadReceivedVault(from: configuration)

        XCTAssertEqual(model.items, [])
    }

    func testReceivedVaultLoaderThrowsForCorruptStoreWithoutLeakingBytes() throws {
        let storeURL = try temporaryEncryptedStoreURL()
        let corruptBytes = Data("test-secret-password-corrupt-store".utf8)
        try corruptBytes.write(to: storeURL)
        let encryptionKey = SymmetricKey(size: .bits256)
        let configuration = PairingReceivedVaultStoreConfiguration(
            encryptedStoreURL: storeURL,
            encryptionKeyProvider: { encryptionKey }
        )

        var capturedError: Error?
        XCTAssertThrowsError(
            try VaultListModel.loadReceivedVault(from: configuration)
        ) { error in
            capturedError = error
            XCTAssertEqual(
                error as? PairingHandoffImportError,
                .invalidEncryptedStore
            )
        }

        let encodedErrorState = String(
            data: try JSONEncoder().encode(
                ["error": String(describing: capturedError)]
            ),
            encoding: .utf8
        ) ?? ""
        XCTAssertFalse(encodedErrorState.contains("password"))
        XCTAssertFalse(encodedErrorState.contains("test-secret"))
        XCTAssertFalse(
            encodedErrorState.contains(
                String(decoding: corruptBytes, as: UTF8.self)
            )
        )
        XCTAssertFalse(
            encodedErrorState.contains(corruptBytes.base64EncodedString())
        )
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
