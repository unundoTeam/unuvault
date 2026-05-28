import Combine
import Foundation
import MacCompanionCore

enum CompanionMenuRoute {
    case overview
    case addLogin
}

@MainActor
final class CompanionViewModel: ObservableObject {
    @Published var credentialLabel = ""
    @Published var credentialOrigin = ""
    @Published var credentialPassword = ""
    @Published var credentialUsername = ""
    @Published var lastDecisionText = L10n.string("decision.idle")
    @Published var pendingApproval: CompanionApprovalRequest?
    @Published var route: CompanionMenuRoute = .overview
    @Published var savedCredentialCountText = L10n.format("status.saved_count", 0)
    @Published var statusText = L10n.string("status.locked")

    private let accessToken: String
    private let bridgePort: UInt16
    private let session = CompanionVaultSession()
    private let startupCredential: CompanionCredential?
    private let unlockOnStart: Bool
    private let vaultStore: LocalCompanionVaultStore?
    private lazy var bridgeService = CompanionBridgeService(session: session)
    private var didApplyStartupState = false
    private var refreshTimer: Timer?
    private var server: LoopbackHTTPServer?

    init(
        vaultStore: LocalCompanionVaultStore? = try? LocalCompanionVaultStore.defaultStore(),
        accessToken: String = "local-dev-bridge-token",
        bridgePort: UInt16 = 17666,
        startupCredential: CompanionCredential? = nil,
        unlockOnStart: Bool = false
    ) {
        self.accessToken = accessToken
        self.bridgePort = bridgePort
        self.startupCredential = startupCredential
        self.unlockOnStart = unlockOnStart
        self.vaultStore = vaultStore
    }

    var isUnlocked: Bool {
        if case .unlocked = session.lockState {
            return true
        }

        return false
    }

    var primaryActionTitle: String {
        isUnlocked ? L10n.string("action.lock_vault") : L10n.string("action.unlock_vault")
    }

    var statusBadgeText: String {
        L10n.format("status.badge", statusText, savedCredentialCountText)
    }

    var statusPanelTitle: String {
        switch session.lockState {
        case .locked:
            L10n.string("home.locked.title")
        case .unlocked:
            L10n.string("home.unlocked.title")
        case .attentionNeeded:
            L10n.string("home.attention.title")
        }
    }

    var statusPanelCopy: String {
        switch session.lockState {
        case .locked:
            L10n.string("home.locked.copy")
        case .unlocked:
            L10n.string("home.unlocked.copy")
        case .attentionNeeded:
            L10n.string("home.attention.copy")
        }
    }

    func start() {
        applyStartupStateIfNeeded()

        if server == nil {
            let codec = BridgeHTTPCodec(
                service: bridgeService,
                accessToken: accessToken
            )
            server = LoopbackHTTPServer(codec: codec, port: bridgePort)

            do {
                try server?.start()
            } catch {
                lastDecisionText = L10n.string("decision.bridge_unavailable")
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

    private func applyStartupStateIfNeeded() {
        guard !didApplyStartupState else {
            return
        }

        didApplyStartupState = true

        if let startupCredential, let vaultStore {
            do {
                try vaultStore.save(credentials: [startupCredential])
            } catch {
                lastDecisionText = L10n.string("decision.save_failed")
            }
        }

        if unlockOnStart {
            unlockLocalVault()
        }
    }

    func showAddLogin() {
        route = .addLogin
    }

    func cancelAddLogin() {
        route = .overview
    }

    @discardableResult
    func saveLocalCredential() -> Bool {
        guard let vaultStore else {
            lastDecisionText = L10n.string("decision.vault_unavailable")
            return false
        }

        let trimmedLabel = credentialLabel.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedOrigin = credentialOrigin.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedUsername = credentialUsername.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedLabel.isEmpty,
              !trimmedOrigin.isEmpty,
              !trimmedUsername.isEmpty,
              !credentialPassword.isEmpty
        else {
            lastDecisionText = L10n.string("decision.complete_fields")
            return false
        }

        do {
            var credentials = try vaultStore.loadCredentials()
            credentials.append(
                CompanionCredential(
                    id: "local-\(UUID().uuidString)",
                    label: trimmedLabel,
                    username: trimmedUsername,
                    password: credentialPassword,
                    profileId: "personal",
                    websiteOrigin: trimmedOrigin
                )
            )
            try vaultStore.save(credentials: credentials)
            credentialLabel = ""
            credentialOrigin = ""
            credentialPassword = ""
            credentialUsername = ""
            route = .overview
            lastDecisionText = L10n.format("decision.saved", trimmedLabel)
            refresh()
            return true
        } catch {
            lastDecisionText = L10n.string("decision.save_failed")
            return false
        }
    }

    func toggleLockState() {
        if isUnlocked {
            lock()
        } else {
            unlockLocalVault()
        }
    }

    func unlockLocalVault() {
        guard let vaultStore else {
            lastDecisionText = L10n.string("decision.vault_unavailable")
            return
        }

        do {
            let credentials = try vaultStore.loadCredentials()

            guard !credentials.isEmpty else {
                lastDecisionText = L10n.string("decision.no_logins")
                refresh()
                return
            }

            session.unlock(credentials: credentials, ttl: 300)
            lastDecisionText = L10n.string("decision.unlocked")
        } catch {
            lastDecisionText = L10n.string("decision.open_failed")
        }

        refresh()
    }

    func lock() {
        session.lock()
        bridgeService.clearPendingApproval()
        pendingApproval = nil
        route = .overview
        refresh()
    }

    func pairIPhone() {
        lastDecisionText = isUnlocked
            ? L10n.string("decision.pairing_ready")
            : L10n.string("decision.pairing_locked")
    }

    func approvePendingFill() {
        guard let pendingApproval else {
            return
        }

        _ = bridgeService.approvePendingRelease(id: pendingApproval.id)
        lastDecisionText = L10n.format("decision.approved", pendingApproval.origin)
        self.pendingApproval = nil
        refresh()
    }

    func denyPendingFill() {
        guard let pendingApproval else {
            return
        }

        _ = bridgeService.denyPendingRelease(id: pendingApproval.id)
        lastDecisionText = L10n.format("decision.denied", pendingApproval.origin)
        self.pendingApproval = nil
        refresh()
    }

    func refresh() {
        pendingApproval = bridgeService.pendingApproval
        updateSavedCredentialCountText()

        switch session.lockState {
        case .locked:
            statusText = L10n.string("status.locked")
        case .unlocked:
            statusText = L10n.string("status.unlocked")
        case .attentionNeeded(let reason):
            statusText = L10n.format("status.attention", reason.rawValue)
        }
    }

    private func updateSavedCredentialCountText() {
        guard let count = try? vaultStore?.loadCredentials().count else {
            savedCredentialCountText = L10n.string("status.unavailable")
            return
        }

        savedCredentialCountText = L10n.format("status.saved_count", count)
    }
}
