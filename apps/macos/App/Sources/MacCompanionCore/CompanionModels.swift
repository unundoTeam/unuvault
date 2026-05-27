import Foundation

public enum CompanionLockState: Equatable {
    case locked
    case unlocked(expiresAt: Date)
    case attentionNeeded(reason: CompanionAttentionReason)
}

public enum CompanionAttentionReason: String, Equatable {
    case lostDevice
    case revoked
    case unlockExpired
}

public struct CompanionCredential: Equatable, Identifiable {
    public let id: String
    public let label: String
    public let username: String
    public let password: String
    public let profileId: String
    public let websiteOrigin: String

    public init(
        id: String,
        label: String,
        username: String,
        password: String,
        profileId: String,
        websiteOrigin: String
    ) {
        self.id = id
        self.label = label
        self.username = username
        self.password = password
        self.profileId = profileId
        self.websiteOrigin = websiteOrigin
    }
}

public struct CompanionCredentialMetadata: Equatable, Identifiable, Codable {
    public let id: String
    public let label: String
    public let username: String

    public init(id: String, label: String, username: String) {
        self.id = id
        self.label = label
        self.username = username
    }
}

public struct CompanionApprovalRequest: Equatable, Identifiable, Codable {
    public let id: String
    public let origin: String
    public let profileId: String
    public let label: String
    public let username: String

    public init(
        id: String,
        origin: String,
        profileId: String,
        label: String,
        username: String
    ) {
        self.id = id
        self.origin = origin
        self.profileId = profileId
        self.label = label
        self.username = username
    }
}

public struct CompanionReleasedCredential: Equatable, Codable {
    public let username: String
    public let password: String

    public init(username: String, password: String) {
        self.username = username
        self.password = password
    }
}

public enum CompanionMetadataResult: Equatable {
    case locked
    case credentials([CompanionCredentialMetadata])
}

public enum CompanionReleaseResult: Equatable {
    case locked
    case invalidRequest
    case notFound
    case approvalRequired(CompanionApprovalRequest)
    case released(CompanionReleasedCredential)
    case denied
}
