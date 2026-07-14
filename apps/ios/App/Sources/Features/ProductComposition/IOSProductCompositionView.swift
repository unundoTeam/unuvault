import Combine
import SwiftUI
import UIKit

enum IOSPairingDeepLink {
    static func inviteText(from url: URL) -> String? {
        guard url.scheme == "unuvault-ioshost",
              url.host == "pair",
              let components = URLComponents(
                  url: url,
                  resolvingAgainstBaseURL: false
              ),
              let invite = components.queryItems?
                  .first(where: { $0.name == "invite" })?
                  .value,
              let data = decodeBase64URL(invite)
        else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    private static func decodeBase64URL(_ value: String) -> Data? {
        let allowedCharacters = CharacterSet(
            charactersIn:
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
        )
        guard !value.isEmpty,
              value.unicodeScalars.allSatisfy(allowedCharacters.contains),
              value.count % 4 != 1
        else {
            return nil
        }

        var base64 = value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let padding = base64.count % 4
        if padding > 0 {
            base64.append(String(repeating: "=", count: 4 - padding))
        }

        return Data(base64Encoded: base64)
    }
}

enum IOSProductCompositionUIContract {
    struct DestinationRole: Equatable {
        struct Presentation: Equatable {
            enum Emphasis: Equatable {
                case selected
                case unselected
            }

            let systemImage: String
            let emphasis: Emphasis
        }

        struct AccessibilityRole: Equatable {
            let label: String
            let value: String
        }

        let title: String
        let systemImage: String
        let selectedSystemImage: String
        let unselectedSystemImage: String

        func presentation(isSelected: Bool) -> Presentation {
            Presentation(
                systemImage: isSelected ? selectedSystemImage : unselectedSystemImage,
                emphasis: isSelected ? .selected : .unselected
            )
        }

        func accessibility(isSelected: Bool) -> AccessibilityRole {
            AccessibilityRole(
                label: title,
                value: isSelected ? selectedValue : notSelectedValue
            )
        }
    }

    static let vault = DestinationRole(
        title: "Vault",
        systemImage: "lock.fill",
        selectedSystemImage: "lock.fill",
        unselectedSystemImage: "lock"
    )
    static let pairing = DestinationRole(
        title: "Pairing",
        systemImage: "link",
        selectedSystemImage: "link.circle.fill",
        unselectedSystemImage: "link"
    )

    static let selectedValue = "Selected"
    static let notSelectedValue = "Not selected"
    static let minimumActionHeight: CGFloat = 48

    static let loadingTitle = "Loading received vault…"
    static let loadingBody =
        "Vault or Pairing will open as soon as local metadata is checked."
    static let loadingStatus = "Checking local metadata"

    static let emptyTitle = "No vault received yet"
    static let emptyBody =
        "Open Pairing to import read-only metadata from a trusted Mac."

    static let loadFailureTitle = "Vault metadata unavailable"
    static let loadFailureBody =
        "Try the local reload again. Pairing remains available."
    static let retryTitle = "Retry"

    static let postImportReloadFailure =
        "Imported, but the received vault could not be reloaded."
    static let postImportReloadRecovery =
        "Try the local reload again. Pairing remains available."

    static let startupLoadingAnnouncement =
        [loadingTitle, loadingBody].joined(separator: " ")
    static let startupFailureAnnouncement =
        [loadFailureTitle, loadFailureBody].joined(separator: " ")
    static let postImportFailureAnnouncement =
        [postImportReloadFailure, postImportReloadRecovery].joined(separator: " ")
}

struct IOSProductCompositionAccessibilityAnnouncement: Equatable, Identifiable {
    let sequence: UInt64
    let message: String

    var id: UInt64 { sequence }
}

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
    @Published private(set) var accessibilityAnnouncement:
        IOSProductCompositionAccessibilityAnnouncement?

    private enum LoadContext {
        case startup
        case postImport
    }

    private let receivedVaultLoader: ReceivedVaultLoader
    private var nextAccessibilityAnnouncementSequence: UInt64 = 0

    init(
        receivedVaultLoader: @escaping ReceivedVaultLoader =
            IOSProductCompositionViewModel.appDefaultLoader(),
        initialDestination: IOSProductDestination = .pairing
    ) {
        self.receivedVaultLoader = receivedVaultLoader
        receivedVaultState = .idle
        selectedDestination = initialDestination
        postImportReloadFailed = false
        accessibilityAnnouncement = nil
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
        guard receivedVaultState != .loading, !pairingViewModel.isBusy else {
            return
        }

        selectedDestination = .pairing
        pairingViewModel.replaceInviteText(inviteText)
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
        if context == .startup {
            publishAccessibilityAnnouncement(
                IOSProductCompositionUIContract.startupLoadingAnnouncement
            )
        }

        do {
            let model = try await receivedVaultLoader()

            if model.items.isEmpty {
                receivedVaultState = .empty
                selectedDestination = .pairing
                postImportReloadFailed = context == .postImport
                if context == .postImport {
                    publishAccessibilityAnnouncement(
                        IOSProductCompositionUIContract.postImportFailureAnnouncement
                    )
                }
            } else {
                receivedVaultState = .available(model)
                selectedDestination = .vault
                postImportReloadFailed = false
            }
        } catch {
            receivedVaultState = .failed
            selectedDestination = .pairing
            postImportReloadFailed = context == .postImport
            publishAccessibilityAnnouncement(
                context == .startup
                    ? IOSProductCompositionUIContract.startupFailureAnnouncement
                    : IOSProductCompositionUIContract.postImportFailureAnnouncement
            )
        }
    }

    private func publishAccessibilityAnnouncement(_ message: String) {
        nextAccessibilityAnnouncementSequence += 1
        accessibilityAnnouncement = IOSProductCompositionAccessibilityAnnouncement(
            sequence: nextAccessibilityAnnouncementSequence,
            message: message
        )
    }
}

@MainActor
struct IOSProductCompositionView: View {
    @StateObject private var viewModel: IOSProductCompositionViewModel
    @StateObject private var pairingViewModel: PairingInviteViewModel
    @State private var lastAccessibilityAnnouncementSequence: UInt64 = 0

    init(
        viewModel: IOSProductCompositionViewModel = IOSProductCompositionViewModel(),
        pairingViewModel: PairingInviteViewModel? = nil
    ) {
        _viewModel = StateObject(wrappedValue: viewModel)
        _pairingViewModel = StateObject(
            wrappedValue: pairingViewModel ?? PairingInviteViewModel(
                onImportSucceeded: { receipt in
                    await viewModel.reloadAfterImport(receipt)
                }
            )
        )
    }

    var body: some View {
        TabView(selection: $viewModel.selectedDestination) {
            NavigationStack {
                vaultContent
            }
            .tabItem {
                destinationLabel(
                    IOSProductCompositionUIContract.vault,
                    destination: .vault
                )
            }
            .tag(IOSProductDestination.vault)

            NavigationStack {
                pairingContent
            }
            .tabItem {
                destinationLabel(
                    IOSProductCompositionUIContract.pairing,
                    destination: .pairing
                )
            }
            .tag(IOSProductDestination.pairing)
        }
        .task {
            await viewModel.start()
        }
        .onReceive(viewModel.$accessibilityAnnouncement.compactMap { $0 }) { event in
            guard event.sequence > lastAccessibilityAnnouncementSequence else {
                return
            }
            lastAccessibilityAnnouncementSequence = event.sequence
            AccessibilityNotification.Announcement(event.message).post()
        }
    }

    @ViewBuilder
    private var vaultContent: some View {
        switch viewModel.receivedVaultState {
        case .idle, .loading:
            stateContainer {
                VStack(spacing: 12) {
                    ProgressView()
                        .controlSize(.large)
                        .tint(.accentColor)
                        .accessibilityHidden(true)
                    Text(IOSProductCompositionUIContract.loadingTitle)
                        .font(.headline)
                        .multilineTextAlignment(.center)
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(IOSProductCompositionUIContract.loadingBody)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(24)
                .frame(maxWidth: .infinity)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .accessibilityElement(children: .combine)
                .accessibilityLabel(IOSProductCompositionUIContract.loadingTitle)
                .accessibilityValue(IOSProductCompositionUIContract.loadingStatus)
            }
        case let .available(model):
            VaultListView(model: model)
        case .empty:
            stateContainer {
                VStack(alignment: .leading, spacing: 8) {
                    Image(systemName: "archivebox")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                        .accessibilityHidden(true)
                    Text(IOSProductCompositionUIContract.emptyTitle)
                        .font(.headline)
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(IOSProductCompositionUIContract.emptyBody)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .accessibilityElement(children: .combine)
            }
        case .failed:
            stateContainer {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        Label(
                            IOSProductCompositionUIContract.loadFailureTitle,
                            systemImage: "exclamationmark.triangle.fill"
                        )
                        .font(.headline)
                        .foregroundStyle(.red)
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                        Text(IOSProductCompositionUIContract.loadFailureBody)
                            .font(.subheadline)
                            .foregroundStyle(.red)
                            .lineLimit(nil)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.red.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(
                        IOSProductCompositionUIContract.loadFailureTitle
                    )

                    retryButton {
                        await viewModel.start()
                    }
                }
            }
        }
    }

    private var pairingContent: some View {
        VStack(spacing: 0) {
            PairingInviteReceiveView(viewModel: pairingViewModel)

            if viewModel.postImportReloadFailed {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(IOSProductCompositionUIContract.postImportReloadFailure)
                            .font(.headline)
                            .foregroundStyle(.red)
                            .lineLimit(nil)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(IOSProductCompositionUIContract.postImportReloadRecovery)
                            .font(.subheadline)
                            .foregroundStyle(.red)
                            .lineLimit(nil)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.red.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(
                        IOSProductCompositionUIContract.postImportReloadFailure
                    )

                    retryButton {
                        await viewModel.retryPostImportReload()
                    }
                }
                .padding([.horizontal, .bottom], 20)
                .background(Color(uiColor: .systemGroupedBackground))
            }
        }
        .background(Color(uiColor: .systemGroupedBackground))
    }

    private func destinationLabel(
        _ role: IOSProductCompositionUIContract.DestinationRole,
        destination: IOSProductDestination
    ) -> some View {
        let isSelected = viewModel.selectedDestination == destination
        let presentation = role.presentation(isSelected: isSelected)
        let accessibility = role.accessibility(isSelected: isSelected)

        return Label(role.title, systemImage: presentation.systemImage)
            .fontWeight(presentation.emphasis == .selected ? .bold : .regular)
            .accessibilityLabel(accessibility.label)
            .accessibilityValue(accessibility.value)
    }

    private func stateContainer<Content: View>(
        @ViewBuilder content: () -> Content
    ) -> some View {
        ScrollView {
            content()
                .padding(20)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color(uiColor: .systemGroupedBackground))
    }

    private func retryButton(
        action: @escaping @MainActor () async -> Void
    ) -> some View {
        Button {
            Task {
                await action()
            }
        } label: {
            Label(
                IOSProductCompositionUIContract.retryTitle,
                systemImage: "arrow.clockwise"
            )
            .font(.headline)
            .lineLimit(nil)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity)
            .frame(minHeight: IOSProductCompositionUIContract.minimumActionHeight)
        }
        .buttonStyle(.borderedProminent)
        .accessibilityLabel(IOSProductCompositionUIContract.retryTitle)
    }
}
