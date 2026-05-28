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

    func testPairingSessionQRCodePayloadContainsNoVaultSecrets() throws {
        let now = Date(timeIntervalSince1970: 1_000)
        let coordinator = CompanionPairingSessionCoordinator(
            session: makeUnlockedSession(now: now),
            now: { now },
            makeSessionId: { "pairing-session-1" },
            makeSessionNonce: { "pairing-nonce-1" }
        )

        let payload = try coordinator.startSession(
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            ttl: 120
        )
        let encodedPayload = try String(
            data: JSONEncoder().encode(payload),
            encoding: .utf8
        )

        XCTAssertEqual(payload.version, 1)
        XCTAssertEqual(payload.sessionId, "pairing-session-1")
        XCTAssertEqual(payload.sessionNonce, "pairing-nonce-1")
        XCTAssertEqual(payload.sourceDeviceId, "mac-device-1")
        XCTAssertEqual(payload.sourceDeviceDisplayName, "Yuchen Mac")
        XCTAssertEqual(payload.expiresAt, Date(timeIntervalSince1970: 1_120))
        XCTAssertFalse(encodedPayload?.contains("credentials") ?? true)
        XCTAssertFalse(encodedPayload?.contains("github-login") ?? true)
        XCTAssertFalse(encodedPayload?.contains("yuchen") ?? true)
        XCTAssertFalse(encodedPayload?.contains("secret-github") ?? true)
    }

    func testPairingInviteCarriesMacBaseURLWithoutVaultSecrets() throws {
        let now = Date(timeIntervalSince1970: 1_000)
        let coordinator = CompanionPairingSessionCoordinator(
            session: makeUnlockedSession(now: now),
            now: { now },
            makeSessionId: { "pairing-session-1" },
            makeSessionNonce: { "pairing-nonce-1" }
        )
        let payload = try coordinator.startSession(
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            ttl: 120
        )

        let invite = try CompanionPairingInviteBuilder().makeInvite(
            pairing: payload,
            macBaseURL: URL(string: "http://192.168.1.42:17666")!
        )
        let encodedInvite = try String(
            data: JSONEncoder().encode(invite),
            encoding: .utf8
        )

        XCTAssertEqual(invite.version, 1)
        XCTAssertEqual(invite.macBaseURL.absoluteString, "http://192.168.1.42:17666")
        XCTAssertEqual(invite.pairing, payload)
        XCTAssertTrue(encodedInvite?.contains("192.168.1.42") ?? false)
        XCTAssertFalse(encodedInvite?.contains("credentials") ?? true)
        XCTAssertFalse(encodedInvite?.contains("github-login") ?? true)
        XCTAssertFalse(encodedInvite?.contains("yuchen") ?? true)
        XCTAssertFalse(encodedInvite?.contains("secret-github") ?? true)
    }

    func testPairingSessionRequiresUnlockedVault() {
        let coordinator = CompanionPairingSessionCoordinator(
            session: CompanionVaultSession(),
            now: { Date(timeIntervalSince1970: 1_000) },
            makeSessionId: { "pairing-session-1" },
            makeSessionNonce: { "pairing-nonce-1" }
        )

        XCTAssertThrowsError(
            try coordinator.startSession(
                sourceDeviceId: "mac-device-1",
                sourceDeviceDisplayName: "Yuchen Mac",
                ttl: 120
            )
        ) { error in
            XCTAssertEqual(error as? CompanionPairingSessionError, .locked)
        }
    }

    func testPairingSessionCompletesOneTimeHandoffForClaimedTarget() throws {
        let now = Date(timeIntervalSince1970: 1_000)
        let coordinator = CompanionPairingSessionCoordinator(
            session: makeUnlockedSession(now: now),
            now: { now },
            makeSessionId: { "pairing-session-1" },
            makeSessionNonce: { "pairing-nonce-1" }
        )
        let payload = try coordinator.startSession(
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            ttl: 120
        )
        let target = makeTarget()

        let handoff = try coordinator.completeSession(
            sessionId: payload.sessionId,
            sessionNonce: payload.sessionNonce,
            target: target,
            transferKeyData: Data(repeating: 23, count: 32)
        )

        XCTAssertEqual(handoff.handoffId, payload.sessionId)
        XCTAssertEqual(handoff.sourceDeviceId, payload.sourceDeviceId)
        XCTAssertEqual(handoff.targetDeviceId, target.deviceId)
        XCTAssertEqual(handoff.targetPublicKeyFingerprint, target.publicKeyFingerprint)

        let restored = try CompanionPairingHandoffVerifier().openHandoff(
            handoff,
            transferKeyData: Data(repeating: 23, count: 32),
            expectedTarget: target,
            now: now
        )
        XCTAssertEqual(restored, [makeCredential()])

        XCTAssertThrowsError(
            try coordinator.completeSession(
                sessionId: payload.sessionId,
                sessionNonce: payload.sessionNonce,
                target: target,
                transferKeyData: Data(repeating: 23, count: 32)
            )
        ) { error in
            XCTAssertEqual(error as? CompanionPairingSessionError, .replayed)
        }
    }

    func testPairingSessionRejectsExpiredOrMismatchedClaims() throws {
        var currentTime = Date(timeIntervalSince1970: 1_000)
        let coordinator = CompanionPairingSessionCoordinator(
            session: makeUnlockedSession(now: currentTime),
            now: { currentTime },
            makeSessionId: { "pairing-session-1" },
            makeSessionNonce: { "pairing-nonce-1" }
        )
        let payload = try coordinator.startSession(
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            ttl: 120
        )

        XCTAssertThrowsError(
            try coordinator.completeSession(
                sessionId: payload.sessionId,
                sessionNonce: "wrong-nonce",
                target: makeTarget(),
                transferKeyData: Data(repeating: 23, count: 32)
            )
        ) { error in
            XCTAssertEqual(error as? CompanionPairingSessionError, .invalidRequest)
        }

        currentTime = Date(timeIntervalSince1970: 1_121)

        XCTAssertThrowsError(
            try coordinator.completeSession(
                sessionId: payload.sessionId,
                sessionNonce: payload.sessionNonce,
                target: makeTarget(),
                transferKeyData: Data(repeating: 23, count: 32)
            )
        ) { error in
            XCTAssertEqual(error as? CompanionPairingSessionError, .expired)
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

    private func makeUnlockedSession(now: Date) -> CompanionVaultSession {
        let session = CompanionVaultSession(now: { now })
        session.unlock(credentials: [makeCredential()], ttl: 300)
        return session
    }
}
