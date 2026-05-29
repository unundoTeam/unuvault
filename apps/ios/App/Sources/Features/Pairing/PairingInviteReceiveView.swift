import Foundation
import SwiftUI

enum PairingInviteFlowState: Equatable {
    case empty
    case ready
    case pairing
    case paired
    case invalid
    case failed
}

typealias PairingInviteExchange = (
    MacPairingInvite,
    PairingTargetIdentity
) async throws -> MacPairingHandoff

@MainActor
final class PairingInviteViewModel: ObservableObject {
    @Published private(set) var handoff: MacPairingHandoff?
    @Published private(set) var inviteText = ""
    @Published private(set) var macDisplayName = ""
    @Published private(set) var macEndpointText = ""
    @Published private(set) var macInviteDetailText = ""
    @Published private(set) var state: PairingInviteFlowState = .empty
    @Published private(set) var statusMessage = "Paste the invite from your Mac."

    private let exchange: PairingInviteExchange
    private let now: @Sendable () -> Date
    private let targetIdentity: PairingTargetIdentity
    private var invite: MacPairingInvite?

    var canPair: Bool {
        state == .ready
    }

    init(
        now: @escaping @Sendable () -> Date = Date.init,
        targetIdentity: PairingTargetIdentity = PairingInviteViewModel.defaultTargetIdentity(),
        exchange: PairingInviteExchange? = nil
    ) {
        self.exchange = exchange ?? Self.defaultExchange(now: now)
        self.now = now
        self.targetIdentity = targetIdentity
    }

    func replaceInviteText(_ text: String) {
        inviteText = text
        handoff = nil

        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else {
            clearInvite()
            return
        }

        guard let data = trimmedText.data(using: .utf8) else {
            markInvalid(message: "Invite is invalid. Paste a fresh invite from your Mac.")
            return
        }

        do {
            let parsedInvite = try PairingInviteParser.parse(data, now: now())
            invite = parsedInvite
            macDisplayName = parsedInvite.pairing.sourceDeviceDisplayName
            macEndpointText = parsedInvite.macBaseURL.absoluteString
            macInviteDetailText = Self.inviteDetailText(for: parsedInvite, now: now())
            state = .ready
            statusMessage = "Invite recognized. No vault items move until this iPhone sends a scoped pairing claim."
        } catch PairingPayloadError.expired {
            markInvalid(message: "Invite expired. Generate a fresh invite on your Mac.")
        } catch {
            markInvalid(message: "Invite is invalid. Paste a fresh invite from your Mac.")
        }
    }

    func pair() async {
        guard let invite, canPair else {
            return
        }

        state = .pairing
        statusMessage = "Requesting one-time encrypted handoff..."

        do {
            handoff = try await exchange(invite, targetIdentity)
            state = .paired
            statusMessage = "Pairing complete. Wrapped handoff received."
        } catch PairingExchangeClientError.httpStatus(410) {
            handoff = nil
            state = .invalid
            statusMessage = "Invite expired. Generate a fresh invite on your Mac."
        } catch {
            handoff = nil
            state = .failed
            statusMessage = "Pairing failed. Generate a fresh invite on your Mac."
        }
    }

    private func clearInvite() {
        invite = nil
        macDisplayName = ""
        macEndpointText = ""
        macInviteDetailText = ""
        state = .empty
        statusMessage = "Paste the invite from your Mac."
    }

    private func markInvalid(message: String) {
        invite = nil
        macDisplayName = ""
        macEndpointText = ""
        macInviteDetailText = ""
        state = .invalid
        statusMessage = message
    }

    private static func defaultTargetIdentity() -> PairingTargetIdentity {
        PairingTargetIdentity(
            deviceId: "ios-device-local",
            displayName: "This iPhone",
            publicKeyFingerprint: "ios-public-key-fingerprint-pending"
        )
    }

    private static func defaultExchange(
        now: @escaping @Sendable () -> Date
    ) -> PairingInviteExchange {
        { invite, targetIdentity in
            let client = PairingExchangeClient(invite: invite, now: now)
            return try await client.exchange(
                payload: invite.pairing,
                targetIdentity: targetIdentity
            )
        }
    }

    private static func inviteDetailText(for invite: MacPairingInvite, now: Date) -> String {
        let secondsRemaining = max(0, invite.pairing.expiresAt.timeIntervalSince(now))
        let minutesRemaining = max(1, Int(ceil(secondsRemaining / 60)))

        return "Local network • invite expires in \(minutesRemaining) min"
    }
}

private extension PairingInviteViewModel {
    var hidesRawInviteText: Bool {
        switch state {
        case .ready, .pairing, .paired:
            true
        case .empty, .invalid, .failed:
            false
        }
    }
}

struct PairingInviteReceiveView: View {
    @ObservedObject var viewModel: PairingInviteViewModel

    init(viewModel: PairingInviteViewModel = PairingInviteViewModel()) {
        self.viewModel = viewModel
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Pair with your Mac")
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(PairingInviteStyle.ink)
                Text("Use a one-time invite from an unlocked Mac. The invite is session data, not your passwords.")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(PairingInviteStyle.body)
                    .fixedSize(horizontal: false, vertical: true)

                inviteInput
                macSummary
                pairButton
                statusPanel
            }
            .padding(20)
        }
        .background(PairingInviteStyle.canvas)
    }

    private var inviteInput: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Receive invite")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(PairingInviteStyle.ink)
            Text(viewModel.hidesRawInviteText
                ? "Raw invite text stays hidden after it is recognized."
                : "Paste the invite copied from UnuVault on this Mac. Raw invite text stays hidden after it is recognized."
            )
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(PairingInviteStyle.body)
            .fixedSize(horizontal: false, vertical: true)

            if viewModel.hidesRawInviteText {
                Text("Invite recognized")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(PairingInviteStyle.ink)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 48)
                    .background(PairingInviteStyle.input)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(PairingInviteStyle.border, lineWidth: 1)
                    )
                    .accessibilityLabel("Invite recognized")
            } else {
                Text("Paste invite")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(PairingInviteStyle.ink)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 48)
                    .background(PairingInviteStyle.input)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(PairingInviteStyle.border, lineWidth: 1)
                    )
                    .accessibilityLabel("Paste invite")

                TextEditor(
                    text: Binding(
                        get: { viewModel.inviteText },
                        set: { viewModel.replaceInviteText($0) }
                    )
                )
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(PairingInviteStyle.ink)
                .frame(minHeight: 104)
                .padding(8)
                .background(PairingInviteStyle.input)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(PairingInviteStyle.border, lineWidth: 1)
                )
                .accessibilityLabel("Invite text")
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(PairingInviteStyle.border, lineWidth: 1)
        )
    }

    private var macSummary: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(viewModel.canPair ? "Ready to pair" : "Waiting for invite")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(viewModel.canPair ? PairingInviteStyle.secure : PairingInviteStyle.body)
            Text(viewModel.macDisplayName.isEmpty ? "Paste invite from Mac" : viewModel.macDisplayName)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(PairingInviteStyle.ink)
            if !viewModel.macInviteDetailText.isEmpty {
                Text(viewModel.macInviteDetailText)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(PairingInviteStyle.body)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text("Pair only if this Mac is unlocked and trusted.")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(PairingInviteStyle.body)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PairingInviteStyle.input)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(PairingInviteStyle.border, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Recognized Mac \(viewModel.macDisplayName)")
    }

    private var pairButton: some View {
        Button {
            Task {
                await viewModel.pair()
            }
        } label: {
            Text(viewModel.state == .pairing ? "Pairing..." : "Pair")
                .font(.system(size: 15, weight: .bold))
                .frame(maxWidth: .infinity)
                .frame(minHeight: 48)
        }
        .buttonStyle(.plain)
        .foregroundStyle(Color.white)
        .background(viewModel.canPair ? PairingInviteStyle.ink : PairingInviteStyle.disabled)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .disabled(!viewModel.canPair)
        .accessibilityLabel("Pair")
    }

    private var statusPanel: some View {
        Text(viewModel.statusMessage)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(statusForeground)
            .fixedSize(horizontal: false, vertical: true)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(statusBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(statusBorder, lineWidth: 1)
            )
            .accessibilityLabel(viewModel.statusMessage)
    }

    private var statusBackground: Color {
        switch viewModel.state {
        case .invalid, .failed:
            PairingInviteStyle.dangerSurface
        default:
            PairingInviteStyle.input
        }
    }

    private var statusBorder: Color {
        switch viewModel.state {
        case .invalid, .failed:
            PairingInviteStyle.danger
        default:
            PairingInviteStyle.border
        }
    }

    private var statusForeground: Color {
        switch viewModel.state {
        case .invalid, .failed:
            PairingInviteStyle.danger
        default:
            PairingInviteStyle.body
        }
    }
}

private enum PairingInviteStyle {
    static let body = Color(red: 0.29, green: 0.33, blue: 0.39)
    static let border = Color(red: 0.78, green: 0.80, blue: 0.83)
    static let canvas = Color(red: 0.96, green: 0.96, blue: 0.96)
    static let danger = Color(red: 0.60, green: 0.11, blue: 0.11)
    static let dangerSurface = Color(red: 1.00, green: 0.95, blue: 0.95)
    static let disabled = Color(red: 0.42, green: 0.45, blue: 0.50)
    static let ink = Color(red: 0.07, green: 0.09, blue: 0.14)
    static let input = Color(red: 0.98, green: 0.98, blue: 0.98)
    static let secure = Color(red: 0.25, green: 0.46, blue: 0.40)
}
