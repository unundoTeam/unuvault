import XCTest
@testable import App

@MainActor
final class IOSProductCompositionTests: XCTestCase {
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
