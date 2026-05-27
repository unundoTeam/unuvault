import Foundation

public final class CompanionBridgeService {
    private let session: CompanionVaultSession
    public private(set) var pendingApproval: CompanionApprovalRequest?
    private var pendingCredential: CompanionCredential?

    public init(session: CompanionVaultSession) {
        self.session = session
    }

    public func metadata(origin: String, profileId: String) -> CompanionMetadataResult {
        let credentials = session.metadata(origin: origin, profileId: profileId)

        if credentials.isEmpty {
            guard isSessionUnlocked() else {
                return .locked
            }
        }

        return .credentials(credentials)
    }

    public func requestRelease(
        id: String,
        origin: String,
        profileId: String,
        reason: String
    ) -> CompanionReleaseResult {
        guard reason == "fill-active-page" else {
            return .invalidRequest
        }

        guard isSessionUnlocked() else {
            return .locked
        }

        guard let credential = session.credential(
            id: id,
            origin: origin,
            profileId: profileId
        ) else {
            return .notFound
        }

        let approval = CompanionApprovalRequest(
            id: credential.id,
            origin: credential.websiteOrigin,
            profileId: credential.profileId,
            label: credential.label,
            username: credential.username
        )
        pendingApproval = approval
        pendingCredential = credential

        return .approvalRequired(approval)
    }

    public func approvePendingRelease(id: String) -> CompanionReleaseResult {
        guard let approval = pendingApproval,
              approval.id == id,
              let credential = pendingCredential
        else {
            return .notFound
        }

        guard isSessionUnlocked() else {
            return .locked
        }

        guard session.credential(
            id: approval.id,
            origin: approval.origin,
            profileId: approval.profileId
        ) == credential else {
            clearPendingApproval()
            return .notFound
        }

        clearPendingApproval()

        return .released(
            CompanionReleasedCredential(
                username: credential.username,
                password: credential.password
            )
        )
    }

    public func denyPendingRelease(id: String) -> CompanionReleaseResult {
        guard pendingApproval?.id == id else {
            return .notFound
        }

        clearPendingApproval()
        return .denied
    }

    public func clearPendingApproval() {
        pendingApproval = nil
        pendingCredential = nil
    }

    private func isSessionUnlocked() -> Bool {
        guard case .unlocked = session.lockState else {
            clearPendingApproval()
            return false
        }

        return true
    }
}
