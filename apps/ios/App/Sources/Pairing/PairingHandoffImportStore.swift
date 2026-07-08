import CryptoKit
import Foundation

public enum PairingHandoffImportError: Error, Equatable, Sendable {
    case emptyPayload
    case invalidEncryptedStore
    case invalidCredential
}

public struct PairingHandoffImportReceipt: Equatable, Codable, Sendable {
    public let handoffId: String
    public let importedCredentialCount: Int
    public let importedCredentialIds: [String]
    public let materialAlgorithm: String
    public let sourceDeviceId: String
    public let targetDeviceId: String

    public var statusText: String {
        "Imported \(importedCredentialCount) item(s) from paired Mac."
    }

    public var diagnostic: String {
        "imported(count=\(importedCredentialCount))"
    }

    public var receiptLine: String {
        "UNUVAULT_IOS_PAIRING_RECEIPT imported " +
            "handoffId=\(handoffId) " +
            "sourceDeviceId=\(sourceDeviceId) " +
            "targetDeviceId=\(targetDeviceId) " +
            "importedCredentialCount=\(importedCredentialCount) " +
            "material=\(materialAlgorithm)"
    }

    public init(
        handoffId: String,
        importedCredentialCount: Int,
        importedCredentialIds: [String],
        materialAlgorithm: String,
        sourceDeviceId: String,
        targetDeviceId: String
    ) {
        self.handoffId = handoffId
        self.importedCredentialCount = importedCredentialCount
        self.importedCredentialIds = importedCredentialIds
        self.materialAlgorithm = materialAlgorithm
        self.sourceDeviceId = sourceDeviceId
        self.targetDeviceId = targetDeviceId
    }
}

public struct PairingHandoffImportStore {
    private enum Persistence {
        case memory
        case encryptedFile(URL, SymmetricKey)
    }

    private struct EncryptedStoreEnvelope: Codable {
        let version: Int
        let nonce: Data
        let ciphertext: Data
        let tag: Data
    }

    private struct ImportSnapshot: Codable {
        let credentials: [PairingImportedCredential]
    }

    private var importedCredentialsById: [String: PairingImportedCredential] = [:]
    private let persistence: Persistence

    public init() {
        persistence = .memory
    }

    public init(encryptedStoreURL: URL, encryptionKey: SymmetricKey) throws {
        persistence = .encryptedFile(encryptedStoreURL, encryptionKey)
        importedCredentialsById = try Self.loadEncryptedStore(
            from: encryptedStoreURL,
            using: encryptionKey
        )
    }

    public mutating func importPayload(
        _ payload: PairingHandoffOpenedPayload,
        from handoff: MacPairingHandoff
    ) throws -> PairingHandoffImportReceipt {
        guard payload.items.isEmpty == false else {
            throw PairingHandoffImportError.emptyPayload
        }

        for credential in payload.items {
            guard Self.isValidCredential(credential) else {
                throw PairingHandoffImportError.invalidCredential
            }
        }

        for credential in payload.items {
            importedCredentialsById[credential.id] = credential
        }
        try persistIfNeeded()

        return PairingHandoffImportReceipt(
            handoffId: handoff.handoffId,
            importedCredentialCount: payload.items.count,
            importedCredentialIds: payload.items.map(\.id),
            materialAlgorithm: handoff.material.algorithm,
            sourceDeviceId: handoff.sourceDeviceId,
            targetDeviceId: handoff.targetDeviceId
        )
    }

    public func importedCredential(id: String) -> PairingImportedCredential? {
        importedCredentialsById[id]
    }

    private static func isValidCredential(_ credential: PairingImportedCredential) -> Bool {
        !credential.id.isEmpty &&
            !credential.label.isEmpty &&
            !credential.username.isEmpty &&
            !credential.password.isEmpty &&
            !credential.profileId.isEmpty &&
            !credential.websiteOrigin.isEmpty
    }

    private mutating func persistIfNeeded() throws {
        guard case let .encryptedFile(url, key) = persistence else {
            return
        }

        try Self.saveEncryptedStore(
            importedCredentialsById,
            to: url,
            using: key
        )
    }

    private static func loadEncryptedStore(
        from url: URL,
        using key: SymmetricKey
    ) throws -> [String: PairingImportedCredential] {
        guard FileManager.default.fileExists(atPath: url.path) else {
            return [:]
        }

        do {
            let data = try Data(contentsOf: url)
            let envelope = try JSONDecoder().decode(EncryptedStoreEnvelope.self, from: data)
            guard envelope.version == 1 else {
                throw PairingHandoffImportError.invalidEncryptedStore
            }

            let sealedBox = try AES.GCM.SealedBox(
                nonce: AES.GCM.Nonce(data: envelope.nonce),
                ciphertext: envelope.ciphertext,
                tag: envelope.tag
            )
            let snapshotData = try AES.GCM.open(sealedBox, using: key)
            let snapshot = try JSONDecoder().decode(ImportSnapshot.self, from: snapshotData)

            return Dictionary(
                uniqueKeysWithValues: snapshot.credentials.map { ($0.id, $0) }
            )
        } catch let error as PairingHandoffImportError {
            throw error
        } catch {
            throw PairingHandoffImportError.invalidEncryptedStore
        }
    }

    private static func saveEncryptedStore(
        _ credentialsById: [String: PairingImportedCredential],
        to url: URL,
        using key: SymmetricKey
    ) throws {
        let snapshot = ImportSnapshot(
            credentials: credentialsById.values.sorted { $0.id < $1.id }
        )
        let snapshotData = try JSONEncoder().encode(snapshot)
        let sealedBox = try AES.GCM.seal(snapshotData, using: key)
        let envelope = EncryptedStoreEnvelope(
            version: 1,
            nonce: sealedBox.nonce.withUnsafeBytes { Data($0) },
            ciphertext: sealedBox.ciphertext,
            tag: sealedBox.tag
        )
        let encryptedData = try JSONEncoder().encode(envelope)
        let directoryURL = url.deletingLastPathComponent()

        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )
        try encryptedData.write(to: url, options: [.atomic])
    }
}
