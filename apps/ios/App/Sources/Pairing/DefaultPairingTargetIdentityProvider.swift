import Foundation

#if canImport(UIKit)
import UIKit
#endif

@MainActor
struct DefaultPairingTargetIdentityProvider {
    static let storedDeviceIdKey = "unuvault.pairing.targetDeviceId"
    static let pendingPublicKeyFingerprint = "ios-public-key-fingerprint-pending"

    private let storage: UserDefaults
    private let displayName: @MainActor () -> String
    private let makeUUID: () -> UUID

    init(
        storage: UserDefaults = .standard,
        displayName: @escaping @MainActor () -> String =
            DefaultPairingTargetIdentityProvider.deviceDisplayName,
        makeUUID: @escaping () -> UUID = UUID.init
    ) {
        self.storage = storage
        self.displayName = displayName
        self.makeUUID = makeUUID
    }

    func makeIdentity() -> PairingTargetIdentity {
        PairingTargetIdentity(
            deviceId: deviceId(),
            displayName: normalizedDisplayName(),
            publicKeyFingerprint: Self.pendingPublicKeyFingerprint
        )
    }

    private func deviceId() -> String {
        if let storedDeviceId = storage.string(forKey: Self.storedDeviceIdKey),
           !storedDeviceId.isEmpty
        {
            return storedDeviceId
        }

        let generatedDeviceId = "ios-device-\(makeUUID().uuidString.lowercased())"
        storage.set(generatedDeviceId, forKey: Self.storedDeviceIdKey)
        return generatedDeviceId
    }

    private func normalizedDisplayName() -> String {
        let name = displayName().trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? "This iPhone" : name
    }

    private static func deviceDisplayName() -> String {
        #if canImport(UIKit)
        UIDevice.current.name
        #else
        "This iPhone"
        #endif
    }
}
