import Combine
import XCTest
import UIKit
@testable import App

@MainActor
final class IOSProductCompositionTests: XCTestCase {
    func testPairingDeepLinkDecodesAcceptedBase64URLInvite() throws {
        let inviteText = try inviteJSON(makeInvite())
        let url = makePairingDeepLink(inviteText: inviteText)

        XCTAssertEqual(IOSPairingDeepLink.inviteText(from: url), inviteText)
    }

    func testPairingDeepLinkRejectsWrongSchemeAndHost() {
        let encodedInvite = Data("invite".utf8).base64URLEncodedString()

        XCTAssertNil(
            IOSPairingDeepLink.inviteText(
                from: URL(string: "https://pair?invite=\(encodedInvite)")!
            )
        )
        XCTAssertNil(
            IOSPairingDeepLink.inviteText(
                from: URL(string: "unuvault-ioshost://other?invite=\(encodedInvite)")!
            )
        )
    }

    func testPairingDeepLinkRejectsMissingInvite() {
        XCTAssertNil(
            IOSPairingDeepLink.inviteText(
                from: URL(string: "unuvault-ioshost://pair")!
            )
        )
    }

    func testPairingDeepLinkRejectsNonExactURLShapes() {
        let encodedInvite = Data("invite".utf8).base64URLEncodedString()
        let rejectedURLs = [
            "unuvault-ioshost://user@pair?invite=\(encodedInvite)",
            "unuvault-ioshost://user:password@pair?invite=\(encodedInvite)",
            "unuvault-ioshost://pair:443?invite=\(encodedInvite)",
            "unuvault-ioshost://pair/?invite=\(encodedInvite)",
            "unuvault-ioshost://pair/path?invite=\(encodedInvite)",
            "unuvault-ioshost://pair?invite=\(encodedInvite)#fragment",
        ]

        for rejectedURL in rejectedURLs {
            XCTAssertNil(
                IOSPairingDeepLink.inviteText(from: URL(string: rejectedURL)!),
                rejectedURL
            )
        }
    }

    func testPairingDeepLinkRequiresExactlyOneNonEmptyInviteQueryItem() {
        let encodedInvite = Data("invite".utf8).base64URLEncodedString()
        let rejectedURLs = [
            "unuvault-ioshost://pair?invite",
            "unuvault-ioshost://pair?invite=",
            "unuvault-ioshost://pair?invite=\(encodedInvite)&extra=value",
            "unuvault-ioshost://pair?invite=\(encodedInvite)&invite=\(encodedInvite)",
        ]

        for rejectedURL in rejectedURLs {
            XCTAssertNil(
                IOSPairingDeepLink.inviteText(from: URL(string: rejectedURL)!),
                rejectedURL
            )
        }
    }

    func testPairingDeepLinkRejectsInvalidBase64URL() {
        XCTAssertNil(
            IOSPairingDeepLink.inviteText(
                from: URL(string: "unuvault-ioshost://pair?invite=not*base64url")!
            )
        )
    }

    func testPairingDeepLinkRejectsNonUTF8Invite() {
        let encodedInvite = Data([0xFF, 0xFE]).base64URLEncodedString()

        XCTAssertNil(
            IOSPairingDeepLink.inviteText(
                from: URL(string: "unuvault-ioshost://pair?invite=\(encodedInvite)")!
            )
        )
    }

    func testPairingDeepLinkRejectsNonCanonicalBase64URLPadBits() {
        XCTAssertEqual(
            IOSPairingDeepLink.inviteText(
                from: URL(string: "unuvault-ioshost://pair?invite=Zg")!
            ),
            "f"
        )
        XCTAssertNil(
            IOSPairingDeepLink.inviteText(
                from: URL(string: "unuvault-ioshost://pair?invite=Zh")!
            )
        )
    }

    func testAcceptedPairingDeepLinkSelectsPairingAndParsesOnce() throws {
        let compositionViewModel = IOSProductCompositionViewModel(
            initialDestination: .vault
        )
        let pairingViewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) }
        )
        var stateTransitions: [PairingInviteFlowState] = []
        let cancellable = pairingViewModel.$state
            .dropFirst()
            .sink { stateTransitions.append($0) }
        let url = makePairingDeepLink(inviteText: try inviteJSON(makeInvite()))

        let inviteText = try XCTUnwrap(IOSPairingDeepLink.inviteText(from: url))
        compositionViewModel.acceptDeepLinkInvite(
            inviteText,
            into: pairingViewModel
        )

        XCTAssertEqual(compositionViewModel.selectedDestination, .pairing)
        XCTAssertEqual(pairingViewModel.state, .ready)
        XCTAssertEqual(stateTransitions, [.ready])
        withExtendedLifetime(cancellable) {}
    }

    func testPhysicalPairingAttemptIgnoresSecondInviteUntilTerminalReset() {
        var attempt = IOSPhysicalPairingAttemptPolicy()

        XCTAssertTrue(attempt.begin(inviteText: "first-invite"))
        XCTAssertEqual(attempt.pendingInviteText, "first-invite")
        XCTAssertTrue(attempt.isActive)
        XCTAssertFalse(attempt.begin(inviteText: "second-invite"))

        XCTAssertTrue(attempt.markForwarded(parserState: .ready))
        XCTAssertNil(attempt.pendingInviteText)
        XCTAssertTrue(attempt.isActive)
        XCTAssertFalse(attempt.markForwarded(parserState: .ready))
        XCTAssertFalse(attempt.begin(inviteText: "second-invite"))

        attempt.finish()

        XCTAssertFalse(attempt.isActive)
        XCTAssertTrue(attempt.begin(inviteText: "fresh-invite"))
        XCTAssertEqual(attempt.pendingInviteText, "fresh-invite")
    }

    func testPhysicalPairingAttemptReleasesInvalidParsedInvite() {
        var attempt = IOSPhysicalPairingAttemptPolicy()

        XCTAssertTrue(attempt.begin(inviteText: "invalid-invite"))
        XCTAssertFalse(attempt.markForwarded(parserState: .invalid))

        XCTAssertFalse(attempt.isActive)
        XCTAssertNil(attempt.pendingInviteText)
        XCTAssertTrue(attempt.begin(inviteText: "fresh-invite"))
    }

    func testPromotedCompositionUIContractUsesExactRolesAndSafeCopy() {
        XCTAssertEqual(IOSProductCompositionUIContract.vault.title, "Vault")
        XCTAssertEqual(IOSProductCompositionUIContract.vault.systemImage, "lock.fill")
        XCTAssertEqual(IOSProductCompositionUIContract.pairing.title, "Pairing")
        XCTAssertEqual(IOSProductCompositionUIContract.pairing.systemImage, "link")
        XCTAssertEqual(
            IOSProductCompositionUIContract.loadingTitle,
            "Loading received vault…"
        )
        XCTAssertEqual(
            IOSProductCompositionUIContract.loadFailureTitle,
            "Vault metadata unavailable"
        )
        XCTAssertEqual(IOSProductCompositionUIContract.retryTitle, "Retry")
        XCTAssertEqual(
            IOSProductCompositionUIContract.postImportReloadFailure,
            "Imported, but the received vault could not be reloaded."
        )

        let visibleCopy = [
            IOSProductCompositionUIContract.loadingTitle,
            IOSProductCompositionUIContract.loadFailureTitle,
            IOSProductCompositionUIContract.loadFailureBody,
            IOSProductCompositionUIContract.postImportReloadFailure,
            IOSProductCompositionUIContract.postImportReloadRecovery,
        ].joined(separator: " ").lowercased()
        XCTAssertFalse(visibleCopy.contains("password"))
        XCTAssertFalse(visibleCopy.contains("secret"))
        XCTAssertFalse(visibleCopy.contains("invite"))
    }

    func testPromotedCompositionUIContractHasAccessibleActionsAndSelectedState() {
        XCTAssertGreaterThanOrEqual(
            IOSProductCompositionUIContract.minimumActionHeight,
            44
        )

        let selectedVault = IOSProductCompositionUIContract.vault.accessibility(
            isSelected: true
        )
        let unselectedVault = IOSProductCompositionUIContract.vault.accessibility(
            isSelected: false
        )
        let selectedPairing = IOSProductCompositionUIContract.pairing.accessibility(
            isSelected: true
        )

        XCTAssertEqual(selectedVault.label, "Vault")
        XCTAssertEqual(selectedVault.value, "Selected")
        XCTAssertEqual(unselectedVault.label, "Vault")
        XCTAssertEqual(unselectedVault.value, "Not selected")
        XCTAssertEqual(selectedPairing.label, "Pairing")
        XCTAssertEqual(selectedPairing.value, "Selected")
        XCTAssertNotEqual(selectedVault.value, unselectedVault.value)
    }

    func testDestinationPresentationChangesSymbolAndEmphasisWithSelection() {
        let selectedVault = IOSProductCompositionUIContract.vault.presentation(
            isSelected: true
        )
        let unselectedVault = IOSProductCompositionUIContract.vault.presentation(
            isSelected: false
        )
        let selectedPairing = IOSProductCompositionUIContract.pairing.presentation(
            isSelected: true
        )
        let unselectedPairing = IOSProductCompositionUIContract.pairing.presentation(
            isSelected: false
        )

        XCTAssertEqual(selectedVault.systemImage, "lock.fill")
        XCTAssertEqual(unselectedVault.systemImage, "lock")
        XCTAssertEqual(selectedPairing.systemImage, "link.circle.fill")
        XCTAssertEqual(unselectedPairing.systemImage, "link")
        XCTAssertEqual(selectedVault.emphasis, .selected)
        XCTAssertEqual(unselectedVault.emphasis, .unselected)
        XCTAssertNotEqual(selectedVault, unselectedVault)
        XCTAssertNotEqual(selectedPairing, unselectedPairing)
    }

    func testImmediateStartupFailurePublishesLoadingAndOneSafeFailureEvent() async {
        let loader = QueuedReceivedVaultLoader([.failure(SecretBearingLoadError())])
        let viewModel = IOSProductCompositionViewModel(receivedVaultLoader: loader.load)
        var events: [IOSProductCompositionAccessibilityAnnouncement] = []
        let cancellable = viewModel.$accessibilityAnnouncement
            .compactMap { $0 }
            .sink { events.append($0) }
        let loadingAnnouncement = [
            IOSProductCompositionUIContract.loadingTitle,
            IOSProductCompositionUIContract.loadingBody,
        ].joined(separator: " ")
        let failureAnnouncement = [
            IOSProductCompositionUIContract.loadFailureTitle,
            IOSProductCompositionUIContract.loadFailureBody,
        ].joined(separator: " ")

        await viewModel.start()

        XCTAssertEqual(
            events.map(\.message),
            [loadingAnnouncement, failureAnnouncement]
        )
        XCTAssertEqual(events.map(\.sequence), [1, 2])
        XCTAssertFalse(
            events.map(\.message).joined().localizedCaseInsensitiveContains("error")
        )
        XCTAssertFalse(events.map(\.message).joined().contains("secret-store-bytes"))
        withExtendedLifetime(cancellable) {}
    }

    func testSuspendedPostImportFailurePublishesOnlyOnePostImportEvent() async {
        let loader = QueuedReceivedVaultLoader([.suspended])
        let viewModel = IOSProductCompositionViewModel(receivedVaultLoader: loader.load)
        var events: [IOSProductCompositionAccessibilityAnnouncement] = []
        let cancellable = viewModel.$accessibilityAnnouncement
            .compactMap { $0 }
            .sink { events.append($0) }
        let expectedAnnouncement = [
            IOSProductCompositionUIContract.postImportReloadFailure,
            IOSProductCompositionUIContract.postImportReloadRecovery,
        ].joined(separator: " ")

        let reloadTask = Task { await viewModel.reloadAfterImport(makeReceipt()) }
        await waitForCallCount(1, loader: loader)
        XCTAssertTrue(events.isEmpty)

        loader.resumeNext(with: .failure(SecretBearingLoadError()))
        await reloadTask.value

        XCTAssertEqual(events.map(\.message), [expectedAnnouncement])
        XCTAssertEqual(events.map(\.sequence), [1])
        XCTAssertFalse(events.map(\.message).joined().contains("secret-store-bytes"))
        withExtendedLifetime(cancellable) {}
    }

    func testConsecutivePostImportRetryFailuresPublishANewEventEveryTime() async {
        let loader = QueuedReceivedVaultLoader([
            .failure(SecretBearingLoadError()),
            .failure(SecretBearingLoadError()),
            .failure(SecretBearingLoadError()),
        ])
        let viewModel = IOSProductCompositionViewModel(receivedVaultLoader: loader.load)
        var events: [IOSProductCompositionAccessibilityAnnouncement] = []
        let cancellable = viewModel.$accessibilityAnnouncement
            .compactMap { $0 }
            .sink { events.append($0) }
        let expectedAnnouncement = [
            IOSProductCompositionUIContract.postImportReloadFailure,
            IOSProductCompositionUIContract.postImportReloadRecovery,
        ].joined(separator: " ")

        await viewModel.reloadAfterImport(makeReceipt())
        await viewModel.retryPostImportReload()
        await viewModel.retryPostImportReload()

        XCTAssertEqual(events.map(\.sequence), [1, 2, 3])
        XCTAssertEqual(
            events.map(\.message),
            Array(repeating: expectedAnnouncement, count: 3)
        )
        XCTAssertTrue(viewModel.postImportReloadFailed)
        withExtendedLifetime(cancellable) {}
    }

    func testPairButtonUsesReadableSemanticColorPairsInLightAndDarkModes() {
        let enabled = PairingInviteUIContract.pairButtonPresentation(isEnabled: true)
        let disabled = PairingInviteUIContract.pairButtonPresentation(isEnabled: false)

        XCTAssertEqual(enabled.foreground, .inverseForeground)
        XCTAssertEqual(enabled.background, .inverseBackground)
        XCTAssertEqual(disabled.foreground, .disabledForeground)
        XCTAssertEqual(disabled.background, .disabledBackground)
        XCTAssertNotEqual(enabled, disabled)

        for style in [UIUserInterfaceStyle.light, .dark] {
            let traits = UITraitCollection(userInterfaceStyle: style)
            XCTAssertGreaterThanOrEqual(
                contrastRatio(
                    enabled.foreground.uiColor.resolvedColor(with: traits),
                    enabled.background.uiColor.resolvedColor(with: traits)
                ),
                4.5
            )
            XCTAssertGreaterThanOrEqual(
                contrastRatio(
                    disabled.foreground.uiColor.resolvedColor(with: traits),
                    disabled.background.uiColor.resolvedColor(with: traits)
                ),
                4.5
            )
        }
    }

    func testStartPublishesLoadingThenSelectsVaultForReceivedMetadata() async throws {
        let model = makeVaultModel()
        let loader = QueuedReceivedVaultLoader([.suspended])
        let viewModel = IOSProductCompositionViewModel(receivedVaultLoader: loader.load)

        let startTask = Task { await viewModel.start() }
        await waitForCallCount(1, loader: loader)

        XCTAssertEqual(viewModel.receivedVaultState, .loading)
        XCTAssertEqual(viewModel.selectedDestination, .pairing)

        loader.resumeNext(with: .success(model))
        await startTask.value

        XCTAssertEqual(viewModel.receivedVaultState, .available(model))
        XCTAssertEqual(viewModel.selectedDestination, .vault)
        XCTAssertFalse(viewModel.postImportReloadFailed)
    }

    func testStartWithEmptyVaultSelectsPairing() async {
        let loader = QueuedReceivedVaultLoader([.success(VaultListModel())])
        let viewModel = IOSProductCompositionViewModel(
            receivedVaultLoader: loader.load,
            initialDestination: .vault
        )

        await viewModel.start()

        XCTAssertEqual(viewModel.receivedVaultState, .empty)
        XCTAssertEqual(viewModel.selectedDestination, .pairing)
        XCTAssertFalse(viewModel.postImportReloadFailed)
    }

    func testStartFailureIsSafeAndSelectsPairing() async {
        let loader = QueuedReceivedVaultLoader([.failure(SecretBearingLoadError())])
        let viewModel = IOSProductCompositionViewModel(
            receivedVaultLoader: loader.load,
            initialDestination: .vault
        )

        await viewModel.start()

        XCTAssertEqual(viewModel.receivedVaultState, .failed)
        XCTAssertEqual(viewModel.selectedDestination, .pairing)
        XCTAssertFalse(viewModel.postImportReloadFailed)
        XCTAssertFalse(String(describing: viewModel.receivedVaultState).contains("secret-store-bytes"))
    }

    func testReloadAfterImportDoesNotSelectVaultBeforeFreshLoadResumes() async throws {
        let model = makeVaultModel()
        let loader = QueuedReceivedVaultLoader([.suspended])
        let viewModel = IOSProductCompositionViewModel(receivedVaultLoader: loader.load)

        let reloadTask = Task { await viewModel.reloadAfterImport(makeReceipt()) }
        await waitForCallCount(1, loader: loader)

        XCTAssertEqual(viewModel.receivedVaultState, .loading)
        XCTAssertEqual(viewModel.selectedDestination, .pairing)

        loader.resumeNext(with: .success(model))
        await reloadTask.value

        XCTAssertEqual(viewModel.receivedVaultState, .available(model))
        XCTAssertEqual(viewModel.selectedDestination, .vault)
        XCTAssertFalse(viewModel.postImportReloadFailed)
    }

    func testSuccessfulPostImportReloadClearsPriorFailure() async {
        let model = makeVaultModel()
        let loader = QueuedReceivedVaultLoader([
            .failure(SecretBearingLoadError()),
            .success(model),
        ])
        let viewModel = IOSProductCompositionViewModel(receivedVaultLoader: loader.load)

        await viewModel.reloadAfterImport(makeReceipt())
        XCTAssertTrue(viewModel.postImportReloadFailed)

        await viewModel.retryPostImportReload()

        XCTAssertEqual(viewModel.receivedVaultState, .available(model))
        XCTAssertEqual(viewModel.selectedDestination, .vault)
        XCTAssertFalse(viewModel.postImportReloadFailed)
    }

    func testThrownPostImportReloadStaysOnPairingAndPublishesSafeFailure() async {
        let loader = QueuedReceivedVaultLoader([.failure(SecretBearingLoadError())])
        let viewModel = IOSProductCompositionViewModel(
            receivedVaultLoader: loader.load,
            initialDestination: .pairing
        )

        await viewModel.reloadAfterImport(makeReceipt())

        XCTAssertEqual(viewModel.receivedVaultState, .failed)
        XCTAssertEqual(viewModel.selectedDestination, .pairing)
        XCTAssertTrue(viewModel.postImportReloadFailed)
        XCTAssertFalse(String(describing: viewModel.receivedVaultState).contains("secret-store-bytes"))
    }

    func testEmptyPostImportReloadStaysOnPairingAndPublishesFailureFlag() async {
        let loader = QueuedReceivedVaultLoader([.success(VaultListModel())])
        let viewModel = IOSProductCompositionViewModel(receivedVaultLoader: loader.load)

        await viewModel.reloadAfterImport(makeReceipt())

        XCTAssertEqual(viewModel.receivedVaultState, .empty)
        XCTAssertEqual(viewModel.selectedDestination, .pairing)
        XCTAssertTrue(viewModel.postImportReloadFailed)
    }

    func testRetryIsSingleFlightAndSelectsVaultOnlyAfterNonEmptyResult() async throws {
        let model = makeVaultModel()
        let loader = QueuedReceivedVaultLoader([
            .failure(SecretBearingLoadError()),
            .suspended,
        ])
        let viewModel = IOSProductCompositionViewModel(receivedVaultLoader: loader.load)
        await viewModel.reloadAfterImport(makeReceipt())

        let retryTask = Task { await viewModel.retryPostImportReload() }
        await waitForCallCount(2, loader: loader)
        let duplicateRetryTask = Task { await viewModel.retryPostImportReload() }
        await duplicateRetryTask.value

        XCTAssertEqual(loader.callCount, 2)
        XCTAssertEqual(viewModel.receivedVaultState, .loading)
        XCTAssertEqual(viewModel.selectedDestination, .pairing)

        loader.resumeNext(with: .success(model))
        await retryTask.value

        XCTAssertEqual(viewModel.receivedVaultState, .available(model))
        XCTAssertEqual(viewModel.selectedDestination, .vault)
        XCTAssertFalse(viewModel.postImportReloadFailed)
    }

    func testSecondStartWhileLoadingDoesNotInvokeLoaderAgain() async throws {
        let loader = QueuedReceivedVaultLoader([.suspended])
        let viewModel = IOSProductCompositionViewModel(receivedVaultLoader: loader.load)

        let firstTask = Task { await viewModel.start() }
        await waitForCallCount(1, loader: loader)
        let secondTask = Task { await viewModel.start() }
        await secondTask.value

        XCTAssertEqual(loader.callCount, 1)

        loader.resumeNext(with: .success(VaultListModel()))
        await firstTask.value
    }

    func testSecondPostImportReloadWhileLoadingDoesNotInvokeLoaderAgain() async throws {
        let loader = QueuedReceivedVaultLoader([.suspended])
        let viewModel = IOSProductCompositionViewModel(receivedVaultLoader: loader.load)

        let firstTask = Task { await viewModel.reloadAfterImport(makeReceipt()) }
        await waitForCallCount(1, loader: loader)
        let secondTask = Task { await viewModel.reloadAfterImport(makeReceipt()) }
        await secondTask.value

        XCTAssertEqual(loader.callCount, 1)

        loader.resumeNext(with: .success(VaultListModel()))
        await firstTask.value
    }

    func testImportCompletionKeepsPairingSelectedUntilFreshReloadFinishes() async throws {
        let loader = QueuedReceivedVaultLoader([.suspended])
        let compositionViewModel = IOSProductCompositionViewModel(
            receivedVaultLoader: loader.load,
            initialDestination: .pairing
        )
        let invite = makeInvite()
        let target = makeTarget()
        let handoff = makeHandoff(invite: invite, target: target)
        let receipt = makeReceipt(handoff: handoff)
        let pairingViewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) },
            targetIdentity: target,
            exchange: { _, _ in handoff },
            handoffImporter: { _, _ in receipt },
            onImportSucceeded: { importedReceipt in
                await compositionViewModel.reloadAfterImport(importedReceipt)
            }
        )
        pairingViewModel.replaceInviteText(try inviteJSON(invite))

        let pairTask = Task { await pairingViewModel.pair() }
        await waitForCallCount(1, loader: loader)

        XCTAssertEqual(pairingViewModel.state, .imported)
        XCTAssertEqual(pairingViewModel.importReceipt, receipt)
        XCTAssertEqual(compositionViewModel.receivedVaultState, .loading)
        XCTAssertEqual(compositionViewModel.selectedDestination, .pairing)

        loader.resumeNext(with: .success(makeVaultModel()))
        await pairTask.value

        XCTAssertEqual(compositionViewModel.selectedDestination, .vault)
    }

    func testAcceptedDeepLinkSelectsPairingAndSecondLinkDuringPairingIsIgnored() async throws {
        let compositionViewModel = IOSProductCompositionViewModel(initialDestination: .vault)
        let firstInvite = makeInvite()
        let secondInvite = makeInvite(
            sessionId: "handoff-2",
            sourceDeviceId: "mac-2",
            sourceDeviceDisplayName: "Other Mac"
        )
        let target = makeTarget()
        let exchange = CompositionSuspendedPairingExchange()
        let pairingViewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) },
            targetIdentity: target,
            exchange: exchange.call,
            handoffImporter: { handoff, _ in self.makeReceipt(handoff: handoff) }
        )
        let firstInviteText = try inviteJSON(firstInvite)

        compositionViewModel.acceptDeepLinkInvite(firstInviteText, into: pairingViewModel)

        XCTAssertEqual(compositionViewModel.selectedDestination, .pairing)
        XCTAssertEqual(pairingViewModel.state, .ready)
        XCTAssertEqual(pairingViewModel.macDisplayName, "Yuchen Mac")

        let pairTask = Task { await pairingViewModel.pair() }
        await waitForExchangeCallCount(1, exchange: exchange)
        compositionViewModel.acceptDeepLinkInvite(
            try inviteJSON(secondInvite),
            into: pairingViewModel
        )

        XCTAssertEqual(exchange.callCount, 1)
        XCTAssertEqual(pairingViewModel.inviteText, firstInviteText)
        XCTAssertEqual(pairingViewModel.macDisplayName, "Yuchen Mac")

        exchange.resume(with: makeHandoff(invite: firstInvite, target: target))
        await pairTask.value
    }

    func testSecondDeepLinkDuringPostImportReloadIsIgnored() async throws {
        let loader = QueuedReceivedVaultLoader([.suspended])
        let compositionViewModel = IOSProductCompositionViewModel(receivedVaultLoader: loader.load)
        let pairingViewModel = PairingInviteViewModel(now: { Date(timeIntervalSince1970: 1_060) })
        let firstInvite = makeInvite()
        let firstInviteText = try inviteJSON(firstInvite)

        compositionViewModel.acceptDeepLinkInvite(firstInviteText, into: pairingViewModel)
        let reloadTask = Task {
            await compositionViewModel.reloadAfterImport(makeReceipt())
        }
        await waitForCallCount(1, loader: loader)

        compositionViewModel.acceptDeepLinkInvite(
            try inviteJSON(
                makeInvite(
                    sessionId: "handoff-2",
                    sourceDeviceId: "mac-2",
                    sourceDeviceDisplayName: "Other Mac"
                )
            ),
            into: pairingViewModel
        )

        XCTAssertEqual(compositionViewModel.receivedVaultState, .loading)
        XCTAssertEqual(compositionViewModel.selectedDestination, .pairing)
        XCTAssertEqual(pairingViewModel.inviteText, firstInviteText)
        XCTAssertEqual(pairingViewModel.macDisplayName, "Yuchen Mac")

        loader.resumeNext(with: .success(VaultListModel()))
        await reloadTask.value
    }

    private func waitForCallCount(
        _ expected: Int,
        loader: QueuedReceivedVaultLoader,
        file: StaticString = #filePath,
        line: UInt = #line
    ) async {
        for _ in 0..<100 where loader.callCount < expected {
            await Task.yield()
        }
        XCTAssertEqual(loader.callCount, expected, file: file, line: line)
    }

    private func makeVaultModel() -> VaultListModel {
        VaultListModel(
            items: [
                VaultListItem(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    websiteOrigin: "https://github.com"
                )
            ]
        )
    }

    private func makeReceipt() -> PairingHandoffImportReceipt {
        PairingHandoffImportReceipt(
            handoffId: "handoff-1",
            importedCredentialCount: 1,
            importedCredentialIds: ["github-login"],
            materialAlgorithm: "x25519-hkdf-sha256-chacha20poly1305",
            sourceDeviceId: "mac-1",
            targetDeviceId: "ios-1"
        )
    }

    private func makeInvite(
        sessionId: String = "handoff-1",
        sourceDeviceId: String = "mac-1",
        sourceDeviceDisplayName: String = "Yuchen Mac"
    ) -> MacPairingInvite {
        MacPairingInvite(
            version: 1,
            macBaseURL: URL(string: "http://192.168.1.42:17666")!,
            pairing: MacPairingQRCodePayload(
                version: 1,
                sessionId: sessionId,
                sessionNonce: "nonce-\(sessionId)",
                sourceDeviceId: sourceDeviceId,
                sourceDeviceDisplayName: sourceDeviceDisplayName,
                createdAt: Date(timeIntervalSince1970: 1_000),
                expiresAt: Date(timeIntervalSince1970: 1_120)
            )
        )
    }

    private func makeTarget() -> PairingTargetIdentity {
        PairingTargetIdentity(
            deviceId: "ios-1",
            displayName: "Yuchen iPhone",
            publicKeyFingerprint: "sha256:test",
            publicKeyAgreementDERBase64URL: "test-key"
        )
    }

    private func makeHandoff(
        invite: MacPairingInvite,
        target: PairingTargetIdentity
    ) -> MacPairingHandoff {
        MacPairingHandoff(
            handoffId: invite.pairing.sessionId,
            version: 1,
            sourceDeviceId: invite.pairing.sourceDeviceId,
            targetDeviceId: target.deviceId,
            targetDeviceDisplayName: target.displayName,
            targetPublicKeyFingerprint: target.publicKeyFingerprint,
            createdAt: Date(timeIntervalSince1970: 1_060),
            expiresAt: Date(timeIntervalSince1970: 1_120),
            material: MacPairingHandoffMaterial(
                algorithm: "test-algorithm",
                senderPublicKeyAgreementDERBase64URL: "test-sender-key",
                nonce: "test-nonce",
                ciphertext: "test-ciphertext",
                tag: "test-tag"
            )
        )
    }

    private func makeReceipt(handoff: MacPairingHandoff) -> PairingHandoffImportReceipt {
        PairingHandoffImportReceipt(
            handoffId: handoff.handoffId,
            importedCredentialCount: 1,
            importedCredentialIds: ["github-login"],
            materialAlgorithm: handoff.material.algorithm,
            sourceDeviceId: handoff.sourceDeviceId,
            targetDeviceId: handoff.targetDeviceId
        )
    }

    private func inviteJSON(_ invite: MacPairingInvite) throws -> String {
        String(data: try JSONEncoder().encode(invite), encoding: .utf8) ?? ""
    }

    private func makePairingDeepLink(inviteText: String) -> URL {
        URL(
            string: "unuvault-ioshost://pair?invite="
                + Data(inviteText.utf8).base64URLEncodedString()
        )!
    }

    private func waitForExchangeCallCount(
        _ expected: Int,
        exchange: CompositionSuspendedPairingExchange,
        file: StaticString = #filePath,
        line: UInt = #line
    ) async {
        for _ in 0..<100 where exchange.callCount < expected {
            await Task.yield()
        }
        XCTAssertEqual(exchange.callCount, expected, file: file, line: line)
    }
}

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

@MainActor
private final class CompositionSuspendedPairingExchange {
    private var continuation: CheckedContinuation<MacPairingHandoff, any Error>?
    private(set) var callCount = 0

    func call(
        _ invite: MacPairingInvite,
        _ target: PairingTargetIdentity
    ) async throws -> MacPairingHandoff {
        callCount += 1
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
        }
    }

    func resume(with handoff: MacPairingHandoff) {
        continuation?.resume(returning: handoff)
        continuation = nil
    }
}

@MainActor
private final class QueuedReceivedVaultLoader {
    enum Outcome {
        case success(VaultListModel)
        case failure(any Error)
        case suspended
    }

    private var outcomes: [Outcome]
    private var continuations: [CheckedContinuation<VaultListModel, any Error>] = []
    private(set) var callCount = 0

    init(_ outcomes: [Outcome]) {
        self.outcomes = outcomes
    }

    func load() async throws -> VaultListModel {
        callCount += 1
        let outcome = outcomes.removeFirst()

        switch outcome {
        case let .success(model):
            return model
        case let .failure(error):
            throw error
        case .suspended:
            return try await withCheckedThrowingContinuation { continuation in
                continuations.append(continuation)
            }
        }
    }

    func resumeNext(with result: Result<VaultListModel, any Error>) {
        continuations.removeFirst().resume(with: result)
    }
}

private struct SecretBearingLoadError: Error, CustomStringConvertible {
    let description = "secret-store-bytes"
}

private func contrastRatio(_ foreground: UIColor, _ background: UIColor) -> CGFloat {
    let lighter = max(relativeLuminance(foreground), relativeLuminance(background))
    let darker = min(relativeLuminance(foreground), relativeLuminance(background))
    return (lighter + 0.05) / (darker + 0.05)
}

private func relativeLuminance(_ color: UIColor) -> CGFloat {
    var red: CGFloat = 0
    var green: CGFloat = 0
    var blue: CGFloat = 0
    var alpha: CGFloat = 0
    XCTAssertTrue(color.getRed(&red, green: &green, blue: &blue, alpha: &alpha))

    func linearize(_ component: CGFloat) -> CGFloat {
        component <= 0.04045
            ? component / 12.92
            : pow((component + 0.055) / 1.055, 2.4)
    }

    return 0.2126 * linearize(red)
        + 0.7152 * linearize(green)
        + 0.0722 * linearize(blue)
}
