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
        let now = Date(timeIntervalSince1970: 1_060)
        let targetIdentity = PairingTargetIdentity(
            deviceId: "ios-host-device",
            displayName: "Yuchen iPhone",
            publicKeyFingerprint: "ios-host-public-key-fingerprint"
        )
        let model = PairingInviteViewModel(
            now: { now },
            targetIdentity: targetIdentity,
            exchange: { _, _ in
                throw HostPairingError.exchangeUnavailable
            }
        )

        if let inviteText = Self.makeInviteText(now: now) {
            model.replaceInviteText(inviteText)
        }

        _viewModel = StateObject(wrappedValue: model)
    }

    var body: some View {
        PairingInviteReceiveView(viewModel: viewModel)
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
                expiresAt: Date(timeInterval: 3_600, since: now)
            )
        )

        guard let data = try? JSONEncoder().encode(invite) else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }
}

private enum HostPairingError: Error {
    case exchangeUnavailable
}
