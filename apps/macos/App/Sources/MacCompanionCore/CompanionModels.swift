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
