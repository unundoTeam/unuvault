import Foundation
import CryptoKit
import XCTest
@testable import App

@MainActor
final class PairingTargetIdentityProviderTests: XCTestCase {
    func testDefaultProviderPersistsStableDeviceIdAndKeyBackedFingerprint() throws {
        let storageSuite = "PairingTargetIdentityProviderTests.\(UUID().uuidString)"
        let storage = try XCTUnwrap(UserDefaults(suiteName: storageSuite))
        storage.removePersistentDomain(forName: storageSuite)
        defer {
            storage.removePersistentDomain(forName: storageSuite)
        }
        let uuid = UUID(uuidString: "11111111-2222-3333-4444-555555555555")!
        var uuidCallCount = 0
        let privateKeyStore = InMemoryPairingTargetIdentityPrivateKeyStore()
        let provider = DefaultPairingTargetIdentityProvider(
            storage: storage,
            displayName: { "Yuchen iPhone" },
            privateKeyStore: privateKeyStore,
            makeUUID: {
                uuidCallCount += 1
                return uuid
            }
        )
        let secondProvider = DefaultPairingTargetIdentityProvider(
            storage: storage,
            displayName: { "Yuchen iPhone" },
            privateKeyStore: privateKeyStore,
            makeUUID: {
                uuidCallCount += 1
                return uuid
            }
        )

        let firstIdentity = try provider.makeIdentity()
        let secondIdentity = try secondProvider.makeIdentity()

        XCTAssertEqual(firstIdentity.deviceId, "ios-device-11111111-2222-3333-4444-555555555555")
        XCTAssertEqual(secondIdentity.deviceId, firstIdentity.deviceId)
        XCTAssertEqual(uuidCallCount, 1)
        XCTAssertEqual(firstIdentity.displayName, "Yuchen iPhone")
        XCTAssertEqual(secondIdentity.publicKeyFingerprint, firstIdentity.publicKeyFingerprint)
        XCTAssertTrue(firstIdentity.publicKeyFingerprint.hasPrefix("sha256:"))
        XCTAssertEqual(firstIdentity.publicKeyFingerprint.count, "sha256:".count + 64)
        XCTAssertNotEqual(firstIdentity.publicKeyFingerprint, "ios-public-key-fingerprint-pending")
        XCTAssertNotEqual(firstIdentity.deviceId, "ios-device-local")

        let encodedIdentity = try JSONEncoder().encode(firstIdentity)
        let identityJSON = try XCTUnwrap(
            JSONSerialization.jsonObject(with: encodedIdentity) as? [String: Any]
        )
        let publicKeyAgreementDERBase64URL = try XCTUnwrap(
            identityJSON["publicKeyAgreementDERBase64URL"] as? String
        )
        let publicKeyAgreementDER = try XCTUnwrap(
            Data(base64URLEncoded: publicKeyAgreementDERBase64URL)
        )
        let keyAgreementDigest = SHA256.hash(data: publicKeyAgreementDER)
            .map { String(format: "%02x", $0) }
            .joined()
        XCTAssertFalse(publicKeyAgreementDERBase64URL.isEmpty)
        XCTAssertEqual(firstIdentity.publicKeyFingerprint, "sha256:\(keyAgreementDigest)")
    }
}

private final class InMemoryPairingTargetIdentityPrivateKeyStore: PairingTargetIdentityPrivateKeyStore {
    private var privateKeyData: Data?

    func loadPrivateKeyData() throws -> Data? {
        privateKeyData
    }

    func savePrivateKeyData(_ data: Data) throws {
        privateKeyData = data
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
}
