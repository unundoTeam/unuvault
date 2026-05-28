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
}
