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

    func testOpensMacProducedRecipientBoundHandoffAndImportsSafeReceipt() throws {
        let target = makeTargetIdentity()
        let credential = PairingImportedCredential(
            id: "github-login",
            label: "github.com",
            username: "yuchen",
            password: "secret-github",
            profileId: "personal",
            websiteOrigin: "https://github.com"
        )
        let handoff = try makeMacProducedHandoff(target: target, credentials: [credential])
        let opener = PairingHandoffOpener()

        let openedPayload = try opener.open(
            handoff,
            recipientPrivateKey: samplePrivateKey,
            expectedTarget: target,
            now: Date(timeIntervalSince1970: 1_060)
        )

        XCTAssertEqual(openedPayload.items, [credential])

        var importStore = PairingHandoffImportStore()
        let receipt = try importStore.importPayload(openedPayload, from: handoff)

        XCTAssertEqual(receipt.handoffId, handoff.handoffId)
        XCTAssertEqual(receipt.importedCredentialCount, 1)
        XCTAssertEqual(receipt.importedCredentialIds, ["github-login"])
        XCTAssertEqual(importStore.importedCredential(id: "github-login"), credential)
        XCTAssertEqual(
            receipt.receiptLine,
            "UNUVAULT_IOS_PAIRING_RECEIPT imported " +
            "handoffId=\(handoff.handoffId) " +
            "sourceDeviceId=\(handoff.sourceDeviceId) " +
            "targetDeviceId=\(handoff.targetDeviceId) " +
            "importedCredentialCount=1 " +
            "material=P256-HKDF-SHA256-AES-GCM-256"
        )

        let encodedHandoff = try String(
            data: JSONEncoder().encode(handoff),
            encoding: .utf8
        )
        XCTAssertFalse(encodedHandoff?.contains("github-login") ?? true)
        XCTAssertFalse(encodedHandoff?.contains("yuchen") ?? true)
        XCTAssertFalse(encodedHandoff?.contains("secret-github") ?? true)
        XCTAssertFalse(encodedHandoff?.contains("password") ?? true)

        for safeSurface in [
            receipt.statusText,
            receipt.diagnostic,
            receipt.receiptLine
        ] {
            XCTAssertFalse(safeSurface.contains("github-login"))
            XCTAssertFalse(safeSurface.contains("yuchen"))
            XCTAssertFalse(safeSurface.contains("secret-github"))
            XCTAssertFalse(safeSurface.contains("password"))
        }
    }

    func testHandoffOpenerFailsClosedForInvalidMaterialAndReplay() throws {
        let target = makeTargetIdentity()
        let handoff = try makeMacProducedHandoff(
            target: target,
            credentials: [
                PairingImportedCredential(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    password: "secret-github",
                    profileId: "personal",
                    websiteOrigin: "https://github.com"
                )
            ]
        )

        XCTAssertThrowsError(
            try PairingHandoffOpener().open(
                handoff,
                recipientPrivateKey: P256.KeyAgreement.PrivateKey(),
                expectedTarget: target,
                now: Date(timeIntervalSince1970: 1_060)
            )
        ) { error in
            XCTAssertEqual(error as? PairingHandoffOpenError, .openFailed)
        }

        XCTAssertThrowsError(
            try PairingHandoffOpener().open(
                handoff.replacingMaterial(
                    ciphertext: Data("tampered".utf8).base64EncodedString()
                ),
                recipientPrivateKey: samplePrivateKey,
                expectedTarget: target,
                now: Date(timeIntervalSince1970: 1_060)
            )
        ) { error in
            XCTAssertEqual(error as? PairingHandoffOpenError, .openFailed)
        }

        XCTAssertThrowsError(
            try PairingHandoffOpener().open(
                handoff.replacingMaterial(
                    tag: Data("tampered".utf8).base64EncodedString()
                ),
                recipientPrivateKey: samplePrivateKey,
                expectedTarget: target,
                now: Date(timeIntervalSince1970: 1_060)
            )
        ) { error in
            XCTAssertEqual(error as? PairingHandoffOpenError, .openFailed)
        }

        XCTAssertThrowsError(
            try PairingHandoffOpener().open(
                handoff.replacingMaterial(algorithm: "AES-GCM-256"),
                recipientPrivateKey: samplePrivateKey,
                expectedTarget: target,
                now: Date(timeIntervalSince1970: 1_060)
            )
        ) { error in
            XCTAssertEqual(error as? PairingHandoffOpenError, .unsupportedAlgorithm)
        }

        XCTAssertThrowsError(
            try PairingHandoffOpener().open(
                handoff,
                recipientPrivateKey: samplePrivateKey,
                expectedTarget: target,
                now: Date(timeIntervalSince1970: 1_121)
            )
        ) { error in
            XCTAssertEqual(error as? PairingHandoffOpenError, .expired)
        }

        XCTAssertThrowsError(
            try PairingHandoffOpener().open(
                handoff,
                recipientPrivateKey: samplePrivateKey,
                expectedTarget: makeTargetIdentity(
                    publicKeyFingerprint: "sha256:unexpected"
                ),
                now: Date(timeIntervalSince1970: 1_060)
            )
        ) { error in
            XCTAssertEqual(error as? PairingHandoffOpenError, .targetMismatch)
        }

        let opener = PairingHandoffOpener()
        _ = try opener.open(
            handoff,
            recipientPrivateKey: samplePrivateKey,
            expectedTarget: target,
            now: Date(timeIntervalSince1970: 1_060)
        )
        XCTAssertThrowsError(
            try opener.open(
                handoff,
                recipientPrivateKey: samplePrivateKey,
                expectedTarget: target,
                now: Date(timeIntervalSince1970: 1_060)
            )
        ) { error in
            XCTAssertEqual(error as? PairingHandoffOpenError, .replayed)
        }
    }

    func testImportStoreRejectsEmptyCredentialPayload() throws {
        let target = makeTargetIdentity()
        let handoff = try makeMacProducedHandoff(target: target, credentials: [])
        let payload = PairingHandoffOpenedPayload(items: [])
        var importStore = PairingHandoffImportStore()

        XCTAssertThrowsError(
            try importStore.importPayload(payload, from: handoff)
        ) { error in
            XCTAssertEqual(error as? PairingHandoffImportError, .emptyPayload)
        }
    }

    func testImportStorePersistsCredentialsEncryptedAndReloadsThem() throws {
        let target = makeTargetIdentity()
        let credential = PairingImportedCredential(
            id: "github-login",
            label: "github.com",
            username: "yuchen",
            password: "secret-github",
            profileId: "personal",
            websiteOrigin: "https://github.com"
        )
        let handoff = try makeMacProducedHandoff(target: target, credentials: [credential])
        let storeURL = try temporaryEncryptedStoreURL()
        let encryptionKey = SymmetricKey(size: .bits256)
        var importStore = try PairingHandoffImportStore(
            encryptedStoreURL: storeURL,
            encryptionKey: encryptionKey
        )

        let receipt = try importStore.importPayload(
            PairingHandoffOpenedPayload(items: [credential]),
            from: handoff
        )

        XCTAssertEqual(receipt.importedCredentialIds, ["github-login"])
        let rawStore = try Data(contentsOf: storeURL)
        let rawStoreText = String(data: rawStore, encoding: .utf8) ?? ""
        XCTAssertFalse(rawStoreText.contains("github-login"))
        XCTAssertFalse(rawStoreText.contains("yuchen"))
        XCTAssertFalse(rawStoreText.contains("secret-github"))
        XCTAssertFalse(rawStoreText.contains("password"))

        let reloadedStore = try PairingHandoffImportStore(
            encryptedStoreURL: storeURL,
            encryptionKey: encryptionKey
        )
        XCTAssertEqual(reloadedStore.importedCredential(id: "github-login"), credential)
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

private func makeMacProducedHandoff(
    target: PairingTargetIdentity,
    credentials: [PairingImportedCredential],
    handoffId: String = "pairing-session-1",
    sourceDeviceId: String = "mac-device-1",
    now: Date = Date(timeIntervalSince1970: 1_000),
    ttl: TimeInterval = 120
) throws -> MacPairingHandoff {
    let senderPrivateKey = P256.KeyAgreement.PrivateKey()
    let recipientPublicKeyData = try XCTUnwrap(
        Data(base64URLEncoded: target.publicKeyAgreementDERBase64URL)
    )
    let recipientPublicKey = try P256.KeyAgreement.PublicKey(
        derRepresentation: recipientPublicKeyData
    )
    let associatedData = pairingHandoffAssociatedData(
        handoffId: handoffId,
        sourceDeviceId: sourceDeviceId,
        targetDeviceId: target.deviceId,
        targetPublicKeyFingerprint: target.publicKeyFingerprint
    )
    let sharedSecret = try senderPrivateKey.sharedSecretFromKeyAgreement(
        with: recipientPublicKey
    )
    let symmetricKey = sharedSecret.hkdfDerivedSymmetricKey(
        using: SHA256.self,
        salt: Data("unuvault-pairing-handoff-v1".utf8),
        sharedInfo: associatedData,
        outputByteCount: 32
    )
    let payloadData = try JSONEncoder().encode(
        PairingHandoffOpenedPayload(items: credentials)
    )
    let sealedBox = try AES.GCM.seal(
        payloadData,
        using: symmetricKey,
        authenticating: associatedData
    )
    let nonce = sealedBox.nonce.withUnsafeBytes { Data($0) }

    return MacPairingHandoff(
        handoffId: handoffId,
        version: 1,
        sourceDeviceId: sourceDeviceId,
        targetDeviceId: target.deviceId,
        targetDeviceDisplayName: target.displayName,
        targetPublicKeyFingerprint: target.publicKeyFingerprint,
        createdAt: now,
        expiresAt: now.addingTimeInterval(ttl),
        material: MacPairingHandoffMaterial(
            algorithm: "P256-HKDF-SHA256-AES-GCM-256",
            senderPublicKeyAgreementDERBase64URL: senderPrivateKey
                .publicKey
                .derRepresentation
                .base64URLEncodedString(),
            nonce: nonce.base64EncodedString(),
            ciphertext: sealedBox.ciphertext.base64EncodedString(),
            tag: sealedBox.tag.base64EncodedString()
        )
    )
}

private func pairingHandoffAssociatedData(
    handoffId: String,
    sourceDeviceId: String,
    targetDeviceId: String,
    targetPublicKeyFingerprint: String
) -> Data {
    Data(
        [
            "unuvault-pairing-v1",
            handoffId,
            sourceDeviceId,
            targetDeviceId,
            targetPublicKeyFingerprint
        ].joined(separator: "|").utf8
    )
}

private func temporaryEncryptedStoreURL() throws -> URL {
    let directoryURL = FileManager.default.temporaryDirectory
        .appendingPathComponent(UUID().uuidString, isDirectory: true)
    try FileManager.default.createDirectory(
        at: directoryURL,
        withIntermediateDirectories: true
    )
    return directoryURL.appendingPathComponent("received-vault.store")
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
    init?(base64URLEncoded value: String) {
        var base64URL = value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        let padding = base64URL.count % 4
        if padding > 0 {
            base64URL.append(String(repeating: "=", count: 4 - padding))
        }

        self.init(base64Encoded: base64URL)
    }

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

private extension MacPairingHandoff {
    func replacingMaterial(
        algorithm: String? = nil,
        senderPublicKeyAgreementDERBase64URL: String? = nil,
        nonce: String? = nil,
        ciphertext: String? = nil,
        tag: String? = nil
    ) -> MacPairingHandoff {
        MacPairingHandoff(
            handoffId: handoffId,
            version: version,
            sourceDeviceId: sourceDeviceId,
            targetDeviceId: targetDeviceId,
            targetDeviceDisplayName: targetDeviceDisplayName,
            targetPublicKeyFingerprint: targetPublicKeyFingerprint,
            createdAt: createdAt,
            expiresAt: expiresAt,
            material: MacPairingHandoffMaterial(
                algorithm: algorithm ?? material.algorithm,
                senderPublicKeyAgreementDERBase64URL: senderPublicKeyAgreementDERBase64URL ??
                    material.senderPublicKeyAgreementDERBase64URL,
                nonce: nonce ?? material.nonce,
                ciphertext: ciphertext ?? material.ciphertext,
                tag: tag ?? material.tag
            )
        )
    }
}
