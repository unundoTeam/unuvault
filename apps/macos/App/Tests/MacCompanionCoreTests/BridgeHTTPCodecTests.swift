import XCTest
@testable import MacCompanionCore

final class BridgeHTTPCodecTests: XCTestCase {
    func testStatusResponseDoesNotExposeSecrets() {
        let session = CompanionVaultSession()
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
            ttl: 300
        )
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: session),
            accessToken: "bridge-token"
        )

        let response = codec.handle(
            method: "GET",
            path: "/status",
            headers: [:],
            body: Data()
        )

        XCTAssertEqual(response.statusCode, 200)
        XCTAssertTrue(response.bodyString.contains("\"state\":\"unlocked\""))
        XCTAssertFalse(response.bodyString.contains("secret-github"))
    }

    func testReleaseRequiresBearerToken() {
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: CompanionVaultSession()),
            accessToken: "bridge-token"
        )

        let response = codec.handle(
            method: "POST",
            path: "/v1/credentials/release",
            headers: [:],
            body: Data()
        )

        XCTAssertEqual(response.statusCode, 401)
        XCTAssertTrue(response.bodyString.contains("invalid_bridge_token"))
    }

    func testCredentialMetadataResponseUsesActiveOriginOnly() {
        let session = CompanionVaultSession()
        session.unlock(
            credentials: [
                CompanionCredential(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    password: "secret-github",
                    profileId: "personal",
                    websiteOrigin: "https://github.com"
                ),
                CompanionCredential(
                    id: "apple-login",
                    label: "apple.com",
                    username: "me@example.com",
                    password: "secret-apple",
                    profileId: "personal",
                    websiteOrigin: "https://apple.com"
                )
            ],
            ttl: 300
        )
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: session),
            accessToken: "bridge-token"
        )

        let response = codec.handle(
            method: "GET",
            path: "/v1/credentials?origin=https%3A%2F%2Fgithub.com%2Flogin&profileId=personal",
            headers: ["authorization": "Bearer bridge-token"],
            body: Data()
        )

        XCTAssertEqual(response.statusCode, 200)
        XCTAssertTrue(response.bodyString.contains("github-login"))
        XCTAssertFalse(response.bodyString.contains("apple-login"))
        XCTAssertFalse(response.bodyString.contains("secret-github"))
    }

    func testHttpApproveCannotReleaseSecret() {
        let session = CompanionVaultSession()
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
            ttl: 300
        )
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: session),
            accessToken: "bridge-token"
        )

        let releaseResponse = codec.handle(
            method: "POST",
            path: "/v1/credentials/release",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"github-login","origin":"https://github.com/login","profileId":"personal","reason":"fill-active-page"}
            """.utf8)
        )

        XCTAssertEqual(releaseResponse.statusCode, 409)
        XCTAssertTrue(releaseResponse.bodyString.contains("approval_required"))
        XCTAssertFalse(releaseResponse.bodyString.contains("secret-github"))

        let approveResponse = codec.handle(
            method: "POST",
            path: "/v1/credentials/approve",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"github-login"}
            """.utf8)
        )

        XCTAssertEqual(approveResponse.statusCode, 404)
        XCTAssertFalse(approveResponse.bodyString.contains("secret-github"))
    }

    func testApprovedLocalReleaseCanBeClaimedOnceOverHttp() {
        let session = CompanionVaultSession()
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
            ttl: 300
        )
        let service = CompanionBridgeService(session: session)
        let codec = BridgeHTTPCodec(
            service: service,
            accessToken: "bridge-token"
        )

        let releaseResponse = codec.handle(
            method: "POST",
            path: "/v1/credentials/release",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"github-login","origin":"https://github.com/login","profileId":"personal","reason":"fill-active-page"}
            """.utf8)
        )

        XCTAssertEqual(releaseResponse.statusCode, 409)
        XCTAssertTrue(releaseResponse.bodyString.contains("approval_required"))
        XCTAssertFalse(releaseResponse.bodyString.contains("secret-github"))

        XCTAssertEqual(
            service.approvePendingRelease(id: "github-login"),
            .released(
                CompanionReleasedCredential(
                    username: "yuchen",
                    password: "secret-github"
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
            {"id":"github-login","origin":"https://github.com/login","profileId":"personal"}
            """.utf8)
        )

        XCTAssertEqual(claimResponse.statusCode, 200)
        XCTAssertTrue(claimResponse.bodyString.contains("secret-github"))

        let secondClaimResponse = codec.handle(
            method: "POST",
            path: "/v1/credentials/claim",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"github-login","origin":"https://github.com/login","profileId":"personal"}
            """.utf8)
        )

        XCTAssertEqual(secondClaimResponse.statusCode, 404)
        XCTAssertFalse(secondClaimResponse.bodyString.contains("secret-github"))
    }

    func testHttpDenyCannotClearApprovalOrExposeSecret() {
        let session = CompanionVaultSession()
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
            ttl: 300
        )
        let service = CompanionBridgeService(session: session)
        let codec = BridgeHTTPCodec(
            service: service,
            accessToken: "bridge-token"
        )

        _ = codec.handle(
            method: "POST",
            path: "/v1/credentials/release",
            headers: [
                "Authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"github-login","origin":"https://github.com","profileId":"personal","reason":"fill-active-page"}
            """.utf8)
        )

        let denyResponse = codec.handle(
            method: "POST",
            path: "/v1/credentials/deny",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"github-login"}
            """.utf8)
        )

        XCTAssertEqual(denyResponse.statusCode, 404)
        XCTAssertFalse(denyResponse.bodyString.contains("secret-github"))
        XCTAssertEqual(service.pendingApproval?.id, "github-login")
    }

    func testPairingClaimExchangeReturnsWrappedHandoffWithoutBridgeBearer() throws {
        let now = Date(timeIntervalSince1970: 1_000)
        let session = CompanionVaultSession(now: { now })
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
            ttl: 300
        )
        let pairingCoordinator = CompanionPairingSessionCoordinator(
            session: session,
            now: { now },
            makeSessionId: { "pairing-session-1" },
            makeSessionNonce: { "pairing-nonce-1" }
        )
        let payload = try pairingCoordinator.startSession(
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            ttl: 120
        )
        let transferKey = Data(repeating: 23, count: 32)
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: session),
            accessToken: "bridge-token",
            pairingCoordinator: pairingCoordinator,
            pairingTransferKeyData: transferKey
        )

        let response = codec.handle(
            method: "POST",
            path: "/v1/pairing/claim",
            headers: ["content-type": "application/json"],
            body: Data("""
            {
              "sessionId": "\(payload.sessionId)",
              "sessionNonce": "\(payload.sessionNonce)",
              "target": {
                "deviceId": "ios-device-1",
                "displayName": "Yuchen iPhone",
                "publicKeyFingerprint": "ios-public-key-fingerprint"
              }
            }
            """.utf8)
        )

        XCTAssertEqual(response.statusCode, 200)
        XCTAssertFalse(response.bodyString.contains("github-login"))
        XCTAssertFalse(response.bodyString.contains("yuchen"))
        XCTAssertFalse(response.bodyString.contains("secret-github"))

        let envelope = try JSONDecoder()
            .decode(PairingClaimExchangeEnvelope.self, from: response.body)
        XCTAssertEqual(envelope.handoff.handoffId, "pairing-session-1")
        XCTAssertEqual(envelope.handoff.targetDeviceId, "ios-device-1")
        XCTAssertEqual(envelope.handoff.targetPublicKeyFingerprint, "ios-public-key-fingerprint")

        let restored = try CompanionPairingHandoffVerifier().openHandoff(
            envelope.handoff,
            transferKeyData: transferKey,
            expectedTarget: CompanionPairingTarget(
                deviceId: "ios-device-1",
                displayName: "Yuchen iPhone",
                publicKeyFingerprint: "ios-public-key-fingerprint"
            ),
            now: now
        )
        XCTAssertEqual(restored.first?.password, "secret-github")
    }

    func testPairingClaimExchangeRejectsMismatchAndReplayWithoutSecrets() throws {
        let now = Date(timeIntervalSince1970: 1_000)
        let session = CompanionVaultSession(now: { now })
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
            ttl: 300
        )
        let pairingCoordinator = CompanionPairingSessionCoordinator(
            session: session,
            now: { now },
            makeSessionId: { "pairing-session-1" },
            makeSessionNonce: { "pairing-nonce-1" }
        )
        let payload = try pairingCoordinator.startSession(
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            ttl: 120
        )
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: session),
            accessToken: "bridge-token",
            pairingCoordinator: pairingCoordinator,
            pairingTransferKeyData: Data(repeating: 23, count: 32)
        )

        let mismatchResponse = codec.handle(
            method: "POST",
            path: "/v1/pairing/claim",
            headers: ["content-type": "application/json"],
            body: Data("""
            {
              "sessionId": "\(payload.sessionId)",
              "sessionNonce": "wrong-nonce",
              "target": {
                "deviceId": "ios-device-1",
                "displayName": "Yuchen iPhone",
                "publicKeyFingerprint": "ios-public-key-fingerprint"
              }
            }
            """.utf8)
        )

        XCTAssertEqual(mismatchResponse.statusCode, 400)
        XCTAssertTrue(mismatchResponse.bodyString.contains("invalid_pairing_claim"))
        XCTAssertFalse(mismatchResponse.bodyString.contains("secret-github"))

        let firstClaimResponse = codec.handle(
            method: "POST",
            path: "/v1/pairing/claim",
            headers: ["content-type": "application/json"],
            body: Data("""
            {
              "sessionId": "\(payload.sessionId)",
              "sessionNonce": "\(payload.sessionNonce)",
              "target": {
                "deviceId": "ios-device-1",
                "displayName": "Yuchen iPhone",
                "publicKeyFingerprint": "ios-public-key-fingerprint"
              }
            }
            """.utf8)
        )
        XCTAssertEqual(firstClaimResponse.statusCode, 200)

        let replayResponse = codec.handle(
            method: "POST",
            path: "/v1/pairing/claim",
            headers: ["content-type": "application/json"],
            body: Data("""
            {
              "sessionId": "\(payload.sessionId)",
              "sessionNonce": "\(payload.sessionNonce)",
              "target": {
                "deviceId": "ios-device-1",
                "displayName": "Yuchen iPhone",
                "publicKeyFingerprint": "ios-public-key-fingerprint"
              }
            }
            """.utf8)
        )

        XCTAssertEqual(replayResponse.statusCode, 409)
        XCTAssertTrue(replayResponse.bodyString.contains("pairing_session_replayed"))
        XCTAssertFalse(replayResponse.bodyString.contains("secret-github"))
    }
}

private struct PairingClaimExchangeEnvelope: Decodable {
    let handoff: CompanionPairingHandoff
}
