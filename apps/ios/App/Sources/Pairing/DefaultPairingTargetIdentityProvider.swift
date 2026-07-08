import CryptoKit
import Foundation
import Security

#if canImport(UIKit)
import UIKit
#endif

enum PairingTargetIdentityProviderError: Error, Equatable {
    case invalidStoredPrivateKey
    case keychainReadFailed(OSStatus)
    case keychainWriteFailed(OSStatus)
}

protocol PairingTargetIdentityPrivateKeyStore {
    func loadPrivateKeyData() throws -> Data?
    func savePrivateKeyData(_ data: Data) throws
}

struct KeychainPairingTargetIdentityPrivateKeyStore: PairingTargetIdentityPrivateKeyStore {
    private let service: String
    private let account: String

    init(
        service: String = "com.unundo.unuvault.ios.pairing",
        account: String = "target-identity-p256-key-agreement-private-key-v1"
    ) {
        self.service = service
        self.account = account
    }

    func loadPrivateKeyData() throws -> Data? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess else {
            throw PairingTargetIdentityProviderError.keychainReadFailed(status)
        }

        guard let data = result as? Data else {
            throw PairingTargetIdentityProviderError.invalidStoredPrivateKey
        }

        return data
    }

    func savePrivateKeyData(_ data: Data) throws {
        var addQuery = baseQuery()
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        addQuery[kSecValueData as String] = data

        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)

        if addStatus == errSecSuccess {
            return
        }

        if addStatus == errSecDuplicateItem {
            let updateStatus = SecItemUpdate(
                baseQuery() as CFDictionary,
                [kSecValueData as String: data] as CFDictionary
            )

            guard updateStatus == errSecSuccess else {
                throw PairingTargetIdentityProviderError.keychainWriteFailed(updateStatus)
            }

            return
        }

        throw PairingTargetIdentityProviderError.keychainWriteFailed(addStatus)
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}

@MainActor
struct DefaultPairingTargetIdentityProvider {
    static let storedDeviceIdKey = "unuvault.pairing.targetDeviceId"

    private let storage: UserDefaults
    private let displayName: @MainActor () -> String
    private let privateKeyStore: PairingTargetIdentityPrivateKeyStore
    private let makeUUID: () -> UUID

    init(
        storage: UserDefaults = .standard,
        displayName: @escaping @MainActor () -> String =
            DefaultPairingTargetIdentityProvider.deviceDisplayName,
        privateKeyStore: PairingTargetIdentityPrivateKeyStore =
            KeychainPairingTargetIdentityPrivateKeyStore(),
        makeUUID: @escaping () -> UUID = UUID.init
    ) {
        self.storage = storage
        self.displayName = displayName
        self.privateKeyStore = privateKeyStore
        self.makeUUID = makeUUID
    }

    func makeIdentity() throws -> PairingTargetIdentity {
        let privateKey = try pairingPrivateKey()
        let publicKeyData = privateKey.publicKey.derRepresentation
        let digest = SHA256.hash(data: publicKeyData)
        let hexDigest = digest.map { String(format: "%02x", $0) }.joined()

        return PairingTargetIdentity(
            deviceId: deviceId(),
            displayName: normalizedDisplayName(),
            publicKeyFingerprint: "sha256:\(hexDigest)",
            publicKeyAgreementDERBase64URL: publicKeyData.base64URLEncodedString()
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

    private func pairingPrivateKey() throws -> P256.KeyAgreement.PrivateKey {
        if let storedPrivateKeyData = try privateKeyStore.loadPrivateKeyData() {
            do {
                return try P256.KeyAgreement.PrivateKey(rawRepresentation: storedPrivateKeyData)
            } catch {
                throw PairingTargetIdentityProviderError.invalidStoredPrivateKey
            }
        }

        let privateKey = P256.KeyAgreement.PrivateKey()
        try privateKeyStore.savePrivateKeyData(privateKey.rawRepresentation)
        return privateKey
    }

    private static func deviceDisplayName() -> String {
        #if canImport(UIKit)
        UIDevice.current.name
        #else
        "This iPhone"
        #endif
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
