import Combine
import Foundation
import MacCompanionCore

enum CompanionMenuRoute: Equatable {
    case overview
    case addLogin
    case editLogin
}

struct CompanionLocalCredentialRow: Equatable, Identifiable {
    let id: String
    let label: String
    let username: String
    let websiteOrigin: String

    init(_ credential: CompanionCredential) {
        id = credential.id
        label = credential.label
        username = credential.username
        websiteOrigin = credential.websiteOrigin
    }

    func matches(_ query: String) -> Bool {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        guard !normalizedQuery.isEmpty else {
            return true
        }

        return label.lowercased().contains(normalizedQuery) ||
            username.lowercased().contains(normalizedQuery) ||
            websiteOrigin.lowercased().contains(normalizedQuery)
    }
}

@MainActor
final class CompanionViewModel: ObservableObject {
    @Published var credentialLabel = ""
    @Published var credentialOrigin = ""
    @Published var credentialPassword = ""
    @Published var credentialUsername = ""
    @Published var lastDecisionText = L10n.string("decision.idle")
    @Published private(set) var launchAtLoginStatus: LaunchAtLoginStatus
    @Published var pairingInviteText: String?
    @Published var pairingPayload: CompanionPairingQRCodePayload?
    @Published private(set) var pendingDeleteCredential: CompanionLocalCredentialRow?
    @Published var pendingApproval: CompanionApprovalRequest?
    @Published var route: CompanionMenuRoute = .overview
    @Published var savedCredentialCountText = L10n.format("status.saved_count", 0)
    @Published private(set) var savedCredentialRows: [CompanionLocalCredentialRow] = []
    @Published var searchText = ""
    @Published var statusText = L10n.string("status.locked")

    private let accessToken: String
    private let addLoginDraftCredential: CompanionCredential?
    private let bridgeBindHost: String
    private let bridgePort: UInt16
    private let clipboardClearDelay: TimeInterval
    private let clipboardWriter: CompanionClipboardWriting
    private let localUserPresenceAuthorizer: LocalUserPresenceAuthorizing
    private let launchAtLoginController: LaunchAtLoginControlling
    private let pairingBaseURL: URL
    private let pairingSourceDeviceDisplayName: String
    private let pairingSourceDeviceId: String
    private let session = CompanionVaultSession()
    private let startupCredential: CompanionCredential?
    private let unlockOnStart: Bool
    private let vaultStore: CompanionVaultStoring?
    private lazy var bridgeService = CompanionBridgeService(session: session)
    private lazy var pairingCoordinator = CompanionPairingSessionCoordinator(session: session)
    private var didApplyStartupState = false
    private var editingCredentialId: String?
    private var refreshTimer: Timer?
    private var server: LoopbackHTTPServer?

    init(
        vaultStore: CompanionVaultStoring? = try? LocalCompanionVaultStore.defaultStore(),
        localUserPresenceAuthorizer: LocalUserPresenceAuthorizing =
            LocalAuthenticationUserPresenceAuthorizer(),
        launchAtLoginController: LaunchAtLoginControlling =
            ServiceManagementLaunchAtLoginController(),
        clipboardWriter: CompanionClipboardWriting = MacPasteboardClipboardWriter(),
        clipboardClearDelay: TimeInterval = 45,
        accessToken: String = "local-dev-bridge-token",
        addLoginDraftCredential: CompanionCredential? = nil,
        bridgeBindHost: String = "127.0.0.1",
        bridgePort: UInt16 = 17666,
        pairingBaseURL: URL? = nil,
        pairingSourceDeviceDisplayName: String = Host.current().localizedName ?? "This Mac",
        pairingSourceDeviceId: String = "mac-companion-local",
        startupCredential: CompanionCredential? = nil,
        unlockOnStart: Bool = false
    ) {
        self.accessToken = accessToken
        self.addLoginDraftCredential = addLoginDraftCredential
        self.bridgeBindHost = bridgeBindHost
        self.bridgePort = bridgePort
        self.clipboardClearDelay = clipboardClearDelay
        self.clipboardWriter = clipboardWriter
        self.localUserPresenceAuthorizer = localUserPresenceAuthorizer
        self.launchAtLoginController = launchAtLoginController
        self.launchAtLoginStatus = launchAtLoginController.status
        self.pairingBaseURL = pairingBaseURL ?? CompanionViewModel.defaultPairingBaseURL(
            bridgePort: bridgePort
        )
        self.pairingSourceDeviceDisplayName = pairingSourceDeviceDisplayName
        self.pairingSourceDeviceId = pairingSourceDeviceId
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

    var isLaunchAtLoginEnabled: Bool {
        launchAtLoginStatus == .enabled
    }

    var isLaunchAtLoginControlDisabled: Bool {
        launchAtLoginStatus == .unavailable
    }

    var filteredCredentialRows: [CompanionLocalCredentialRow] {
        savedCredentialRows.filter { row in
            row.matches(searchText)
        }
    }

    var launchAtLoginStatusText: String {
        switch launchAtLoginStatus {
        case .enabled:
            L10n.string("install.login_item.enabled")
        case .disabled:
            L10n.string("install.login_item.disabled")
        case .requiresApproval:
            L10n.string("install.login_item.requires_approval")
        case .unavailable:
            L10n.string("install.login_item.unavailable")
        }
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
                accessToken: accessToken,
                localVaultImporter: vaultStore.map { vaultStore in
                    CompanionLocalVaultImporter(
                        session: session,
                        vaultStore: vaultStore
                    )
                },
                pairingCoordinator: pairingCoordinator
            )
            server = LoopbackHTTPServer(
                codec: codec,
                port: bridgePort,
                bindHost: bridgeBindHost
            )

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

    private static func defaultPairingBaseURL(bridgePort: UInt16) -> URL {
        URL(string: "http://127.0.0.1:\(bridgePort)")!
    }

    func stop() {
        refreshTimer?.invalidate()
        refreshTimer = nil
        server?.stop()
        server = nil
    }

    func setLaunchAtLoginEnabled(_ enabled: Bool) {
        do {
            try launchAtLoginController.setEnabled(enabled)
            launchAtLoginStatus = launchAtLoginController.status
        } catch {
            launchAtLoginStatus = .unavailable
        }
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
            Task { @MainActor in
                await unlockLocalVault()
            }
        }
    }

    func showAddLogin() {
        editingCredentialId = nil
        route = .addLogin

        guard let addLoginDraftCredential,
              credentialOrigin.isEmpty,
              credentialLabel.isEmpty,
              credentialUsername.isEmpty,
              credentialPassword.isEmpty
        else {
            return
        }

        credentialOrigin = addLoginDraftCredential.websiteOrigin
        credentialLabel = addLoginDraftCredential.label
        credentialUsername = addLoginDraftCredential.username
        credentialPassword = addLoginDraftCredential.password
    }

    @discardableResult
    func showEditLogin(_ credential: CompanionLocalCredentialRow) -> Bool {
        guard isUnlocked else {
            lastDecisionText = L10n.string("decision.edit_locked")
            refresh()
            return false
        }

        guard let vaultStore else {
            lastDecisionText = L10n.string("decision.vault_unavailable")
            return false
        }

        do {
            let credentials = try vaultStore.loadCredentials()

            guard let storedCredential = credentials.first(where: { storedCredential in
                storedCredential.id == credential.id
            }) else {
                lastDecisionText = L10n.string("decision.edit_missing")
                refresh()
                return false
            }

            editingCredentialId = storedCredential.id
            credentialOrigin = storedCredential.websiteOrigin
            credentialLabel = storedCredential.label
            credentialUsername = storedCredential.username
            credentialPassword = storedCredential.password
            pendingDeleteCredential = nil
            route = .editLogin
            return true
        } catch {
            lastDecisionText = L10n.string("decision.edit_failed")
            refresh()
            return false
        }
    }

    func cancelAddLogin() {
        clearCredentialDraft()
        route = .overview
    }

    @discardableResult
    func saveLocalCredential() async -> Bool {
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

        let editingCredentialId = editingCredentialId
        let authorizationReason = editingCredentialId == nil
            ? L10n.string("local_auth.save_reason")
            : L10n.string("local_auth.edit_reason")

        guard await authorizeLocalUserPresence(reason: authorizationReason) else {
            return false
        }

        do {
            var credentials = try vaultStore.loadCredentials()

            if let editingCredentialId {
                guard let credentialIndex = credentials.firstIndex(where: { credential in
                    credential.id == editingCredentialId
                }) else {
                    lastDecisionText = L10n.string("decision.edit_missing")
                    refresh()
                    return false
                }

                let existingCredential = credentials[credentialIndex]
                credentials[credentialIndex] = CompanionCredential(
                    id: existingCredential.id,
                    label: trimmedLabel,
                    username: trimmedUsername,
                    password: credentialPassword,
                    profileId: existingCredential.profileId,
                    websiteOrigin: trimmedOrigin
                )
                try vaultStore.save(credentials: credentials)
                session.unlock(credentials: credentials, ttl: 300)
                bridgeService.clearPendingApproval()
                pendingApproval = nil
                clearCredentialDraft()
                route = .overview
                savedCredentialCountText = L10n.format("status.saved_count", credentials.count)
                lastDecisionText = L10n.format("decision.edited", trimmedLabel)
                refresh()
                return true
            }

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
            clearCredentialDraft()
            route = .overview
            savedCredentialCountText = L10n.format("status.saved_count", credentials.count)
            lastDecisionText = L10n.format("decision.saved", trimmedLabel)
            refresh()
            return true
        } catch {
            lastDecisionText = L10n.string("decision.save_failed")
            return false
        }
    }

    private func clearCredentialDraft() {
        editingCredentialId = nil
        credentialLabel = ""
        credentialOrigin = ""
        credentialPassword = ""
        credentialUsername = ""
    }

    func toggleLockState() {
        if isUnlocked {
            lock()
        } else {
            Task { @MainActor in
                await unlockLocalVault()
            }
        }
    }

    func unlockLocalVault() async {
        guard await authorizeLocalUserPresence(
            reason: L10n.string("local_auth.unlock_reason")
        ) else {
            return
        }

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

    private func authorizeLocalUserPresence(reason: String) async -> Bool {
        let authorization = await localUserPresenceAuthorizer.authorize(reason: reason)

        guard authorization == .authorized else {
            lastDecisionText = authorization == .unavailable
                ? L10n.string("decision.local_auth_unavailable")
                : L10n.string("decision.local_auth_failed")
            return false
        }

        return true
    }

    func lock() {
        session.lock()
        bridgeService.clearPendingApproval()
        pairingInviteText = nil
        pairingPayload = nil
        clearCredentialDraft()
        pendingDeleteCredential = nil
        pendingApproval = nil
        route = .overview
        savedCredentialRows = []
        refresh()
    }

    func requestDeleteLocalCredential(_ credential: CompanionLocalCredentialRow) {
        guard isUnlocked else {
            pendingDeleteCredential = nil
            lastDecisionText = L10n.string("decision.delete_locked")
            return
        }

        pendingDeleteCredential = credential
    }

    func cancelDeleteLocalCredential() {
        pendingDeleteCredential = nil
    }

    @discardableResult
    func copyUsername(_ credential: CompanionLocalCredentialRow) -> Bool {
        guard isUnlocked else {
            lastDecisionText = L10n.string("decision.copy_locked")
            refresh()
            return false
        }

        clipboardWriter.write(credential.username, clearAfter: nil)
        lastDecisionText = L10n.format("decision.copied_username", credential.label)
        return true
    }

    @discardableResult
    func copyPassword(_ credential: CompanionLocalCredentialRow) async -> Bool {
        guard isUnlocked else {
            lastDecisionText = L10n.string("decision.copy_locked")
            refresh()
            return false
        }

        guard await authorizeLocalUserPresence(
            reason: L10n.string("local_auth.copy_password_reason")
        ) else {
            return false
        }

        guard let vaultStore else {
            lastDecisionText = L10n.string("decision.vault_unavailable")
            return false
        }

        do {
            let credentials = try vaultStore.loadCredentials()

            guard let storedCredential = credentials.first(where: { storedCredential in
                storedCredential.id == credential.id
            }) else {
                lastDecisionText = L10n.string("decision.copy_missing")
                refresh()
                return false
            }

            clipboardWriter.write(
                storedCredential.password,
                clearAfter: clipboardClearDelay
            )
            lastDecisionText = L10n.format("decision.copied_password", credential.label)
            refresh()
            return true
        } catch {
            lastDecisionText = L10n.string("decision.copy_failed")
            refresh()
            return false
        }
    }

    @discardableResult
    func confirmDeleteLocalCredential() async -> Bool {
        guard isUnlocked else {
            pendingDeleteCredential = nil
            lastDecisionText = L10n.string("decision.delete_locked")
            refresh()
            return false
        }

        guard let credential = pendingDeleteCredential else {
            lastDecisionText = L10n.string("decision.delete_missing")
            return false
        }

        guard await authorizeLocalUserPresence(
            reason: L10n.string("local_auth.delete_reason")
        ) else {
            return false
        }

        guard let vaultStore else {
            lastDecisionText = L10n.string("decision.vault_unavailable")
            return false
        }

        do {
            let credentials = try vaultStore.loadCredentials()
            let nextCredentials = credentials.filter { storedCredential in
                storedCredential.id != credential.id
            }

            guard nextCredentials.count != credentials.count else {
                pendingDeleteCredential = nil
                lastDecisionText = L10n.string("decision.delete_missing")
                refresh()
                return false
            }

            try vaultStore.save(credentials: nextCredentials)
            session.unlock(credentials: nextCredentials, ttl: 300)
            bridgeService.clearPendingApproval()
            pendingApproval = nil
            pendingDeleteCredential = nil
            lastDecisionText = L10n.format("decision.deleted", credential.label)
            refresh()
            return true
        } catch {
            lastDecisionText = L10n.string("decision.delete_failed")
            refresh()
            return false
        }
    }

    func pairIPhone() {
        guard isUnlocked else {
            pairingInviteText = nil
            pairingPayload = nil
            lastDecisionText = L10n.string("decision.pairing_locked")
            return
        }

        do {
            let payload = try pairingCoordinator.startSession(
                sourceDeviceId: pairingSourceDeviceId,
                sourceDeviceDisplayName: pairingSourceDeviceDisplayName
            )
            pairingInviteText = try makePairingInviteText(pairing: payload)
            pairingPayload = payload
            lastDecisionText = L10n.string("decision.pairing_ready")
        } catch {
            pairingInviteText = nil
            pairingPayload = nil
            lastDecisionText = L10n.string("decision.pairing_locked")
        }
    }

    private func makePairingInviteText(
        pairing: CompanionPairingQRCodePayload
    ) throws -> String {
        let invite = try CompanionPairingInviteBuilder().makeInvite(
            pairing: pairing,
            macBaseURL: pairingBaseURL
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(invite)
        return String(data: data, encoding: .utf8) ?? ""
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
        guard isUnlocked else {
            savedCredentialRows = []
            return
        }

        guard let credentials = try? vaultStore?.loadCredentials() else {
            savedCredentialCountText = L10n.string("status.unavailable")
            savedCredentialRows = []
            return
        }

        savedCredentialRows = credentials.map(CompanionLocalCredentialRow.init)
        savedCredentialCountText = L10n.format("status.saved_count", credentials.count)
    }
}
