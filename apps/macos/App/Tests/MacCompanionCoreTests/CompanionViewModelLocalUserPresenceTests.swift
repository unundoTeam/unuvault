import Foundation
import XCTest
@testable import MacCompanionCore
@testable import UnuVaultMacCompanion

@MainActor
final class CompanionViewModelLocalUserPresenceTests: XCTestCase {
    func testAllowAuthorizationUnlocksLocalVault() async {
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

        XCTAssertTrue(store.didLoadCredentials)
        XCTAssertTrue(viewModel.isUnlocked)
        XCTAssertEqual(viewModel.lastDecisionText, L10n.string("decision.unlocked"))
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
        return credentials
    }
}
