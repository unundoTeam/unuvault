import Foundation
import XCTest
@testable import MacCompanionCore

final class LocalCompanionVaultStoreTests: XCTestCase {
    func testEncryptedVaultRoundTripsCredentialsWithoutPlaintext() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        defer {
            try? FileManager.default.removeItem(at: directory)
        }

        let vaultURL = directory.appendingPathComponent("vault.json")
        let store = LocalCompanionVaultStore(
            keyProvider: StaticCompanionVaultKeyProvider(
                keyData: Data(repeating: 7, count: 32)
            ),
            vaultURL: vaultURL
        )
        let credential = CompanionCredential(
            id: "github-login",
            label: "github.com",
            username: "yuchen",
            password: "secret-github",
            profileId: "personal",
            websiteOrigin: "https://github.com"
        )

        try store.save(credentials: [credential])

        let rawVault = try String(contentsOf: vaultURL, encoding: .utf8)
        XCTAssertFalse(rawVault.contains("secret-github"))
        XCTAssertFalse(rawVault.contains("yuchen"))
        XCTAssertEqual(try store.loadCredentials(), [credential])
    }

    func testWrongLocalKeyCannotOpenStoredVault() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        defer {
            try? FileManager.default.removeItem(at: directory)
        }

        let vaultURL = directory.appendingPathComponent("vault.json")
        let credential = CompanionCredential(
            id: "github-login",
            label: "github.com",
            username: "yuchen",
            password: "secret-github",
            profileId: "personal",
            websiteOrigin: "https://github.com"
        )
        try LocalCompanionVaultStore(
            keyProvider: StaticCompanionVaultKeyProvider(
                keyData: Data(repeating: 7, count: 32)
            ),
            vaultURL: vaultURL
        )
        .save(credentials: [credential])

        let wrongKeyStore = LocalCompanionVaultStore(
            keyProvider: StaticCompanionVaultKeyProvider(
                keyData: Data(repeating: 9, count: 32)
            ),
            vaultURL: vaultURL
        )

        XCTAssertThrowsError(try wrongKeyStore.loadCredentials()) { error in
            XCTAssertEqual(error as? CompanionVaultStoreError, .openFailed)
        }
    }
}
