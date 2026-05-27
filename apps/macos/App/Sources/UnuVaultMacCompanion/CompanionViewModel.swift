import Combine
import Foundation
import MacCompanionCore

@MainActor
final class CompanionViewModel: ObservableObject {
    @Published var masterPassword = ""
    @Published var statusText = "Locked"
    @Published var pendingApproval: CompanionApprovalRequest?
    @Published var lastDecisionText = "No fill requests yet."

    private let session = CompanionVaultSession()
    private lazy var bridgeService = CompanionBridgeService(session: session)
    private var refreshTimer: Timer?
    private var server: LoopbackHTTPServer?

    func start() {
        if server == nil {
            let codec = BridgeHTTPCodec(
                service: bridgeService,
                accessToken: "local-dev-bridge-token"
            )
            server = LoopbackHTTPServer(codec: codec)

            do {
                try server?.start()
            } catch {
                lastDecisionText = "Local bridge unavailable."
            }
        }

        if refreshTimer == nil {
            refreshTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
                Task { @MainActor in
                    self?.refresh()
                }
            }
        }

        refresh()
    }

    func unlockForDemo() {
        session.unlock(
            credentials: [
                CompanionCredential(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    password: "demo-password",
                    profileId: "personal",
                    websiteOrigin: "https://github.com"
                )
            ],
            ttl: 300
        )
        masterPassword = ""
        refresh()
    }

    func lock() {
        session.lock()
        bridgeService.clearPendingApproval()
        pendingApproval = nil
        refresh()
    }

    func approvePendingFill() {
        guard let pendingApproval else {
            return
        }

        _ = bridgeService.approvePendingRelease(id: pendingApproval.id)
        lastDecisionText = "Approved once for \(pendingApproval.origin)"
        self.pendingApproval = nil
        refresh()
    }

    func denyPendingFill() {
        guard let pendingApproval else {
            return
        }

        _ = bridgeService.denyPendingRelease(id: pendingApproval.id)
        lastDecisionText = "Denied fill for \(pendingApproval.origin)"
        self.pendingApproval = nil
        refresh()
    }

    func refresh() {
        pendingApproval = bridgeService.pendingApproval

        switch session.lockState {
        case .locked:
            statusText = "Locked"
        case .unlocked:
            statusText = "Unlocked"
        case .attentionNeeded(let reason):
            statusText = "Attention: \(reason.rawValue)"
        }
    }
}
