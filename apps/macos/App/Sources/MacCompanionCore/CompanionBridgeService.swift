import Foundation

public final class CompanionBridgeService: @unchecked Sendable {
    private let stateLock = NSRecursiveLock()
    private let session: CompanionVaultSession
    private var currentPendingApproval: CompanionApprovalRequest?
    private var pendingCredential: CompanionCredential?
    private var approvedCredential: CompanionCredential?

    public var pendingApproval: CompanionApprovalRequest? {
        stateLock.lock()
        defer { stateLock.unlock() }

        return currentPendingApproval
    }

    public init(session: CompanionVaultSession) {
        self.session = session
    }

    public func metadata(origin: String, profileId: String) -> CompanionMetadataResult {
        stateLock.lock()
        defer { stateLock.unlock() }

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
        stateLock.lock()
        defer { stateLock.unlock() }

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
        currentPendingApproval = approval
        pendingCredential = credential
        approvedCredential = nil

        return .approvalRequired(approval)
    }

    public func approvePendingRelease(id: String) -> CompanionReleaseResult {
        stateLock.lock()
        defer { stateLock.unlock() }

        guard let approval = currentPendingApproval,
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
            clearReleaseMaterialLocked()
            return .notFound
        }

        currentPendingApproval = nil
        pendingCredential = nil
        approvedCredential = credential

        return .released(
            CompanionReleasedCredential(
                username: credential.username,
                password: credential.password
            )
        )
    }

    public func consumeApprovedRelease(
        id: String,
        origin: String,
        profileId: String
    ) -> CompanionReleaseResult {
        stateLock.lock()
        defer { stateLock.unlock() }

        guard isSessionUnlocked() else {
            return .locked
        }

        guard let credential = approvedCredential,
              credential.id == id,
              session.credential(id: id, origin: origin, profileId: profileId) == credential
        else {
            return .notFound
        }

        approvedCredential = nil

        return .released(
            CompanionReleasedCredential(
                username: credential.username,
                password: credential.password
            )
        )
    }

    public func denyPendingRelease(id: String) -> CompanionReleaseResult {
        stateLock.lock()
        defer { stateLock.unlock() }

        guard currentPendingApproval?.id == id else {
            return .notFound
        }

        clearReleaseMaterialLocked()
        return .denied
    }

    public func clearPendingApproval() {
        stateLock.lock()
        defer { stateLock.unlock() }

        clearReleaseMaterialLocked()
    }

    private func clearReleaseMaterialLocked() {
        currentPendingApproval = nil
        pendingCredential = nil
        approvedCredential = nil
    }

    private func isSessionUnlocked() -> Bool {
        guard case .unlocked = session.lockState else {
            clearReleaseMaterialLocked()
            return false
        }

        return true
    }
}
