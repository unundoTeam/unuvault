import Foundation
import XCTest
@testable import MacCompanionCore

final class PairingHandoffTests: XCTestCase {
    func testPairingHandoffContainsOnlyWrappedVaultMaterial() throws {
        let transferKey = Data(repeating: 23, count: 32)
        let credential = CompanionCredential(
            id: "github-login",
            label: "github.com",
            username: "yuchen",
            password: "secret-github",
            profileId: "personal",
            websiteOrigin: "https://github.com"
        )
        let target = CompanionPairingTarget(
            deviceId: "ios-device-1",
            displayName: "Yuchen iPhone",
            publicKeyFingerprint: "ios-public-key-fingerprint"
        )

        let handoff = try CompanionPairingHandoffBuilder().makeHandoff(
            credentials: [credential],
            sourceDeviceId: "mac-device-1",
            target: target,
            transferKeyData: transferKey
        )
        let encodedHandoff = try String(
            data: JSONEncoder().encode(handoff),
            encoding: .utf8
        )

        XCTAssertNotNil(encodedHandoff)
        XCTAssertEqual(handoff.targetDeviceId, target.deviceId)
        XCTAssertEqual(handoff.targetDeviceDisplayName, target.displayName)
        XCTAssertEqual(handoff.material.algorithm, "AES-GCM-256")
        XCTAssertFalse(encodedHandoff?.contains("credentials") ?? true)
        XCTAssertFalse(encodedHandoff?.contains("github-login") ?? true)
        XCTAssertFalse(encodedHandoff?.contains("yuchen") ?? true)
        XCTAssertFalse(encodedHandoff?.contains("secret-github") ?? true)

        let restored = try CompanionPairingHandoffBuilder().openHandoff(
            handoff,
            transferKeyData: transferKey
        )
        XCTAssertEqual(restored, [credential])
    }

    func testPairingHandoffFailsClosedWithWrongTransferMaterial() throws {
        let handoff = try CompanionPairingHandoffBuilder().makeHandoff(
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
            sourceDeviceId: "mac-device-1",
            target: CompanionPairingTarget(
                deviceId: "ios-device-1",
                displayName: "Yuchen iPhone",
                publicKeyFingerprint: "ios-public-key-fingerprint"
            ),
            transferKeyData: Data(repeating: 23, count: 32)
        )

        XCTAssertThrowsError(
            try CompanionPairingHandoffBuilder().openHandoff(
                handoff,
                transferKeyData: Data(repeating: 24, count: 32)
            )
        ) { error in
            XCTAssertEqual(error as? CompanionPairingHandoffError, .openFailed)
        }
    }

    func testPairingHandoffRejectsExpiredMaterial() throws {
        let now = Date(timeIntervalSince1970: 1_000)
        let target = makeTarget()
        let handoff = try CompanionPairingHandoffBuilder().makeHandoff(
            credentials: [makeCredential()],
            sourceDeviceId: "mac-device-1",
            target: target,
            transferKeyData: Data(repeating: 23, count: 32),
            now: now,
            ttl: 60,
            handoffId: "handoff-expired"
        )

        XCTAssertThrowsError(
            try CompanionPairingHandoffVerifier().openHandoff(
                handoff,
                transferKeyData: Data(repeating: 23, count: 32),
                expectedTarget: target,
                now: Date(timeIntervalSince1970: 1_061)
            )
        ) { error in
            XCTAssertEqual(error as? CompanionPairingHandoffError, .expired)
        }
    }

    func testPairingHandoffRejectsTargetFingerprintMismatch() throws {
        let now = Date(timeIntervalSince1970: 1_000)
        let target = makeTarget()
        let handoff = try CompanionPairingHandoffBuilder().makeHandoff(
            credentials: [makeCredential()],
            sourceDeviceId: "mac-device-1",
            target: target,
            transferKeyData: Data(repeating: 23, count: 32),
            now: now,
            ttl: 60,
            handoffId: "handoff-target-mismatch"
        )
        let unexpectedTarget = CompanionPairingTarget(
            deviceId: target.deviceId,
            displayName: target.displayName,
            publicKeyFingerprint: "unexpected-public-key-fingerprint"
        )

        XCTAssertThrowsError(
            try CompanionPairingHandoffVerifier().openHandoff(
                handoff,
                transferKeyData: Data(repeating: 23, count: 32),
                expectedTarget: unexpectedTarget,
                now: now
            )
        ) { error in
            XCTAssertEqual(error as? CompanionPairingHandoffError, .targetMismatch)
        }
    }

    func testPairingHandoffRejectsReplay() throws {
        let now = Date(timeIntervalSince1970: 1_000)
        let target = makeTarget()
        let handoff = try CompanionPairingHandoffBuilder().makeHandoff(
            credentials: [makeCredential()],
            sourceDeviceId: "mac-device-1",
            target: target,
            transferKeyData: Data(repeating: 23, count: 32),
            now: now,
            ttl: 60,
            handoffId: "handoff-replay"
        )
        let verifier = CompanionPairingHandoffVerifier()

        _ = try verifier.openHandoff(
            handoff,
            transferKeyData: Data(repeating: 23, count: 32),
            expectedTarget: target,
            now: now
        )

        XCTAssertThrowsError(
            try verifier.openHandoff(
                handoff,
                transferKeyData: Data(repeating: 23, count: 32),
                expectedTarget: target,
                now: now
            )
        ) { error in
            XCTAssertEqual(error as? CompanionPairingHandoffError, .replayed)
        }
    }

    private func makeCredential() -> CompanionCredential {
        CompanionCredential(
            id: "github-login",
            label: "github.com",
            username: "yuchen",
            password: "secret-github",
            profileId: "personal",
            websiteOrigin: "https://github.com"
        )
    }

    private func makeTarget() -> CompanionPairingTarget {
        CompanionPairingTarget(
            deviceId: "ios-device-1",
            displayName: "Yuchen iPhone",
            publicKeyFingerprint: "ios-public-key-fingerprint"
        )
    }
}
