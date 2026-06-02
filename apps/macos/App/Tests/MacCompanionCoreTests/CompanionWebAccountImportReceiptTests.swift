import Foundation
import XCTest
@testable import MacCompanionCore

final class CompanionWebAccountImportReceiptTests: XCTestCase {
    func testWebAccountImportRequiresBearerToken() {
        let session = CompanionVaultSession()
        session.unlock(credentials: [], ttl: 300)
        let service = CompanionBridgeService(session: session)
        let store = RecordingVaultStore()
        let importer = CompanionLocalVaultImporter(
            session: session,
            vaultStore: store
        )
        let codec = BridgeHTTPCodec(
            service: service,
            accessToken: "bridge-token",
            localVaultImporter: importer
        )

        let response = codec.handle(
            method: "POST",
            path: "/v1/local-vault/import",
            headers: ["content-type": "application/json"],
            body: Self.webAccountImportBody()
        )

        XCTAssertEqual(response.statusCode, 401)
        XCTAssertTrue(response.bodyString.contains("invalid_bridge_token"))
        XCTAssertFalse(store.didSaveCredentials)
        XCTAssertFalse(response.bodyString.contains("web-secret"))
    }

    func testWebAccountImportRequiresUnlockedLocalVault() {
        let session = CompanionVaultSession()
        let service = CompanionBridgeService(session: session)
        let store = RecordingVaultStore()
        let importer = CompanionLocalVaultImporter(
            session: session,
            vaultStore: store
        )
        let codec = BridgeHTTPCodec(
            service: service,
            accessToken: "bridge-token",
            localVaultImporter: importer
        )

        let response = codec.handle(
            method: "POST",
            path: "/v1/local-vault/import",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Self.webAccountImportBody()
        )

        XCTAssertEqual(response.statusCode, 423)
        XCTAssertTrue(response.bodyString.contains("vault_locked"))
        XCTAssertFalse(store.didSaveCredentials)
        XCTAssertFalse(response.bodyString.contains("web-secret"))
    }

    func testWebAccountImportPersistsEncryptedLocalVaultAndCanReleaseAfterApproval() throws {
        let vaultDirectory = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let vaultURL = vaultDirectory.appendingPathComponent("vault.json")
        let store = LocalCompanionVaultStore(
            keyProvider: StaticCompanionVaultKeyProvider(
                keyData: Data(repeating: 31, count: 32)
            ),
            vaultURL: vaultURL
        )
        defer {
            try? FileManager.default.removeItem(at: vaultDirectory)
        }

        let session = CompanionVaultSession()
        session.unlock(credentials: [], ttl: 300)
        let service = CompanionBridgeService(session: session)
        let importer = CompanionLocalVaultImporter(
            session: session,
            vaultStore: store
        )
        let codec = BridgeHTTPCodec(
            service: service,
            accessToken: "bridge-token",
            localVaultImporter: importer
        )

        let importResponse = codec.handle(
            method: "POST",
            path: "/v1/local-vault/import",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Self.webAccountImportBody()
        )

        XCTAssertEqual(importResponse.statusCode, 200)
        XCTAssertTrue(importResponse.bodyString.contains("\"credentialCount\":1"))
        XCTAssertTrue(importResponse.bodyString.contains("web-github"))
        XCTAssertFalse(importResponse.bodyString.contains("web-secret"))
        XCTAssertFalse(importResponse.bodyString.contains("web-user"))

        let storedVaultData = try Data(contentsOf: vaultURL)
        let storedVaultText = String(data: storedVaultData, encoding: .utf8) ?? ""
        XCTAssertFalse(storedVaultText.contains("web-secret"))
        XCTAssertFalse(storedVaultText.contains("web-user"))
        XCTAssertEqual(
            try store.loadCredentials(),
            [
                CompanionCredential(
                    id: "web-github",
                    label: "github.com",
                    username: "web-user",
                    password: "web-secret",
                    profileId: "personal",
                    websiteOrigin: "https://github.com"
                )
            ]
        )

        let metadataResponse = codec.handle(
            method: "GET",
            path: "/v1/credentials?origin=https%3A%2F%2Fgithub.com%2Flogin&profileId=personal",
            headers: ["authorization": "Bearer bridge-token"],
            body: Data()
        )
        XCTAssertEqual(metadataResponse.statusCode, 200)
        XCTAssertTrue(metadataResponse.bodyString.contains("web-github"))
        XCTAssertFalse(metadataResponse.bodyString.contains("web-secret"))

        let releaseResponse = codec.handle(
            method: "POST",
            path: "/v1/credentials/release",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"web-github","origin":"https://github.com/login","profileId":"personal","reason":"fill-active-page"}
            """.utf8)
        )
        XCTAssertEqual(releaseResponse.statusCode, 409)
        XCTAssertTrue(releaseResponse.bodyString.contains("approval_required"))
        XCTAssertFalse(releaseResponse.bodyString.contains("web-secret"))

        XCTAssertEqual(
            service.approvePendingRelease(id: "web-github"),
            .released(
                CompanionReleasedCredential(
                    username: "web-user",
                    password: "web-secret"
                )
            )
        )

        let claimResponse = codec.handle(
            method: "POST",
            path: "/v1/credentials/claim",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"web-github","origin":"https://github.com/login","profileId":"personal"}
            """.utf8)
        )

        XCTAssertEqual(claimResponse.statusCode, 200)
        XCTAssertTrue(claimResponse.bodyString.contains("web-secret"))
    }

    private static func webAccountImportBody() -> Data {
        Data("""
        {
          "source": "web-account-unlocked-vault",
          "credentials": [
            {
              "id": "web-github",
              "title": "github.com",
              "username": "web-user",
              "website_url": "https://github.com/login",
              "profile_id": "personal",
              "password": "web-secret"
            }
          ]
        }
        """.utf8)
    }
}

private final class RecordingVaultStore: CompanionVaultStoring {
    private(set) var didSaveCredentials = false

    func save(credentials: [CompanionCredential]) throws {
        didSaveCredentials = true
    }

    func loadCredentials() throws -> [CompanionCredential] {
        []
    }
}
