import Foundation
import SwiftUI

@main
struct UnuVaultIOSHostApp: SwiftUI.App {
    var body: some Scene {
        WindowGroup {
            PairingInviteHostRootView()
        }
    }
}

private struct PairingInviteHostRootView: View {
    @StateObject private var viewModel: PairingInviteViewModel

    @MainActor
    init() {
        let sampleNow = Date()
        let model = PairingInviteViewModel(
            now: Date.init,
            targetIdentityProvider: {
                try DefaultPairingTargetIdentityProvider().makeIdentity()
            }
        )

        if let inviteText = Self.makeInviteText(now: sampleNow) {
            model.replaceInviteText(inviteText)
        }

        _viewModel = StateObject(wrappedValue: model)
    }

    var body: some View {
        PairingInviteReceiveView(viewModel: viewModel)
            .environment(\.dynamicTypeSize, Self.dynamicTypeSizeFromLaunchArguments())
            .onOpenURL { url in
                handlePairingURL(url)
            }
    }

    private func handlePairingURL(_ url: URL) {
        guard let inviteText = Self.inviteText(from: url) else {
            print("UNUVAULT_IOS_PAIRING_RECEIPT failed reason=invalid_deeplink")
            return
        }

        viewModel.replaceInviteText(inviteText)

        Task {
            await viewModel.pair()
            reportPairingReceipt()
        }
    }

    private func reportPairingReceipt() {
        guard let receipt = viewModel.importReceipt else {
            let diagnostic = viewModel.pairingFailureDiagnostic
            let diagnosticText = diagnostic.isEmpty ? "" : " diagnostic=\(diagnostic)"
            print("UNUVAULT_IOS_PAIRING_RECEIPT failed state=\(viewModel.state)\(diagnosticText)")
            return
        }

        print(receipt.receiptLine)
    }

    private static func inviteText(from url: URL) -> String? {
        guard url.scheme == "unuvault-ioshost",
              url.host == "pair",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let invite = components.queryItems?.first(where: { $0.name == "invite" })?.value,
              let data = Data(base64URLEncoded: invite)
        else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    private static func makeInviteText(now: Date) -> String? {
        let invite = MacPairingInvite(
            version: 1,
            macBaseURL: URL(string: "http://127.0.0.1:47171")!,
            pairing: MacPairingQRCodePayload(
                version: 1,
                sessionId: "session-ios-host",
                sessionNonce: "nonce-ios-host",
                sourceDeviceId: "mac-host-device",
                sourceDeviceDisplayName: "Yuchen MacBook Pro",
                createdAt: Date(timeInterval: -60, since: now),
                expiresAt: Date(timeInterval: 540, since: now)
            )
        )

        guard let data = try? JSONEncoder().encode(invite) else {
            return nil
        }

        return String(data: data, encoding: .utf8)
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

private extension Data {
    init?(base64URLEncoded value: String) {
        var base64URL = value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        let padding = base64URL.count % 4
        if padding > 0 {
            base64URL.append(String(repeating: "=", count: 4 - padding))
        }

        self.init(base64Encoded: base64URL)
    }
}
