import Foundation

public final class CompanionVaultSession {
    private let now: () -> Date
    private var credentials: [CompanionCredential] = []
    private var expiresAt: Date?
    private var attentionReason: CompanionAttentionReason?

    public init(now: @escaping () -> Date = Date.init) {
        self.now = now
    }

    public var lockState: CompanionLockState {
        if let attentionReason {
            return .attentionNeeded(reason: attentionReason)
        }

        guard let expiresAt else {
            return .locked
        }

        if now() >= expiresAt {
            credentials = []
            self.expiresAt = nil
            attentionReason = .unlockExpired
            return .attentionNeeded(reason: .unlockExpired)
        }

        return .unlocked(expiresAt: expiresAt)
    }

    public func unlock(credentials nextCredentials: [CompanionCredential], ttl: TimeInterval) {
        credentials = nextCredentials.compactMap { credential in
            guard let websiteOrigin = Self.normalizedOrigin(credential.websiteOrigin) else {
                return nil
            }

            return CompanionCredential(
                id: credential.id,
                label: credential.label,
                username: credential.username,
                password: credential.password,
                profileId: credential.profileId,
                websiteOrigin: websiteOrigin
            )
        }
        expiresAt = now().addingTimeInterval(ttl)
        attentionReason = nil
    }

    public func lock() {
        credentials = []
        expiresAt = nil
        attentionReason = nil
    }

    public func markLostDevice() {
        credentials = []
        expiresAt = nil
        attentionReason = .lostDevice
    }

    public func markRevoked() {
        credentials = []
        expiresAt = nil
        attentionReason = .revoked
    }

    public func metadata(origin: String, profileId: String) -> [CompanionCredentialMetadata] {
        guard case .unlocked = lockState else {
            return []
        }

        guard let normalizedOrigin = Self.normalizedOrigin(origin) else {
            return []
        }

        return credentials
            .filter { credential in
                credential.websiteOrigin == normalizedOrigin &&
                    credential.profileId == profileId
            }
            .map { credential in
                CompanionCredentialMetadata(
                    id: credential.id,
                    label: credential.label,
                    username: credential.username
                )
            }
    }

    public func credential(
        id: String,
        origin: String,
        profileId: String
    ) -> CompanionCredential? {
        guard case .unlocked = lockState else {
            return nil
        }

        guard let normalizedOrigin = Self.normalizedOrigin(origin) else {
            return nil
        }

        return credentials.first { credential in
            credential.id == id &&
                credential.websiteOrigin == normalizedOrigin &&
                credential.profileId == profileId
        }
    }

    private static func normalizedOrigin(_ value: String) -> String? {
        guard let url = URL(string: value), let scheme = url.scheme?.lowercased() else {
            return nil
        }

        guard scheme == "http" || scheme == "https" else {
            return nil
        }

        guard let host = url.host?.lowercased() else {
            return nil
        }

        let portPart = url.port.map { ":\($0)" } ?? ""
        return "\(scheme)://\(host)\(portPart)"
    }
}
