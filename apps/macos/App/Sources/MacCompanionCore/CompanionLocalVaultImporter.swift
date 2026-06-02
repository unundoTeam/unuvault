import Foundation

public enum CompanionLocalVaultImportResult: Equatable {
    case imported(CompanionLocalVaultImportReceipt)
    case invalidRequest
    case locked
    case saveFailed
}

public struct CompanionLocalVaultImportReceipt: Equatable, Codable {
    public let source: String
    public let importedCredentialIds: [String]
    public let credentialCount: Int

    public init(
        source: String,
        importedCredentialIds: [String],
        credentialCount: Int
    ) {
        self.source = source
        self.importedCredentialIds = importedCredentialIds
        self.credentialCount = credentialCount
    }
}

public struct CompanionWebAccountVaultImportCredential: Equatable, Codable {
    public let id: String
    public let title: String
    public let username: String
    public let websiteURL: String
    public let profileId: String
    public let password: String

    public init(
        id: String,
        title: String,
        username: String,
        websiteURL: String,
        profileId: String,
        password: String
    ) {
        self.id = id
        self.title = title
        self.username = username
        self.websiteURL = websiteURL
        self.profileId = profileId
        self.password = password
    }

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case username
        case websiteURL = "website_url"
        case profileId = "profile_id"
        case password
    }
}

public final class CompanionLocalVaultImporter: @unchecked Sendable {
    public static let webAccountUnlockedVaultSource = "web-account-unlocked-vault"

    private let session: CompanionVaultSession
    private let unlockTTL: TimeInterval
    private let vaultStore: CompanionVaultStoring

    public init(
        session: CompanionVaultSession,
        vaultStore: CompanionVaultStoring,
        unlockTTL: TimeInterval = 300
    ) {
        self.session = session
        self.unlockTTL = unlockTTL
        self.vaultStore = vaultStore
    }

    public func importUnlockedWebAccountCredentials(
        source: String,
        credentials importedCredentials: [CompanionWebAccountVaultImportCredential]
    ) -> CompanionLocalVaultImportResult {
        guard source == Self.webAccountUnlockedVaultSource,
              !importedCredentials.isEmpty
        else {
            return .invalidRequest
        }

        guard var credentials = session.credentialsForPairing() else {
            return .locked
        }

        var importedIds: [String] = []

        for importedCredential in importedCredentials {
            guard let credential = Self.makeCompanionCredential(importedCredential) else {
                return .invalidRequest
            }

            importedIds.append(credential.id)

            if let existingIndex = credentials.firstIndex(where: { existing in
                existing.id == credential.id
            }) {
                credentials[existingIndex] = credential
            } else {
                credentials.append(credential)
            }
        }

        do {
            try vaultStore.save(credentials: credentials)
            session.unlock(credentials: credentials, ttl: unlockTTL)

            return .imported(
                CompanionLocalVaultImportReceipt(
                    source: source,
                    importedCredentialIds: importedIds,
                    credentialCount: credentials.count
                )
            )
        } catch {
            return .saveFailed
        }
    }

    private static func makeCompanionCredential(
        _ importedCredential: CompanionWebAccountVaultImportCredential
    ) -> CompanionCredential? {
        let id = importedCredential.id.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = importedCredential.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let username = importedCredential.username.trimmingCharacters(in: .whitespacesAndNewlines)
        let profileId = importedCredential.profileId.trimmingCharacters(
            in: .whitespacesAndNewlines
        )
        let password = importedCredential.password

        guard !id.isEmpty,
              !title.isEmpty,
              !username.isEmpty,
              !profileId.isEmpty,
              !password.isEmpty,
              let websiteOrigin = normalizedHTTPOrigin(importedCredential.websiteURL)
        else {
            return nil
        }

        return CompanionCredential(
            id: id,
            label: title,
            username: username,
            password: password,
            profileId: profileId,
            websiteOrigin: websiteOrigin
        )
    }

    private static func normalizedHTTPOrigin(_ value: String) -> String? {
        guard let url = URL(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
              let scheme = url.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              let host = url.host?.lowercased()
        else {
            return nil
        }

        let portPart = url.port.map { ":\($0)" } ?? ""
        return "\(scheme)://\(host)\(portPart)"
    }
}
