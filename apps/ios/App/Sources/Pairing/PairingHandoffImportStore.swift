import Foundation

public enum PairingHandoffImportError: Error, Equatable, Sendable {
    case emptyPayload
    case invalidCredential
}

public struct PairingHandoffImportReceipt: Equatable, Codable, Sendable {
    public let handoffId: String
    public let importedCredentialCount: Int
    public let importedCredentialIds: [String]

    public var statusText: String {
        "Imported \(importedCredentialCount) item(s) from paired Mac."
    }

    public var diagnostic: String {
        "imported(count=\(importedCredentialCount))"
    }

    public var receiptLine: String {
        "UNUVAULT_IOS_PAIRING_RECEIPT imported handoffId=\(handoffId) importedCredentialCount=\(importedCredentialCount)"
    }

    public init(
        handoffId: String,
        importedCredentialCount: Int,
        importedCredentialIds: [String]
    ) {
        self.handoffId = handoffId
        self.importedCredentialCount = importedCredentialCount
        self.importedCredentialIds = importedCredentialIds
    }
}

public struct PairingHandoffImportStore {
    private var importedCredentialsById: [String: PairingImportedCredential] = [:]

    public init() {}

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

        return PairingHandoffImportReceipt(
            handoffId: handoff.handoffId,
            importedCredentialCount: payload.items.count,
            importedCredentialIds: payload.items.map(\.id)
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
}
