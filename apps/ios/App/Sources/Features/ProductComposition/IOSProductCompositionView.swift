import SwiftUI

enum IOSProductDestination: Hashable {
    case vault
    case pairing
}

enum ReceivedVaultLoadState: Equatable {
    case idle
    case loading
    case available(VaultListModel)
    case empty
    case failed
}

typealias ReceivedVaultLoader = @MainActor () async throws -> VaultListModel
typealias PairingImportCompletion = @MainActor (PairingHandoffImportReceipt) async -> Void

@MainActor
final class IOSProductCompositionViewModel: ObservableObject {
    @Published private(set) var receivedVaultState: ReceivedVaultLoadState
    @Published var selectedDestination: IOSProductDestination
    @Published private(set) var postImportReloadFailed: Bool

    private enum LoadContext {
        case startup
        case postImport
    }

    private let receivedVaultLoader: ReceivedVaultLoader

    init(
        receivedVaultLoader: @escaping ReceivedVaultLoader =
            IOSProductCompositionViewModel.appDefaultLoader(),
        initialDestination: IOSProductDestination = .pairing
    ) {
        self.receivedVaultLoader = receivedVaultLoader
        receivedVaultState = .idle
        selectedDestination = initialDestination
        postImportReloadFailed = false
    }

    func start() async {
        await loadReceivedVault(context: .startup)
    }

    func reloadAfterImport(_ receipt: PairingHandoffImportReceipt) async {
        await loadReceivedVault(context: .postImport)
    }

    func retryPostImportReload() async {
        await loadReceivedVault(context: .postImport)
    }

    func acceptDeepLinkInvite(
        _ inviteText: String,
        into pairingViewModel: PairingInviteViewModel
    ) {
        // Task 3 owns deep-link coordination and input single-flight behavior.
    }

    static func appDefaultLoader(
        configuration: PairingReceivedVaultStoreConfiguration = .appDefault()
    ) -> ReceivedVaultLoader {
        {
            try VaultListModel.loadReceivedVault(from: configuration)
        }
    }

    private func loadReceivedVault(context: LoadContext) async {
        guard receivedVaultState != .loading else {
            return
        }

        receivedVaultState = .loading
        selectedDestination = .pairing
        postImportReloadFailed = false

        do {
            let model = try await receivedVaultLoader()

            if model.items.isEmpty {
                receivedVaultState = .empty
                selectedDestination = .pairing
                postImportReloadFailed = context == .postImport
            } else {
                receivedVaultState = .available(model)
                selectedDestination = .vault
                postImportReloadFailed = false
            }
        } catch {
            receivedVaultState = .failed
            selectedDestination = .pairing
            postImportReloadFailed = context == .postImport
        }
    }
}

@MainActor
struct IOSProductCompositionView: View {
    @StateObject private var viewModel: IOSProductCompositionViewModel
    private let pairingViewModel: PairingInviteViewModel?

    init(
        viewModel: IOSProductCompositionViewModel = IOSProductCompositionViewModel(),
        pairingViewModel: PairingInviteViewModel? = nil
    ) {
        _viewModel = StateObject(wrappedValue: viewModel)
        self.pairingViewModel = pairingViewModel
    }

    var body: some View {
        EmptyView()
    }
}
