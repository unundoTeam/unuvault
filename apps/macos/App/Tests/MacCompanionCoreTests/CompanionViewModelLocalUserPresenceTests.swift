import Foundation
import XCTest
@testable import MacCompanionCore
@testable import UnuVaultMacCompanion

@MainActor
final class CompanionViewModelLocalUserPresenceTests: XCTestCase {
    func testAllowAuthorizationUnlocksLocalVault() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential(), Self.bankCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .authorized
            )
        )

        await viewModel.unlockLocalVault()

        XCTAssertTrue(store.didLoadCredentials)
        XCTAssertTrue(viewModel.isUnlocked)
        XCTAssertEqual(viewModel.lastDecisionText, L10n.string("decision.unlocked"))
        XCTAssertEqual(
            viewModel.savedCredentialRows.map(\.label),
            ["github.com", "bank.example"]
        )
    }

    func testDeniedAuthorizationDoesNotReadVaultOrUnlock() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .denied
            )
        )

        await viewModel.unlockLocalVault()

        XCTAssertFalse(store.didLoadCredentials)
        XCTAssertFalse(viewModel.isUnlocked)
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.string("decision.local_auth_failed")
        )
    }

    func testUnavailableAuthorizationDoesNotReadVaultOrUnlock() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .unavailable
            )
        )

        await viewModel.unlockLocalVault()

        XCTAssertFalse(store.didLoadCredentials)
        XCTAssertFalse(viewModel.isUnlocked)
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.string("decision.local_auth_unavailable")
        )
    }

    func testAllowedAuthorizationSavesLocalCredential() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .authorized
            )
        )
        fillBankDraft(in: viewModel)

        let didSave = await viewModel.saveLocalCredential()

        XCTAssertTrue(didSave)
        XCTAssertTrue(store.didLoadCredentials)
        XCTAssertTrue(store.didSaveCredentials)
        XCTAssertEqual(store.savedCredentials?.map(\.label), ["github.com", "bank.example"])
        XCTAssertFalse(viewModel.isUnlocked)
        XCTAssertEqual(viewModel.lastDecisionText, L10n.format("decision.saved", "bank.example"))
    }

    func testDeniedAuthorizationDoesNotReadVaultOrSaveCredential() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .denied
            )
        )
        fillBankDraft(in: viewModel)

        let didSave = await viewModel.saveLocalCredential()

        XCTAssertFalse(didSave)
        XCTAssertFalse(store.didLoadCredentials)
        XCTAssertFalse(store.didSaveCredentials)
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.string("decision.local_auth_failed")
        )
    }

    func testUnavailableAuthorizationDoesNotReadVaultOrSaveCredential() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .unavailable
            )
        )
        fillBankDraft(in: viewModel)

        let didSave = await viewModel.saveLocalCredential()

        XCTAssertFalse(didSave)
        XCTAssertFalse(store.didLoadCredentials)
        XCTAssertFalse(store.didSaveCredentials)
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.string("decision.local_auth_unavailable")
        )
    }

    func testRefreshDoesNotReadVaultWhileLocked() {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .authorized
            )
        )

        viewModel.refresh()

        XCTAssertFalse(store.didLoadCredentials)
        XCTAssertFalse(viewModel.isUnlocked)
        XCTAssertEqual(viewModel.savedCredentialRows, [])
    }

    func testSearchFiltersSavedCredentialRowsBySiteAndUsername() async {
        let store = RecordingCompanionVaultStore(
            credentials: [
                Self.githubCredential(),
                Self.bankCredential(),
                Self.appleCredential()
            ]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .authorized
            )
        )

        await viewModel.unlockLocalVault()
        viewModel.searchText = "finance"

        XCTAssertEqual(viewModel.filteredCredentialRows.map(\.label), ["bank.example"])

        viewModel.searchText = "icloud"

        XCTAssertEqual(viewModel.filteredCredentialRows.map(\.label), ["apple.com"])
    }

    func testShowEditLoginPrefillsExistingLocalCredential() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential(), Self.bankCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .authorized
            )
        )
        await viewModel.unlockLocalVault()

        let didOpenEdit = viewModel.showEditLogin(viewModel.savedCredentialRows[1])

        XCTAssertTrue(didOpenEdit)
        XCTAssertEqual(viewModel.route, .editLogin)
        XCTAssertEqual(viewModel.credentialOrigin, "https://bank.example")
        XCTAssertEqual(viewModel.credentialLabel, "bank.example")
        XCTAssertEqual(viewModel.credentialUsername, "finance@yuchen.dev")
        XCTAssertEqual(viewModel.credentialPassword, "bank-password")
    }

    func testAllowedAuthorizationEditsLocalCredentialAndRefreshesUnlockedRows() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential(), Self.bankCredential()]
        )
        let authorizer = SequencedLocalUserPresenceAuthorizer(
            results: [.authorized, .authorized]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: authorizer
        )
        await viewModel.unlockLocalVault()

        XCTAssertTrue(viewModel.showEditLogin(viewModel.savedCredentialRows[1]))
        viewModel.credentialOrigin = "https://bank.example/login"
        viewModel.credentialLabel = "Bank Primary"
        viewModel.credentialUsername = "primary@yuchen.dev"
        viewModel.credentialPassword = "updated-bank-password"
        let didEdit = await viewModel.saveLocalCredential()

        XCTAssertTrue(didEdit)
        XCTAssertEqual(authorizer.authorizationReasons, [
            L10n.string("local_auth.unlock_reason"),
            L10n.string("local_auth.edit_reason")
        ])
        XCTAssertTrue(store.didSaveCredentials)
        XCTAssertEqual(store.loadResult().map(\.id), ["github-login", "bank-login"])
        XCTAssertEqual(store.loadResult().map(\.label), ["github.com", "Bank Primary"])
        XCTAssertEqual(store.loadResult()[1].username, "primary@yuchen.dev")
        XCTAssertEqual(store.loadResult()[1].password, "updated-bank-password")
        XCTAssertEqual(store.loadResult()[1].websiteOrigin, "https://bank.example/login")
        XCTAssertEqual(viewModel.savedCredentialRows.map(\.label), ["github.com", "Bank Primary"])
        XCTAssertEqual(viewModel.route, .overview)
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.format("decision.edited", "Bank Primary")
        )
    }

    func testDeniedAuthorizationDoesNotEditLocalCredential() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential(), Self.bankCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: SequencedLocalUserPresenceAuthorizer(
                results: [.authorized, .denied]
            )
        )
        await viewModel.unlockLocalVault()

        XCTAssertTrue(viewModel.showEditLogin(viewModel.savedCredentialRows[1]))
        viewModel.credentialLabel = "Bank Primary"
        viewModel.credentialPassword = "updated-bank-password"
        let didEdit = await viewModel.saveLocalCredential()

        XCTAssertFalse(didEdit)
        XCTAssertFalse(store.didSaveCredentials)
        XCTAssertEqual(store.loadResult().map(\.label), ["github.com", "bank.example"])
        XCTAssertEqual(store.loadResult()[1].password, "bank-password")
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.string("decision.local_auth_failed")
        )
    }

    func testCancelEditClearsSensitiveCredentialDraft() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential(), Self.bankCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .authorized
            )
        )
        await viewModel.unlockLocalVault()
        XCTAssertTrue(viewModel.showEditLogin(viewModel.savedCredentialRows[1]))

        viewModel.cancelAddLogin()

        XCTAssertEqual(viewModel.route, .overview)
        XCTAssertEqual(viewModel.credentialOrigin, "")
        XCTAssertEqual(viewModel.credentialLabel, "")
        XCTAssertEqual(viewModel.credentialUsername, "")
        XCTAssertEqual(viewModel.credentialPassword, "")
    }

    func testLockedVaultDoesNotOpenEditLocalCredential() {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .authorized
            )
        )

        let didOpenEdit = viewModel.showEditLogin(
            CompanionLocalCredentialRow(Self.githubCredential())
        )

        XCTAssertFalse(didOpenEdit)
        XCTAssertFalse(store.didLoadCredentials)
        XCTAssertEqual(viewModel.route, .overview)
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.string("decision.edit_locked")
        )
    }

    func testMissingLocalCredentialDoesNotOpenEdit() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .authorized
            )
        )
        await viewModel.unlockLocalVault()

        let didOpenEdit = viewModel.showEditLogin(
            CompanionLocalCredentialRow(Self.bankCredential())
        )

        XCTAssertFalse(didOpenEdit)
        XCTAssertEqual(viewModel.route, .overview)
        XCTAssertEqual(viewModel.credentialOrigin, "")
        XCTAssertEqual(viewModel.credentialLabel, "")
        XCTAssertEqual(viewModel.credentialUsername, "")
        XCTAssertEqual(viewModel.credentialPassword, "")
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.string("decision.edit_missing")
        )
    }

    func testCopyUsernameWritesVisibleUsernameWithoutAuthorization() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential()]
        )
        let authorizer = SequencedLocalUserPresenceAuthorizer(
            results: [.authorized, .denied]
        )
        let clipboard = RecordingClipboardWriter()
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: authorizer,
            clipboardWriter: clipboard
        )
        await viewModel.unlockLocalVault()

        let didCopy = viewModel.copyUsername(viewModel.savedCredentialRows[0])

        XCTAssertTrue(didCopy)
        XCTAssertEqual(authorizer.authorizationReasons.count, 1)
        XCTAssertEqual(clipboard.writes, [
            .init(string: "yuchen", clearAfter: nil)
        ])
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.format("decision.copied_username", "github.com")
        )
    }

    func testCopyPasswordRequiresAuthorizationAndWritesWithClipboardClear() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential(), Self.bankCredential()]
        )
        let authorizer = SequencedLocalUserPresenceAuthorizer(
            results: [.authorized, .authorized]
        )
        let clipboard = RecordingClipboardWriter()
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: authorizer,
            clipboardWriter: clipboard,
            clipboardClearDelay: 45
        )
        await viewModel.unlockLocalVault()

        let didCopy = await viewModel.copyPassword(viewModel.savedCredentialRows[1])

        XCTAssertTrue(didCopy)
        XCTAssertEqual(authorizer.authorizationReasons, [
            L10n.string("local_auth.unlock_reason"),
            L10n.string("local_auth.copy_password_reason")
        ])
        XCTAssertEqual(clipboard.writes, [
            .init(string: "bank-password", clearAfter: 45)
        ])
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.format("decision.copied_password", "bank.example")
        )
    }

    func testDeniedAuthorizationDoesNotCopyPassword() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential(), Self.bankCredential()]
        )
        let clipboard = RecordingClipboardWriter()
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: SequencedLocalUserPresenceAuthorizer(
                results: [.authorized, .denied]
            ),
            clipboardWriter: clipboard
        )
        await viewModel.unlockLocalVault()

        let didCopy = await viewModel.copyPassword(viewModel.savedCredentialRows[1])

        XCTAssertFalse(didCopy)
        XCTAssertEqual(clipboard.writes, [])
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.string("decision.local_auth_failed")
        )
    }

    func testLockedVaultDoesNotCopyLocalCredential() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential()]
        )
        let clipboard = RecordingClipboardWriter()
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .authorized
            ),
            clipboardWriter: clipboard
        )

        let didCopyUsername = viewModel.copyUsername(
            CompanionLocalCredentialRow(Self.githubCredential())
        )
        let didCopyPassword = await viewModel.copyPassword(
            CompanionLocalCredentialRow(Self.githubCredential())
        )

        XCTAssertFalse(didCopyUsername)
        XCTAssertFalse(didCopyPassword)
        XCTAssertEqual(clipboard.writes, [])
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.string("decision.copy_locked")
        )
    }

    func testDeniedAuthorizationDoesNotDeleteLocalCredential() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential(), Self.bankCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: SequencedLocalUserPresenceAuthorizer(
                results: [.authorized, .denied]
            )
        )
        await viewModel.unlockLocalVault()

        viewModel.requestDeleteLocalCredential(viewModel.savedCredentialRows[1])
        let didDelete = await viewModel.confirmDeleteLocalCredential()

        XCTAssertFalse(didDelete)
        XCTAssertFalse(store.didSaveCredentials)
        XCTAssertEqual(store.loadResult().map(\.label), ["github.com", "bank.example"])
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.string("decision.local_auth_failed")
        )
    }

    func testAllowedAuthorizationDeletesLocalCredentialAndRefreshesUnlockedRows() async {
        let store = RecordingCompanionVaultStore(
            credentials: [Self.githubCredential(), Self.bankCredential()]
        )
        let viewModel = CompanionViewModel(
            vaultStore: store,
            localUserPresenceAuthorizer: StaticLocalUserPresenceAuthorizer(
                result: .authorized
            )
        )
        await viewModel.unlockLocalVault()

        viewModel.requestDeleteLocalCredential(viewModel.savedCredentialRows[1])
        let didDelete = await viewModel.confirmDeleteLocalCredential()

        XCTAssertTrue(didDelete)
        XCTAssertTrue(store.didSaveCredentials)
        XCTAssertEqual(store.loadResult().map(\.label), ["github.com"])
        XCTAssertEqual(viewModel.savedCredentialRows.map(\.label), ["github.com"])
        XCTAssertNil(viewModel.pendingDeleteCredential)
        XCTAssertEqual(
            viewModel.lastDecisionText,
            L10n.format("decision.deleted", "bank.example")
        )
    }

    private static func githubCredential() -> CompanionCredential {
        CompanionCredential(
            id: "github-login",
            label: "github.com",
            username: "yuchen",
            password: "secret-github",
            profileId: "personal",
            websiteOrigin: "https://github.com"
        )
    }

    private static func bankCredential() -> CompanionCredential {
        CompanionCredential(
            id: "bank-login",
            label: "bank.example",
            username: "finance@yuchen.dev",
            password: "bank-password",
            profileId: "personal",
            websiteOrigin: "https://bank.example"
        )
    }

    private static func appleCredential() -> CompanionCredential {
        CompanionCredential(
            id: "apple-login",
            label: "apple.com",
            username: "yuchen@icloud.com",
            password: "apple-password",
            profileId: "personal",
            websiteOrigin: "https://apple.com"
        )
    }

    private func fillBankDraft(in viewModel: CompanionViewModel) {
        viewModel.credentialOrigin = "https://bank.example"
        viewModel.credentialLabel = "bank.example"
        viewModel.credentialUsername = "finance@yuchen.dev"
        viewModel.credentialPassword = "bank-password"
    }
}

private final class RecordingCompanionVaultStore: CompanionVaultStoring {
    private let credentials: [CompanionCredential]
    private(set) var didLoadCredentials = false
    private(set) var didSaveCredentials = false
    private(set) var savedCredentials: [CompanionCredential]?

    init(credentials: [CompanionCredential]) {
        self.credentials = credentials
    }

    func save(credentials: [CompanionCredential]) throws {
        didSaveCredentials = true
        savedCredentials = credentials
    }

    func loadCredentials() throws -> [CompanionCredential] {
        didLoadCredentials = true
        return loadResult()
    }

    func loadResult() -> [CompanionCredential] {
        savedCredentials ?? credentials
    }
}

private final class SequencedLocalUserPresenceAuthorizer:
    LocalUserPresenceAuthorizing
{
    private var results: [LocalUserPresenceAuthorizationResult]
    private(set) var authorizationReasons: [String] = []

    init(results: [LocalUserPresenceAuthorizationResult]) {
        self.results = results
    }

    func authorize(reason: String) async -> LocalUserPresenceAuthorizationResult {
        authorizationReasons.append(reason)

        guard !results.isEmpty else {
            return .denied
        }

        return results.removeFirst()
    }
}

private final class RecordingClipboardWriter: CompanionClipboardWriting {
    struct Write: Equatable {
        let string: String
        let clearAfter: TimeInterval?
    }

    private(set) var writes: [Write] = []

    func write(_ string: String, clearAfter: TimeInterval?) {
        writes.append(.init(string: string, clearAfter: clearAfter))
    }
}
