import Foundation
import XCTest
@testable import App

@MainActor
final class PairingTargetIdentityProviderTests: XCTestCase {
    func testDefaultProviderPersistsStableDeviceIdAndKeepsFingerprintPending() throws {
        let storageSuite = "PairingTargetIdentityProviderTests.\(UUID().uuidString)"
        let storage = try XCTUnwrap(UserDefaults(suiteName: storageSuite))
        storage.removePersistentDomain(forName: storageSuite)
        defer {
            storage.removePersistentDomain(forName: storageSuite)
        }
        let uuid = UUID(uuidString: "11111111-2222-3333-4444-555555555555")!
        var uuidCallCount = 0
        let provider = DefaultPairingTargetIdentityProvider(
            storage: storage,
            displayName: { "Yuchen iPhone" },
            makeUUID: {
                uuidCallCount += 1
                return uuid
            }
        )

        let firstIdentity = provider.makeIdentity()
        let secondIdentity = provider.makeIdentity()

        XCTAssertEqual(firstIdentity.deviceId, "ios-device-11111111-2222-3333-4444-555555555555")
        XCTAssertEqual(secondIdentity.deviceId, firstIdentity.deviceId)
        XCTAssertEqual(uuidCallCount, 1)
        XCTAssertEqual(firstIdentity.displayName, "Yuchen iPhone")
        XCTAssertEqual(
            firstIdentity.publicKeyFingerprint,
            DefaultPairingTargetIdentityProvider.pendingPublicKeyFingerprint
        )
        XCTAssertNotEqual(firstIdentity.deviceId, "ios-device-local")
    }
}
