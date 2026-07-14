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
