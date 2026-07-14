import Foundation
import SwiftUI

@main
struct UnuVaultIOSHostApp: SwiftUI.App {
    var body: some Scene {
        WindowGroup {
            IOSProductHostRootView()
        }
    }
}

private struct IOSProductHostRootView: View {
    @StateObject private var compositionViewModel: IOSProductCompositionViewModel
    @StateObject private var pairingViewModel: PairingInviteViewModel
    @State private var acceptedPhysicalPairingURL = false
    @State private var pendingPhysicalInviteText: String?
    @State private var physicalPairingStarted = false

    @MainActor
    init() {
        let compositionModel = IOSProductCompositionViewModel()
        let pairingModel = PairingInviteViewModel(
            onImportSucceeded: { receipt in
                await compositionModel.reloadAfterImport(receipt)
            }
        )

        _compositionViewModel = StateObject(wrappedValue: compositionModel)
        _pairingViewModel = StateObject(wrappedValue: pairingModel)
    }

    var body: some View {
        IOSProductCompositionView(
            viewModel: compositionViewModel,
            pairingViewModel: pairingViewModel
        )
            .environment(\.dynamicTypeSize, Self.dynamicTypeSizeFromLaunchArguments())
            .onOpenURL { url in
                handlePairingURL(url)
            }
            .onChange(of: compositionViewModel.receivedVaultState) { _, _ in
                forwardPendingPhysicalInviteIfPossible()
            }
            .onChange(of: pairingViewModel.importReceipt) { _, receipt in
                guard let receipt else {
                    return
                }

                print(receipt.receiptLine)
            }
    }

    private func handlePairingURL(_ url: URL) {
        guard !acceptedPhysicalPairingURL else {
            return
        }
        guard let inviteText = IOSPairingDeepLink.inviteText(from: url) else {
            print("UNUVAULT_IOS_PAIRING_RECEIPT failed reason=invalid_deeplink")
            return
        }

        acceptedPhysicalPairingURL = true
        pendingPhysicalInviteText = inviteText
        forwardPendingPhysicalInviteIfPossible()
    }

    private func forwardPendingPhysicalInviteIfPossible() {
        guard compositionViewModel.receivedVaultState != .idle,
              compositionViewModel.receivedVaultState != .loading,
              let inviteText = pendingPhysicalInviteText,
              !physicalPairingStarted
        else {
            return
        }

        pendingPhysicalInviteText = nil
        compositionViewModel.acceptDeepLinkInvite(
            inviteText,
            into: pairingViewModel
        )

        guard pairingViewModel.state == .ready else {
            print("UNUVAULT_IOS_PAIRING_RECEIPT failed reason=invalid_invite")
            return
        }

        physicalPairingStarted = true

        Task {
            await pairingViewModel.pair()
            reportPairingFailureIfNeeded()
        }
    }

    private func reportPairingFailureIfNeeded() {
        guard pairingViewModel.importReceipt == nil else {
            return
        }

        let diagnostic = pairingViewModel.pairingFailureDiagnostic
        let diagnosticText = diagnostic.isEmpty ? "" : " diagnostic=\(diagnostic)"
        print(
            "UNUVAULT_IOS_PAIRING_RECEIPT failed "
                + "state=\(pairingViewModel.state)\(diagnosticText)"
        )
    }

    private static func dynamicTypeSizeFromLaunchArguments() -> DynamicTypeSize {
        let arguments = ProcessInfo.processInfo.arguments
        guard let flagIndex = arguments.firstIndex(of: "--unuvault-dynamic-type") else {
            return .large
        }

        let valueIndex = arguments.index(after: flagIndex)
        guard arguments.indices.contains(valueIndex) else {
            return .large
        }

        switch arguments[valueIndex] {
        case "large":
            return .large
        case PairingInviteAccessibilityContract.dynamicTypeProofSizeName:
            return PairingInviteAccessibilityContract.dynamicTypeProofSize
        default:
            return .large
        }
    }
}
