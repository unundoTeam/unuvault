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
    @State private var physicalPairingAttempt = IOSPhysicalPairingAttemptPolicy()
    @State private var didRequestFixtureReload = false
    private let fixtureState: IOSProductCompositionFixtureState?

    @MainActor
    init() {
        let fixtureState = Self.compositionFixtureStateFromLaunchArguments()
        let compositionModel = fixtureState.map {
            IOSProductCompositionViewModel(
                receivedVaultLoader: $0.makeReceivedVaultLoader()
            )
        } ?? IOSProductCompositionViewModel()
        let pairingModel = PairingInviteViewModel(
            onImportSucceeded: { receipt in
                await compositionModel.reloadAfterImport(receipt)
            }
        )

        self.fixtureState = fixtureState
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
                requestReloadFailureFixtureIfNeeded()
            }
            .onChange(of: pairingViewModel.importReceipt) { _, receipt in
                guard let receipt else {
                    return
                }

                print(receipt.receiptLine)
            }
    }

    private func handlePairingURL(_ url: URL) {
        guard !physicalPairingAttempt.isActive else {
            return
        }
        guard let inviteText = IOSPairingDeepLink.inviteText(from: url) else {
            resetPhysicalPairingAttempt()
            print("UNUVAULT_IOS_PAIRING_RECEIPT failed reason=invalid_deeplink")
            return
        }
        guard physicalPairingAttempt.begin(inviteText: inviteText) else {
            return
        }

        forwardPendingPhysicalInviteIfPossible()
    }

    private func forwardPendingPhysicalInviteIfPossible() {
        guard compositionViewModel.receivedVaultState != .idle,
              compositionViewModel.receivedVaultState != .loading,
              let inviteText = physicalPairingAttempt.pendingInviteText
        else {
            return
        }

        compositionViewModel.acceptDeepLinkInvite(
            inviteText,
            into: pairingViewModel
        )

        guard physicalPairingAttempt.markForwarded(
            parserState: pairingViewModel.state
        ) else {
            resetPhysicalPairingAttempt()
            print("UNUVAULT_IOS_PAIRING_RECEIPT failed reason=invalid_invite")
            return
        }

        Task {
            await pairingViewModel.pair()
            reportPairingFailureIfNeeded()
            resetPhysicalPairingAttempt()
        }
    }

    private func resetPhysicalPairingAttempt() {
        physicalPairingAttempt.finish()
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

    private func requestReloadFailureFixtureIfNeeded() {
        guard fixtureState == .reloadFailed,
              compositionViewModel.receivedVaultState == .empty,
              !didRequestFixtureReload
        else {
            return
        }

        didRequestFixtureReload = true
        Task {
            await compositionViewModel.reloadAfterImport(Self.fixtureReceipt)
        }
    }

    private static let fixtureReceipt = PairingHandoffImportReceipt(
        handoffId: "fixture-handoff",
        importedCredentialCount: 1,
        importedCredentialIds: ["fixture-metadata"],
        materialAlgorithm: "fixture-only",
        sourceDeviceId: "fixture-mac",
        targetDeviceId: "fixture-ios"
    )

    private static func compositionFixtureStateFromLaunchArguments()
        -> IOSProductCompositionFixtureState?
    {
        let arguments = ProcessInfo.processInfo.arguments
        guard let flagIndex = arguments.firstIndex(
                  of: "--unuvault-composition-state"
              )
        else {
            return nil
        }

        let valueIndex = arguments.index(after: flagIndex)
        guard arguments.indices.contains(valueIndex) else {
            return nil
        }

        return IOSProductCompositionFixtureState(rawValue: arguments[valueIndex])
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
