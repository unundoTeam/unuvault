import CryptoKit
import Foundation
import Security

public enum CompanionVaultStoreError: Error, Equatable {
    case invalidKey
    case keyUnavailable(OSStatus)
    case openFailed
}

public protocol CompanionVaultKeyProvider {
    func readOrCreateKeyData() throws -> Data
}

public protocol CompanionVaultStoring {
    func save(credentials: [CompanionCredential]) throws
    func loadCredentials() throws -> [CompanionCredential]
}

public struct StaticCompanionVaultKeyProvider: CompanionVaultKeyProvider {
    private let keyData: Data

    public init(keyData: Data) {
        self.keyData = keyData
    }

    public func readOrCreateKeyData() throws -> Data {
        guard keyData.count == 32 else {
            throw CompanionVaultStoreError.invalidKey
        }

        return keyData
    }
}

public final class KeychainCompanionVaultKeyProvider: CompanionVaultKeyProvider {
    private let account: String
    private let service: String

    public init(
        service: String = "com.unu.unuvault.mac-companion.vault-key",
        account: String = "default"
    ) {
        self.service = service
        self.account = account
    }

    public func readOrCreateKeyData() throws -> Data {
        var readQuery = baseQuery()
        readQuery[kSecReturnData as String] = true
        readQuery[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let readStatus = SecItemCopyMatching(readQuery as CFDictionary, &item)

        if readStatus == errSecSuccess, let data = item as? Data {
            guard data.count == 32 else {
                throw CompanionVaultStoreError.invalidKey
            }

            return data
        }

        guard readStatus == errSecItemNotFound else {
            throw CompanionVaultStoreError.keyUnavailable(readStatus)
        }

        let keyData = try Self.randomKeyData()
        var addQuery = baseQuery()
        addQuery[kSecAttrAccessible as String] =
            kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        addQuery[kSecValueData as String] = keyData

        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)

        if addStatus == errSecDuplicateItem {
            return try readOrCreateKeyData()
        }

        guard addStatus == errSecSuccess else {
            throw CompanionVaultStoreError.keyUnavailable(addStatus)
        }

        return keyData
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: account,
            kSecAttrService as String: service
        ]
    }

    private static func randomKeyData() throws -> Data {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)

        guard status == errSecSuccess else {
            throw CompanionVaultStoreError.keyUnavailable(status)
        }

        return Data(bytes)
    }
}

public final class LocalCompanionVaultStore: CompanionVaultStoring {
    private let keyProvider: CompanionVaultKeyProvider
    private let vaultURL: URL

    public init(keyProvider: CompanionVaultKeyProvider, vaultURL: URL) {
        self.keyProvider = keyProvider
        self.vaultURL = vaultURL
    }

    public static func defaultStore(
        fileManager: FileManager = .default
    ) throws -> LocalCompanionVaultStore {
        let appSupport = try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = appSupport
            .appendingPathComponent("UnuVault", isDirectory: true)
            .appendingPathComponent("MacCompanion", isDirectory: true)

        return LocalCompanionVaultStore(
            keyProvider: KeychainCompanionVaultKeyProvider(),
            vaultURL: directory.appendingPathComponent("vault.json")
        )
    }

    public func save(credentials: [CompanionCredential]) throws {
        let payload = try JSONEncoder().encode(
            StoredVaultPayload(credentials: credentials)
        )
        let sealedBox = try AES.GCM.seal(payload, using: symmetricKey())
        let nonce = sealedBox.nonce.withUnsafeBytes { Data($0) }
        let envelope = StoredVaultEnvelope(
            version: 1,
            algorithm: "AES-GCM-256",
            nonce: nonce.base64EncodedString(),
            ciphertext: sealedBox.ciphertext.base64EncodedString(),
            tag: sealedBox.tag.base64EncodedString()
        )
        let data = try JSONEncoder().encode(envelope)

        try FileManager.default.createDirectory(
            at: vaultURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try data.write(to: vaultURL, options: [.atomic])
    }

    public func loadCredentials() throws -> [CompanionCredential] {
        guard FileManager.default.fileExists(atPath: vaultURL.path) else {
            return []
        }

        do {
            let data = try Data(contentsOf: vaultURL)
            let envelope = try JSONDecoder().decode(
                StoredVaultEnvelope.self,
                from: data
            )
            guard envelope.version == 1, envelope.algorithm == "AES-GCM-256",
                  let nonceData = Data(base64Encoded: envelope.nonce),
                  let ciphertext = Data(base64Encoded: envelope.ciphertext),
                  let tag = Data(base64Encoded: envelope.tag)
            else {
                throw CompanionVaultStoreError.openFailed
            }

            let sealedBox = try AES.GCM.SealedBox(
                nonce: AES.GCM.Nonce(data: nonceData),
                ciphertext: ciphertext,
                tag: tag
            )
            let payloadData = try AES.GCM.open(sealedBox, using: symmetricKey())
            return try JSONDecoder()
                .decode(StoredVaultPayload.self, from: payloadData)
                .credentials
        } catch let error as CompanionVaultStoreError {
            throw error
        } catch {
            throw CompanionVaultStoreError.openFailed
        }
    }

    private func symmetricKey() throws -> SymmetricKey {
        let keyData = try keyProvider.readOrCreateKeyData()

        guard keyData.count == 32 else {
            throw CompanionVaultStoreError.invalidKey
        }

        return SymmetricKey(data: keyData)
    }
}

private struct StoredVaultEnvelope: Codable {
    let version: Int
    let algorithm: String
    let nonce: String
    let ciphertext: String
    let tag: String
}

private struct StoredVaultPayload: Codable {
    let credentials: [CompanionCredential]
}
