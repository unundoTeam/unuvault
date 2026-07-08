import CryptoKit
import Foundation
import Security

enum PairingReceivedVaultStoreConfigurationError: Error, Equatable {
    case applicationSupportDirectoryUnavailable
    case invalidStoredEncryptionKey
    case keychainReadFailed(OSStatus)
    case keychainWriteFailed(OSStatus)
}

protocol PairingReceivedVaultEncryptionKeyStore {
    func loadEncryptionKeyData() throws -> Data?
    func saveEncryptionKeyData(_ data: Data) throws
}

struct KeychainPairingReceivedVaultEncryptionKeyStore:
    PairingReceivedVaultEncryptionKeyStore
{
    private let service: String
    private let account: String

    init(
        service: String = "com.unundo.unuvault.ios.received-vault",
        account: String = "received-vault-aes-gcm-key-v1"
    ) {
        self.service = service
        self.account = account
    }

    func loadEncryptionKeyData() throws -> Data? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess else {
            throw PairingReceivedVaultStoreConfigurationError.keychainReadFailed(status)
        }

        guard let data = result as? Data else {
            throw PairingReceivedVaultStoreConfigurationError.invalidStoredEncryptionKey
        }

        return data
    }

    func saveEncryptionKeyData(_ data: Data) throws {
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
                throw PairingReceivedVaultStoreConfigurationError
                    .keychainWriteFailed(updateStatus)
            }

            return
        }

        throw PairingReceivedVaultStoreConfigurationError.keychainWriteFailed(addStatus)
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}

struct PairingReceivedVaultStoreConfiguration {
    private let encryptedStoreURLProvider: () throws -> URL
    private let encryptionKeyProvider: () throws -> SymmetricKey

    init(
        encryptedStoreURL: URL,
        encryptionKeyProvider: @escaping () throws -> SymmetricKey
    ) {
        self.encryptedStoreURLProvider = { encryptedStoreURL }
        self.encryptionKeyProvider = encryptionKeyProvider
    }

    init(
        encryptedStoreURLProvider: @escaping () throws -> URL,
        encryptionKeyProvider: @escaping () throws -> SymmetricKey
    ) {
        self.encryptedStoreURLProvider = encryptedStoreURLProvider
        self.encryptionKeyProvider = encryptionKeyProvider
    }

    static func appDefault(
        fileManager: FileManager = .default,
        encryptionKeyStore: PairingReceivedVaultEncryptionKeyStore =
            KeychainPairingReceivedVaultEncryptionKeyStore()
    ) -> PairingReceivedVaultStoreConfiguration {
        PairingReceivedVaultStoreConfiguration(
            encryptedStoreURLProvider: {
                try defaultEncryptedStoreURL(fileManager: fileManager)
            },
            encryptionKeyProvider: {
                try loadOrCreateEncryptionKey(from: encryptionKeyStore)
            }
        )
    }

    func makeImportStore() throws -> PairingHandoffImportStore {
        try PairingHandoffImportStore(
            encryptedStoreURL: try encryptedStoreURLProvider(),
            encryptionKey: try encryptionKeyProvider()
        )
    }

    private static func defaultEncryptedStoreURL(fileManager: FileManager) throws -> URL {
        guard let applicationSupportURL = fileManager.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else {
            throw PairingReceivedVaultStoreConfigurationError
                .applicationSupportDirectoryUnavailable
        }

        return applicationSupportURL
            .appendingPathComponent("com.unundo.unuvault.ios", isDirectory: true)
            .appendingPathComponent("received-vault.store")
    }

    private static func loadOrCreateEncryptionKey(
        from keyStore: PairingReceivedVaultEncryptionKeyStore
    ) throws -> SymmetricKey {
        if let storedKeyData = try keyStore.loadEncryptionKeyData() {
            guard storedKeyData.count == 32 else {
                throw PairingReceivedVaultStoreConfigurationError.invalidStoredEncryptionKey
            }

            return SymmetricKey(data: storedKeyData)
        }

        let key = SymmetricKey(size: .bits256)
        let keyData = key.withUnsafeBytes { Data($0) }
        try keyStore.saveEncryptionKeyData(keyData)
        return key
    }
}

@MainActor
final class DefaultPairingHandoffImporter {
    private let opener: PairingHandoffOpener
    private let privateKeyStore: PairingTargetIdentityPrivateKeyStore
    private var importStore: PairingHandoffImportStore?
    private let receivedVaultStoreConfiguration: PairingReceivedVaultStoreConfiguration
    private let now: @Sendable () -> Date

    init(
        opener: PairingHandoffOpener = PairingHandoffOpener(),
        privateKeyStore: PairingTargetIdentityPrivateKeyStore =
            KeychainPairingTargetIdentityPrivateKeyStore(),
        importStore: PairingHandoffImportStore? = nil,
        receivedVaultStoreConfiguration: PairingReceivedVaultStoreConfiguration =
            .appDefault(),
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.opener = opener
        self.privateKeyStore = privateKeyStore
        self.importStore = importStore
        self.receivedVaultStoreConfiguration = receivedVaultStoreConfiguration
        self.now = now
    }

    func importHandoff(
        _ handoff: MacPairingHandoff,
        expectedTarget: PairingTargetIdentity
    ) throws -> PairingHandoffImportReceipt {
        guard let privateKeyData = try privateKeyStore.loadPrivateKeyData() else {
            throw PairingTargetIdentityProviderError.invalidStoredPrivateKey
        }

        let privateKey: P256.KeyAgreement.PrivateKey

        do {
            privateKey = try P256.KeyAgreement.PrivateKey(rawRepresentation: privateKeyData)
        } catch {
            throw PairingTargetIdentityProviderError.invalidStoredPrivateKey
        }

        let openedPayload = try opener.open(
            handoff,
            recipientPrivateKey: privateKey,
            expectedTarget: expectedTarget,
            now: now()
        )

        var receivedVaultStore = try importStore ??
            receivedVaultStoreConfiguration.makeImportStore()
        let receipt = try receivedVaultStore.importPayload(openedPayload, from: handoff)
        importStore = receivedVaultStore
        return receipt
    }
}
