import Foundation
import XCTest
@testable import MacCompanionCore

final class RecoveryBoundaryTests: XCTestCase {
    func testEncryptedBackupRestoresOnlyWithUserHeldKeyMaterial() throws {
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
        let backupURL = directory.appendingPathComponent("vault-backup.json")
        let recoveryKey = Data(repeating: 17, count: 32)
        let credential = CompanionCredential(
            id: "github-login",
            label: "github.com",
            username: "yuchen",
            password: "secret-github",
            profileId: "personal",
            websiteOrigin: "https://github.com"
        )

        try LocalCompanionVaultStore(
            keyProvider: StaticCompanionVaultKeyProvider(keyData: recoveryKey),
            vaultURL: vaultURL
        )
        .save(credentials: [credential])
        try FileManager.default.copyItem(at: vaultURL, to: backupURL)

        let rawBackup = try String(contentsOf: backupURL, encoding: .utf8)
        XCTAssertTrue(rawBackup.contains(#""algorithm":"AES-GCM-256""#))
        XCTAssertFalse(rawBackup.contains("credentials"))
        XCTAssertFalse(rawBackup.contains("github-login"))
        XCTAssertFalse(rawBackup.contains("yuchen"))
        XCTAssertFalse(rawBackup.contains("secret-github"))

        let accountOnlyRestore = LocalCompanionVaultStore(
            keyProvider: StaticCompanionVaultKeyProvider(
                keyData: Data(repeating: 18, count: 32)
            ),
            vaultURL: backupURL
        )
        XCTAssertThrowsError(try accountOnlyRestore.loadCredentials()) { error in
            XCTAssertEqual(error as? CompanionVaultStoreError, .openFailed)
        }

        let trustedMaterialRestore = LocalCompanionVaultStore(
            keyProvider: StaticCompanionVaultKeyProvider(keyData: recoveryKey),
            vaultURL: backupURL
        )
        XCTAssertEqual(try trustedMaterialRestore.loadCredentials(), [credential])
    }

    func testLostAndRevokedDevicesClearReleaseAbility() {
        assertRevokedDeviceBoundary(
            expectedReason: .lostDevice,
            transition: { $0.markLostDevice() }
        )
        assertRevokedDeviceBoundary(
            expectedReason: .revoked,
            transition: { $0.markRevoked() }
        )
    }

    private func assertRevokedDeviceBoundary(
        expectedReason: CompanionAttentionReason,
        transition: (CompanionVaultSession) -> Void,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let session = CompanionVaultSession(
            now: { Date(timeIntervalSince1970: 1_000) }
        )
        let service = CompanionBridgeService(session: session)
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

        guard case .approvalRequired = service.requestRelease(
            id: "github-login",
            origin: "https://github.com",
            profileId: "personal",
            reason: "fill-active-page"
        ) else {
            XCTFail(
                "Expected a pending release before device transition.",
                file: file,
                line: line
            )
            return
        }
        XCTAssertEqual(
            service.pendingApproval?.id,
            "github-login",
            file: file,
            line: line
        )

        transition(session)

        XCTAssertEqual(
            session.lockState,
            .attentionNeeded(reason: expectedReason),
            file: file,
            line: line
        )
        XCTAssertEqual(
            service.approvePendingRelease(id: "github-login"),
            .locked,
            file: file,
            line: line
        )
        XCTAssertNil(service.pendingApproval, file: file, line: line)
        XCTAssertEqual(
            service.requestRelease(
                id: "github-login",
                origin: "https://github.com",
                profileId: "personal",
                reason: "fill-active-page"
            ),
            .locked,
            file: file,
            line: line
        )
        XCTAssertEqual(
            service.consumeApprovedRelease(
                id: "github-login",
                origin: "https://github.com",
                profileId: "personal"
            ),
            .locked,
            file: file,
            line: line
        )
    }
}
