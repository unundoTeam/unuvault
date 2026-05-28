import Foundation
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
        let identity = PairingTargetIdentity(
            deviceId: "ios-device-1",
            displayName: "Yuchen iPhone",
            publicKeyFingerprint: "ios-public-key-fingerprint"
        )

        let claim = try PairingTargetClaimBuilder().makeClaim(
            payload: payload,
            targetIdentity: identity
        )
        let encodedClaim = try String(
            data: JSONEncoder().encode(claim),
            encoding: .utf8
        )

        XCTAssertEqual(claim.sessionId, payload.sessionId)
        XCTAssertEqual(claim.sessionNonce, payload.sessionNonce)
        XCTAssertEqual(claim.target.deviceId, identity.deviceId)
        XCTAssertEqual(claim.target.displayName, identity.displayName)
        XCTAssertEqual(claim.target.publicKeyFingerprint, identity.publicKeyFingerprint)
        XCTAssertFalse(encodedClaim?.contains("credentials") ?? true)
        XCTAssertFalse(encodedClaim?.contains("github-login") ?? true)
        XCTAssertFalse(encodedClaim?.contains("secret-github") ?? true)
        XCTAssertFalse(encodedClaim?.contains("vaultMaterial") ?? true)
        XCTAssertFalse(encodedClaim?.contains("password") ?? true)
    }

    func testParsesMacPairingHandoffResponseWithoutVaultSecrets() throws {
        let response = MacPairingHandoffResponse(
            handoff: MacPairingHandoff(
                handoffId: "pairing-session-1",
                version: 1,
                sourceDeviceId: "mac-device-1",
                targetDeviceId: "ios-device-1",
                targetDeviceDisplayName: "Yuchen iPhone",
                targetPublicKeyFingerprint: "ios-public-key-fingerprint",
                createdAt: Date(timeIntervalSince1970: 1_000),
                expiresAt: Date(timeIntervalSince1970: 1_120),
                material: MacPairingHandoffMaterial(
                    algorithm: "AES-GCM-256",
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
                publicKeyFingerprint: "ios-public-key-fingerprint"
            ),
            now: Date(timeIntervalSince1970: 1_060)
        )
        let encodedResponse = String(data: data, encoding: .utf8)

        XCTAssertEqual(parsed, response.handoff)
        XCTAssertEqual(parsed.material.algorithm, "AES-GCM-256")
        XCTAssertFalse(encodedResponse?.contains("credentials") ?? true)
        XCTAssertFalse(encodedResponse?.contains("github-login") ?? true)
        XCTAssertFalse(encodedResponse?.contains("secret-github") ?? true)
        XCTAssertFalse(encodedResponse?.contains("password") ?? true)
    }

    func testRejectsInvalidExpiredOrMismatchedHandoffResponses() throws {
        let target = PairingTargetIdentity(
            deviceId: "ios-device-1",
            displayName: "Yuchen iPhone",
            publicKeyFingerprint: "ios-public-key-fingerprint"
        )
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
                    algorithm: "AES-GCM-256",
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
                    publicKeyFingerprint: "unexpected-public-key-fingerprint"
                ),
                now: Date(timeIntervalSince1970: 1_060)
            )
        ) { error in
            XCTAssertEqual(error as? PairingHandoffResponseError, .targetMismatch)
        }
    }
}
