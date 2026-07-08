import CryptoKit
import Foundation
import XCTest
@testable import App

final class VaultListModelTests: XCTestCase {
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
