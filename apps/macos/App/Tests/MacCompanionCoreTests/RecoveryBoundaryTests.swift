import Foundation
import XCTest
@testable import MacCompanionCore

final class RecoveryBoundaryTests: XCTestCase {
    func testEncryptedBackupExportsAndRestoresThroughStoreAPI() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        defer {
            try? FileManager.default.removeItem(at: directory)
        }

        let sourceVaultURL = directory.appendingPathComponent("source-vault.json")
        let restoredVaultURL = directory.appendingPathComponent("restored-vault.json")
        let backupURL = directory.appendingPathComponent("unuvault-backup.json")
        let recoveryKey = Data(repeating: 21, count: 32)
        let credential = CompanionCredential(
            id: "github-login",
            label: "github.com",
            username: "yuchen",
            password: "secret-github",
            profileId: "personal",
            websiteOrigin: "https://github.com"
        )
        let sourceStore = LocalCompanionVaultStore(
            keyProvider: StaticCompanionVaultKeyProvider(keyData: recoveryKey),
            vaultURL: sourceVaultURL
        )

        try sourceStore.save(credentials: [credential])
        try sourceStore.exportBackup(to: backupURL)

        let rawBackup = try String(contentsOf: backupURL, encoding: .utf8)
        XCTAssertTrue(rawBackup.contains(#""algorithm":"AES-GCM-256""#))
        XCTAssertFalse(rawBackup.contains("credentials"))
        XCTAssertFalse(rawBackup.contains("github-login"))
        XCTAssertFalse(rawBackup.contains("yuchen"))
        XCTAssertFalse(rawBackup.contains("secret-github"))

        let wrongKeyRestore = LocalCompanionVaultStore(
            keyProvider: StaticCompanionVaultKeyProvider(
                keyData: Data(repeating: 22, count: 32)
            ),
            vaultURL: restoredVaultURL
        )
        XCTAssertThrowsError(try wrongKeyRestore.restoreBackup(from: backupURL)) { error in
            XCTAssertEqual(error as? CompanionVaultStoreError, .openFailed)
        }

        let trustedRestore = LocalCompanionVaultStore(
            keyProvider: StaticCompanionVaultKeyProvider(keyData: recoveryKey),
            vaultURL: restoredVaultURL
        )
        XCTAssertEqual(try trustedRestore.restoreBackup(from: backupURL), [credential])
        XCTAssertEqual(try trustedRestore.loadCredentials(), [credential])
    }

    func testMalformedBackupDoesNotReplaceExistingVault() throws {
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
        let backupURL = directory.appendingPathComponent("bad-backup.json")
        let credential = CompanionCredential(
            id: "github-login",
            label: "github.com",
            username: "yuchen",
            password: "secret-github",
            profileId: "personal",
            websiteOrigin: "https://github.com"
        )
        let store = LocalCompanionVaultStore(
            keyProvider: StaticCompanionVaultKeyProvider(
                keyData: Data(repeating: 23, count: 32)
            ),
            vaultURL: vaultURL
        )

        try store.save(credentials: [credential])
        try Data(#"{"version":1,"algorithm":"AES-GCM-256"}"#.utf8)
            .write(to: backupURL)

        XCTAssertThrowsError(try store.restoreBackup(from: backupURL)) { error in
            XCTAssertEqual(error as? CompanionVaultStoreError, .openFailed)
        }
        XCTAssertEqual(try store.loadCredentials(), [credential])
    }

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
