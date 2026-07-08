import Foundation
import CryptoKit
import XCTest
@testable import App

final class PairingPayloadTests: XCTestCase {
    func testParsesMacPairingQRCodePayload() throws {
        let payload = MacPairingQRCodePayload(
            version: 1,
            sessionId: "pairing-session-1",
            sessionNonce: "pairing-nonce-1",
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            createdAt: Date(timeIntervalSince1970: 1_000),
            expiresAt: Date(timeIntervalSince1970: 1_120)
        )
        let data = try JSONEncoder().encode(payload)

        let parsed = try PairingPayloadParser.parse(
            data,
            now: Date(timeIntervalSince1970: 1_060)
        )

        XCTAssertEqual(parsed, payload)
    }

    func testRejectsExpiredPayload() throws {
        let payload = MacPairingQRCodePayload(
            version: 1,
            sessionId: "pairing-session-1",
            sessionNonce: "pairing-nonce-1",
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            createdAt: Date(timeIntervalSince1970: 1_000),
            expiresAt: Date(timeIntervalSince1970: 1_120)
        )
        let data = try JSONEncoder().encode(payload)

        XCTAssertThrowsError(
            try PairingPayloadParser.parse(
                data,
                now: Date(timeIntervalSince1970: 1_121)
            )
        ) { error in
            XCTAssertEqual(error as? PairingPayloadError, .expired)
        }
    }

    func testRejectsInvalidVersionOrMissingFields() throws {
        let invalidVersionPayload = MacPairingQRCodePayload(
            version: 2,
            sessionId: "pairing-session-1",
            sessionNonce: "pairing-nonce-1",
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            createdAt: Date(timeIntervalSince1970: 1_000),
            expiresAt: Date(timeIntervalSince1970: 1_120)
        )
        let invalidVersionData = try JSONEncoder().encode(invalidVersionPayload)
        let missingFieldData = Data(
            """
            {
              "version": 1,
              "sessionId": "pairing-session-1",
              "sourceDeviceId": "mac-device-1",
              "sourceDeviceDisplayName": "Yuchen Mac",
              "createdAt": 1000,
              "expiresAt": 1120
            }
            """.utf8
        )

        XCTAssertThrowsError(
            try PairingPayloadParser.parse(
                invalidVersionData,
                now: Date(timeIntervalSince1970: 1_060)
            )
        ) { error in
            XCTAssertEqual(error as? PairingPayloadError, .invalidVersion)
        }

        XCTAssertThrowsError(
            try PairingPayloadParser.parse(
                missingFieldData,
                now: Date(timeIntervalSince1970: 1_060)
            )
        ) { error in
            XCTAssertEqual(error as? PairingPayloadError, .invalidPayload)
        }
    }

    func testBuildsTargetIdentityClaimWithoutVaultSecrets() throws {
        let payload = MacPairingQRCodePayload(
            version: 1,
            sessionId: "pairing-session-1",
            sessionNonce: "pairing-nonce-1",
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            createdAt: Date(timeIntervalSince1970: 1_000),
            expiresAt: Date(timeIntervalSince1970: 1_120)
        )
        let identity = makeTargetIdentity()

        let claim = try PairingTargetClaimBuilder().makeClaim(
            payload: payload,
            targetIdentity: identity
        )
        let encodedClaimData = try JSONEncoder().encode(claim)
        let encodedClaim = String(data: encodedClaimData, encoding: .utf8)
        let encodedClaimJSON = try XCTUnwrap(
            JSONSerialization.jsonObject(with: encodedClaimData) as? [String: Any]
        )
        let encodedClaimTargetJSON = try XCTUnwrap(
            encodedClaimJSON["target"] as? [String: Any]
        )
        let publicKeyAgreementDERBase64URL = try XCTUnwrap(
            encodedClaimTargetJSON["publicKeyAgreementDERBase64URL"] as? String
        )

        XCTAssertEqual(claim.sessionId, payload.sessionId)
        XCTAssertEqual(claim.sessionNonce, payload.sessionNonce)
        XCTAssertEqual(claim.target.deviceId, identity.deviceId)
        XCTAssertEqual(claim.target.displayName, identity.displayName)
        XCTAssertEqual(claim.target.publicKeyFingerprint, identity.publicKeyFingerprint)
        XCTAssertFalse(publicKeyAgreementDERBase64URL.isEmpty)
        XCTAssertFalse(encodedClaim?.contains("credentials") ?? true)
        XCTAssertFalse(encodedClaim?.contains("github-login") ?? true)
        XCTAssertFalse(encodedClaim?.contains("secret-github") ?? true)
        XCTAssertFalse(encodedClaim?.contains("vaultMaterial") ?? true)
        XCTAssertFalse(encodedClaim?.contains("password") ?? true)
    }

    func testRejectsTargetClaimWithEmptyKeyAgreementPublicKey() throws {
        let invalidClaim = Data(
            """
            {
              "sessionId": "pairing-session-1",
              "sessionNonce": "pairing-nonce-1",
              "target": {
                "deviceId": "ios-device-1",
                "displayName": "Yuchen iPhone",
                "publicKeyFingerprint": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                "publicKeyAgreementDERBase64URL": ""
              }
            }
            """.utf8
        )

        XCTAssertThrowsError(
            try JSONDecoder().decode(PairingTargetClaim.self, from: invalidClaim)
        )
    }

    func testParsesMacPairingInviteWithEndpointWithoutVaultSecrets() throws {
        let payload = MacPairingQRCodePayload(
            version: 1,
            sessionId: "pairing-session-1",
            sessionNonce: "pairing-nonce-1",
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            createdAt: Date(timeIntervalSince1970: 1_000),
            expiresAt: Date(timeIntervalSince1970: 1_120)
        )
        let invite = MacPairingInvite(
            version: 1,
            macBaseURL: URL(string: "http://192.168.1.42:17666")!,
            pairing: payload
        )
        let data = try JSONEncoder().encode(invite)

        let parsed = try PairingInviteParser.parse(
            data,
            now: Date(timeIntervalSince1970: 1_060)
        )
        let encodedInvite = String(data: data, encoding: .utf8)

        XCTAssertEqual(parsed, invite)
        XCTAssertEqual(parsed.macBaseURL.absoluteString, "http://192.168.1.42:17666")
        XCTAssertFalse(encodedInvite?.contains("credentials") ?? true)
        XCTAssertFalse(encodedInvite?.contains("github-login") ?? true)
        XCTAssertFalse(encodedInvite?.contains("secret-github") ?? true)
        XCTAssertFalse(encodedInvite?.contains("password") ?? true)
        XCTAssertFalse(encodedInvite?.contains("vault") ?? true)
    }

    func testRejectsInvalidPairingInviteEndpoint() throws {
        let invalidInvite = Data(
            """
            {
              "version": 1,
              "macBaseURL": "file:///tmp/unuvault",
              "pairing": {
                "version": 1,
                "sessionId": "pairing-session-1",
                "sessionNonce": "pairing-nonce-1",
                "sourceDeviceId": "mac-device-1",
                "sourceDeviceDisplayName": "Yuchen Mac",
                "createdAt": 1000,
                "expiresAt": 1120
              }
            }
            """.utf8
        )

        XCTAssertThrowsError(
            try PairingInviteParser.parse(
                invalidInvite,
                now: Date(timeIntervalSince1970: 1_060)
            )
        ) { error in
            XCTAssertEqual(error as? PairingInviteError, .invalidBaseURL)
        }
    }

    func testParsesMacPairingHandoffResponseWithoutVaultSecrets() throws {
        let response = MacPairingHandoffResponse(
            handoff: MacPairingHandoff(
                handoffId: "pairing-session-1",
                version: 1,
                sourceDeviceId: "mac-device-1",
                targetDeviceId: "ios-device-1",
                targetDeviceDisplayName: "Yuchen iPhone",
                targetPublicKeyFingerprint: samplePublicKeyFingerprint,
                createdAt: Date(timeIntervalSince1970: 1_000),
                expiresAt: Date(timeIntervalSince1970: 1_120),
                material: MacPairingHandoffMaterial(
                    algorithm: "P256-HKDF-SHA256-AES-GCM-256",
                    senderPublicKeyAgreementDERBase64URL: samplePublicKeyAgreementDERBase64URL,
                    nonce: "nonce-base64",
                    ciphertext: "wrapped-ciphertext-base64",
                    tag: "tag-base64"
                )
            )
        )
        let data = try JSONEncoder().encode(response)

        let parsed = try PairingHandoffResponseParser.parse(
            data,
            expectedTarget: PairingTargetIdentity(
                deviceId: "ios-device-1",
                displayName: "Yuchen iPhone",
                publicKeyFingerprint: samplePublicKeyFingerprint,
                publicKeyAgreementDERBase64URL: samplePublicKeyAgreementDERBase64URL
            ),
            now: Date(timeIntervalSince1970: 1_060)
        )
        let encodedResponse = String(data: data, encoding: .utf8)

        XCTAssertEqual(parsed, response.handoff)
        XCTAssertEqual(parsed.material.algorithm, "P256-HKDF-SHA256-AES-GCM-256")
        XCTAssertFalse(encodedResponse?.contains("credentials") ?? true)
        XCTAssertFalse(encodedResponse?.contains("github-login") ?? true)
        XCTAssertFalse(encodedResponse?.contains("secret-github") ?? true)
        XCTAssertFalse(encodedResponse?.contains("password") ?? true)
    }

    func testRejectsInvalidExpiredOrMismatchedHandoffResponses() throws {
        let target = makeTargetIdentity()
        let validResponse = MacPairingHandoffResponse(
            handoff: MacPairingHandoff(
                handoffId: "pairing-session-1",
                version: 1,
                sourceDeviceId: "mac-device-1",
                targetDeviceId: target.deviceId,
                targetDeviceDisplayName: target.displayName,
                targetPublicKeyFingerprint: target.publicKeyFingerprint,
                createdAt: Date(timeIntervalSince1970: 1_000),
                expiresAt: Date(timeIntervalSince1970: 1_120),
                material: MacPairingHandoffMaterial(
                    algorithm: "P256-HKDF-SHA256-AES-GCM-256",
                    senderPublicKeyAgreementDERBase64URL: samplePublicKeyAgreementDERBase64URL,
                    nonce: "nonce-base64",
                    ciphertext: "wrapped-ciphertext-base64",
                    tag: "tag-base64"
                )
            )
        )
        let invalidVersionResponse = MacPairingHandoffResponse(
            handoff: MacPairingHandoff(
                handoffId: validResponse.handoff.handoffId,
                version: 2,
                sourceDeviceId: validResponse.handoff.sourceDeviceId,
                targetDeviceId: validResponse.handoff.targetDeviceId,
                targetDeviceDisplayName: validResponse.handoff.targetDeviceDisplayName,
                targetPublicKeyFingerprint: validResponse.handoff.targetPublicKeyFingerprint,
                createdAt: validResponse.handoff.createdAt,
                expiresAt: validResponse.handoff.expiresAt,
                material: validResponse.handoff.material
            )
        )

        XCTAssertThrowsError(
            try PairingHandoffResponseParser.parse(
                try JSONEncoder().encode(invalidVersionResponse),
                expectedTarget: target,
                now: Date(timeIntervalSince1970: 1_060)
            )
        ) { error in
            XCTAssertEqual(error as? PairingHandoffResponseError, .invalidVersion)
        }

        XCTAssertThrowsError(
            try PairingHandoffResponseParser.parse(
                try JSONEncoder().encode(validResponse),
                expectedTarget: target,
                now: Date(timeIntervalSince1970: 1_121)
            )
        ) { error in
            XCTAssertEqual(error as? PairingHandoffResponseError, .expired)
        }

        XCTAssertThrowsError(
            try PairingHandoffResponseParser.parse(
                try JSONEncoder().encode(validResponse),
                expectedTarget: PairingTargetIdentity(
                    deviceId: target.deviceId,
                    displayName: target.displayName,
                    publicKeyFingerprint: "unexpected-public-key-fingerprint",
                    publicKeyAgreementDERBase64URL: samplePublicKeyAgreementDERBase64URL
                ),
                now: Date(timeIntervalSince1970: 1_060)
            )
        ) { error in
            XCTAssertEqual(error as? PairingHandoffResponseError, .targetMismatch)
        }
    }

    func testPairingExchangeClientPostsTargetClaimWithoutBearerOrSecrets() async throws {
        let payload = MacPairingQRCodePayload(
            version: 1,
            sessionId: "pairing-session-1",
            sessionNonce: "pairing-nonce-1",
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            createdAt: Date(timeIntervalSince1970: 1_000),
            expiresAt: Date(timeIntervalSince1970: 1_120)
        )
        let target = makeTargetIdentity()
        let response = MacPairingHandoffResponse(
            handoff: MacPairingHandoff(
                handoffId: payload.sessionId,
                version: 1,
                sourceDeviceId: payload.sourceDeviceId,
                targetDeviceId: target.deviceId,
                targetDeviceDisplayName: target.displayName,
                targetPublicKeyFingerprint: target.publicKeyFingerprint,
                createdAt: Date(timeIntervalSince1970: 1_000),
                expiresAt: Date(timeIntervalSince1970: 1_120),
                material: MacPairingHandoffMaterial(
                    algorithm: "P256-HKDF-SHA256-AES-GCM-256",
                    senderPublicKeyAgreementDERBase64URL: samplePublicKeyAgreementDERBase64URL,
                    nonce: "nonce-base64",
                    ciphertext: "wrapped-ciphertext-base64",
                    tag: "tag-base64"
                )
            )
        )
        let responseData = try JSONEncoder().encode(response)
        let capturedRequestStore = PairingRequestStore()
        let client = PairingExchangeClient(
            macBaseURL: URL(string: "http://127.0.0.1:17666")!,
            now: { Date(timeIntervalSince1970: 1_060) },
            transport: { request in
                await capturedRequestStore.record(request)
                return (
                    responseData,
                    HTTPURLResponse(
                        url: request.url!,
                        statusCode: 200,
                        httpVersion: "HTTP/1.1",
                        headerFields: ["content-type": "application/json"]
                    )!
                )
            }
        )

        let handoff = try await client.exchange(
            payload: payload,
            targetIdentity: target
        )

        XCTAssertEqual(handoff, response.handoff)
        let capturedRequest = await capturedRequestStore.request()
        XCTAssertEqual(capturedRequest?.httpMethod, "POST")
        XCTAssertEqual(capturedRequest?.url?.path, "/v1/pairing/claim")
        XCTAssertNil(capturedRequest?.value(forHTTPHeaderField: "authorization"))
        XCTAssertEqual(
            capturedRequest?.value(forHTTPHeaderField: "content-type"),
            "application/json"
        )

        let requestBody = String(
            data: try XCTUnwrap(capturedRequest?.httpBody),
            encoding: .utf8
        )
        XCTAssertTrue(requestBody?.contains(payload.sessionId) ?? false)
        XCTAssertTrue(requestBody?.contains(target.deviceId) ?? false)
        let requestBodyData = try XCTUnwrap(capturedRequest?.httpBody)
        let requestBodyJSON = try XCTUnwrap(
            JSONSerialization.jsonObject(with: requestBodyData) as? [String: Any]
        )
        let requestTargetJSON = try XCTUnwrap(requestBodyJSON["target"] as? [String: Any])
        let requestPublicKeyAgreementDERBase64URL = try XCTUnwrap(
            requestTargetJSON["publicKeyAgreementDERBase64URL"] as? String
        )
        XCTAssertFalse(requestPublicKeyAgreementDERBase64URL.isEmpty)
        XCTAssertFalse(requestBody?.contains("credentials") ?? true)
        XCTAssertFalse(requestBody?.contains("github-login") ?? true)
        XCTAssertFalse(requestBody?.contains("secret-github") ?? true)
        XCTAssertFalse(requestBody?.contains("password") ?? true)
        XCTAssertFalse(requestBody?.contains("vault") ?? true)
    }

    func testPairingExchangeClientCanUseParsedInviteEndpoint() async throws {
        let payload = MacPairingQRCodePayload(
            version: 1,
            sessionId: "pairing-session-1",
            sessionNonce: "pairing-nonce-1",
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            createdAt: Date(timeIntervalSince1970: 1_000),
            expiresAt: Date(timeIntervalSince1970: 1_120)
        )
        let invite = MacPairingInvite(
            version: 1,
            macBaseURL: URL(string: "http://192.168.1.42:17666")!,
            pairing: payload
        )
        let target = makeTargetIdentity()
        let response = MacPairingHandoffResponse(
            handoff: MacPairingHandoff(
                handoffId: payload.sessionId,
                version: 1,
                sourceDeviceId: payload.sourceDeviceId,
                targetDeviceId: target.deviceId,
                targetDeviceDisplayName: target.displayName,
                targetPublicKeyFingerprint: target.publicKeyFingerprint,
                createdAt: Date(timeIntervalSince1970: 1_000),
                expiresAt: Date(timeIntervalSince1970: 1_120),
                material: MacPairingHandoffMaterial(
                    algorithm: "P256-HKDF-SHA256-AES-GCM-256",
                    senderPublicKeyAgreementDERBase64URL: samplePublicKeyAgreementDERBase64URL,
                    nonce: "nonce-base64",
                    ciphertext: "wrapped-ciphertext-base64",
                    tag: "tag-base64"
                )
            )
        )
        let responseData = try JSONEncoder().encode(response)
        let capturedRequestStore = PairingRequestStore()
        let client = PairingExchangeClient(
            invite: invite,
            now: { Date(timeIntervalSince1970: 1_060) },
            transport: { request in
                await capturedRequestStore.record(request)
                return (
                    responseData,
                    HTTPURLResponse(
                        url: request.url!,
                        statusCode: 200,
                        httpVersion: "HTTP/1.1",
                        headerFields: ["content-type": "application/json"]
                    )!
                )
            }
        )

        let handoff = try await client.exchange(
            payload: invite.pairing,
            targetIdentity: target
        )

        XCTAssertEqual(handoff, response.handoff)
        let capturedRequest = await capturedRequestStore.request()
        XCTAssertEqual(
            capturedRequest?.url?.absoluteString,
            "http://192.168.1.42:17666/v1/pairing/claim"
        )
        XCTAssertNil(capturedRequest?.value(forHTTPHeaderField: "authorization"))
    }

    func testPairingExchangeClientRejectsNonSuccessStatus() async throws {
        let payload = MacPairingQRCodePayload(
            version: 1,
            sessionId: "pairing-session-1",
            sessionNonce: "pairing-nonce-1",
            sourceDeviceId: "mac-device-1",
            sourceDeviceDisplayName: "Yuchen Mac",
            createdAt: Date(timeIntervalSince1970: 1_000),
            expiresAt: Date(timeIntervalSince1970: 1_120)
        )
        let target = makeTargetIdentity()
        let client = PairingExchangeClient(
            macBaseURL: URL(string: "http://127.0.0.1:17666")!,
            now: { Date(timeIntervalSince1970: 1_060) },
            transport: { request in
                (
                    Data(#"{"ok":false,"error":"vault_locked"}"#.utf8),
                    HTTPURLResponse(
                        url: request.url!,
                        statusCode: 423,
                        httpVersion: "HTTP/1.1",
                        headerFields: ["content-type": "application/json"]
                    )!
                )
            }
        )

        do {
            _ = try await client.exchange(payload: payload, targetIdentity: target)
            XCTFail("Expected non-success pairing exchange status to fail closed")
        } catch {
            XCTAssertEqual(error as? PairingExchangeClientError, .httpStatus(423))
        }
    }
}

private let samplePrivateKey = P256.KeyAgreement.PrivateKey()
private let samplePublicKeyAgreementDER = samplePrivateKey.publicKey.derRepresentation
private let samplePublicKeyAgreementDERBase64URL = samplePublicKeyAgreementDER
    .base64URLEncodedString()
private let samplePublicKeyFingerprint = "sha256:\(SHA256.hash(data: samplePublicKeyAgreementDER).hexString)"

private func makeTargetIdentity(
    deviceId: String = "ios-device-1",
    displayName: String = "Yuchen iPhone",
    publicKeyFingerprint: String = samplePublicKeyFingerprint,
    publicKeyAgreementDERBase64URL: String = samplePublicKeyAgreementDERBase64URL
) -> PairingTargetIdentity {
    PairingTargetIdentity(
        deviceId: deviceId,
        displayName: displayName,
        publicKeyFingerprint: publicKeyFingerprint,
        publicKeyAgreementDERBase64URL: publicKeyAgreementDERBase64URL
    )
}

private actor PairingRequestStore {
    private var storedRequest: URLRequest?

    func record(_ request: URLRequest) {
        storedRequest = request
    }

    func request() -> URLRequest? {
        storedRequest
    }
}

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

private extension SHA256.Digest {
    var hexString: String {
        map { String(format: "%02x", $0) }.joined()
    }
}
