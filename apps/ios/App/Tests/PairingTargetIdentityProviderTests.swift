import Foundation
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
