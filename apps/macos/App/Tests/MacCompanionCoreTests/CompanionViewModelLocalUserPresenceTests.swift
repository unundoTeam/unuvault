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

    init(results: [LocalUserPresenceAuthorizationResult]) {
        self.results = results
    }

    func authorize(reason _: String) async -> LocalUserPresenceAuthorizationResult {
        guard !results.isEmpty else {
            return .denied
        }

        return results.removeFirst()
    }
}
