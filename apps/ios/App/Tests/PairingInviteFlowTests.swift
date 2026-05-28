import XCTest
@testable import App

@MainActor
final class PairingInviteFlowTests: XCTestCase {
    func testPastedInviteShowsMacSummaryAndEnablesPairing() throws {
        let invite = makeInvite()
        let viewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) },
            targetIdentity: makeTarget(),
            exchange: { _, _ in throw PairingInviteFlowError.exchangeUnavailable }
        )

        viewModel.replaceInviteText(try inviteJSON(invite))

        XCTAssertEqual(viewModel.state, .ready)
        XCTAssertEqual(viewModel.macDisplayName, "Yuchen Mac")
        XCTAssertEqual(viewModel.macEndpointText, "http://192.168.1.42:17666")
        XCTAssertTrue(viewModel.canPair)
        XCTAssertEqual(
            viewModel.statusMessage,
            "Invite recognized. Pair only if this Mac is unlocked and trusted."
        )
    }

    func testExpiredInviteFailsClosedBeforeExchange() throws {
        let invite = makeInvite()
        var exchangeWasCalled = false
        let viewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_121) },
            targetIdentity: makeTarget(),
            exchange: { _, _ in
                exchangeWasCalled = true
                throw PairingInviteFlowError.exchangeUnavailable
            }
        )

        viewModel.replaceInviteText(try inviteJSON(invite))

        XCTAssertEqual(viewModel.state, .invalid)
        XCTAssertFalse(viewModel.canPair)
        XCTAssertFalse(exchangeWasCalled)
        XCTAssertEqual(
            viewModel.statusMessage,
            "Invite expired. Generate a fresh invite on your Mac."
        )
    }

    func testPairingUsesParsedInviteAndDoesNotExposeSecrets() async throws {
        let invite = makeInvite()
        let target = makeTarget()
        let expectedHandoff = makeHandoff(invite: invite, target: target)
        var capturedInvite: MacPairingInvite?
        var capturedTarget: PairingTargetIdentity?
        let viewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) },
            targetIdentity: target,
            exchange: { invite, target in
                capturedInvite = invite
                capturedTarget = target
                return expectedHandoff
            }
        )
        viewModel.replaceInviteText(try inviteJSON(invite))

        await viewModel.pair()

        XCTAssertEqual(viewModel.state, .paired)
        XCTAssertEqual(viewModel.handoff, expectedHandoff)
        XCTAssertEqual(capturedInvite, invite)
        XCTAssertEqual(capturedTarget, target)
        XCTAssertFalse(viewModel.statusMessage.contains("github-login"))
        XCTAssertFalse(viewModel.statusMessage.contains("secret-github"))
        XCTAssertFalse(viewModel.statusMessage.contains("password"))
    }

    func testPairingViewContainsExpectedReceiveFlowCopy() {
        let view = PairingInviteReceiveView(
            viewModel: PairingInviteViewModel(
                now: { Date(timeIntervalSince1970: 1_060) },
                targetIdentity: makeTarget(),
                exchange: { _, _ in throw PairingInviteFlowError.exchangeUnavailable }
            )
        )
        let renderedBody = String(describing: view.body)

        XCTAssertTrue(renderedBody.contains("Pair this iPhone"))
        XCTAssertTrue(renderedBody.contains("Mac invite"))
        XCTAssertTrue(renderedBody.contains("Pair"))
    }

    private func makeInvite() -> MacPairingInvite {
        MacPairingInvite(
            version: 1,
            macBaseURL: URL(string: "http://192.168.1.42:17666")!,
            pairing: MacPairingQRCodePayload(
                version: 1,
                sessionId: "pairing-session-1",
                sessionNonce: "pairing-nonce-1",
                sourceDeviceId: "mac-device-1",
                sourceDeviceDisplayName: "Yuchen Mac",
                createdAt: Date(timeIntervalSince1970: 1_000),
                expiresAt: Date(timeIntervalSince1970: 1_120)
            )
        )
    }

    private func makeTarget() -> PairingTargetIdentity {
        PairingTargetIdentity(
            deviceId: "ios-device-1",
            displayName: "Yuchen iPhone",
            publicKeyFingerprint: "ios-public-key-fingerprint"
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
                algorithm: "AES-GCM-256",
                nonce: "nonce-base64",
                ciphertext: "wrapped-ciphertext-base64",
                tag: "tag-base64"
            )
        )
    }

    private func inviteJSON(_ invite: MacPairingInvite) throws -> String {
        String(data: try JSONEncoder().encode(invite), encoding: .utf8) ?? ""
    }
}

private enum PairingInviteFlowError: Error {
    case exchangeUnavailable
}
