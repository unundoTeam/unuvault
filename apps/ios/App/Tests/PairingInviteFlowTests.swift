import SwiftUI
import CryptoKit
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
        XCTAssertEqual(viewModel.macInviteDetailText, "Local network • invite expires in 1 min")
        XCTAssertTrue(viewModel.canPair)
        XCTAssertEqual(
            viewModel.statusMessage,
            "Invite recognized. No vault items move until this iPhone sends a scoped pairing claim."
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

    func testExpiredExchangeDiscardsFailedAttemptAndAcceptsFreshInvite() async throws {
        let failedInvite = makeInvite()
        let viewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) },
            targetIdentity: makeTarget(),
            exchange: { _, _ in throw PairingExchangeClientError.httpStatus(410) }
        )
        let failedInviteText = try inviteJSON(failedInvite)
        viewModel.replaceInviteText(failedInviteText)

        await viewModel.pair()

        XCTAssertEqual(viewModel.state, .invalid)
        XCTAssertEqual(
            viewModel.statusMessage,
            "Invite expired. Generate a fresh invite on your Mac."
        )
        XCTAssertEqual(viewModel.pairingFailureDiagnostic, "httpStatus(410)")
        assertFailedAttemptWasDiscarded(viewModel, rawInvite: failedInviteText)

        viewModel.replaceInviteText(try inviteJSON(makeInvite()))

        XCTAssertEqual(viewModel.state, .ready)
        XCTAssertTrue(viewModel.canPair)
    }

    func testExchangeFailureDiscardsFailedAttemptAndPreservesSafeDiagnostic() async throws {
        let invite = makeInvite()
        let rawInvite = try inviteJSON(invite)
        let viewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) },
            targetIdentity: makeTarget(),
            exchange: { _, _ in throw PairingExchangeClientError.httpStatus(423) }
        )
        viewModel.replaceInviteText(rawInvite)

        await viewModel.pair()

        XCTAssertEqual(viewModel.state, .failed)
        XCTAssertEqual(
            viewModel.statusMessage,
            "Pairing failed. Generate a fresh invite on your Mac."
        )
        XCTAssertEqual(viewModel.pairingFailureDiagnostic, "httpStatus(423)")
        assertFailedAttemptWasDiscarded(viewModel, rawInvite: rawInvite)
    }

    func testPairingImportsParsedHandoffAndDoesNotExposeSecrets() async throws {
        let invite = makeInvite()
        let target = makeTarget()
        let expectedHandoff = makeHandoff(invite: invite, target: target)
        let expectedReceipt = makeImportReceipt(handoff: expectedHandoff)
        var capturedInvite: MacPairingInvite?
        var capturedTarget: PairingTargetIdentity?
        var importedHandoff: MacPairingHandoff?
        var importedTarget: PairingTargetIdentity?
        var stateObservedByImporter: PairingInviteFlowState?
        var viewModel: PairingInviteViewModel!
        viewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) },
            targetIdentity: target,
            exchange: { invite, target in
                capturedInvite = invite
                capturedTarget = target
                return expectedHandoff
            },
            handoffImporter: { handoff, target in
                stateObservedByImporter = viewModel.state
                importedHandoff = handoff
                importedTarget = target
                return expectedReceipt
            }
        )
        viewModel.replaceInviteText(try inviteJSON(invite))

        await viewModel.pair()

        XCTAssertEqual(stateObservedByImporter, .pairing)
        XCTAssertEqual(viewModel.state, .imported)
        XCTAssertEqual(viewModel.handoff, expectedHandoff)
        XCTAssertEqual(viewModel.importReceipt, expectedReceipt)
        XCTAssertEqual(viewModel.statusMessage, expectedReceipt.statusText)
        XCTAssertEqual(viewModel.pairingFailureDiagnostic, expectedReceipt.diagnostic)
        XCTAssertEqual(capturedInvite, invite)
        XCTAssertEqual(capturedTarget, target)
        XCTAssertEqual(importedHandoff, expectedHandoff)
        XCTAssertEqual(importedTarget, target)
        XCTAssertFalse(viewModel.statusMessage.contains("github-login"))
        XCTAssertFalse(viewModel.statusMessage.contains("secret-github"))
        XCTAssertFalse(viewModel.statusMessage.contains("password"))
    }

    func testImportCompletionRunsOnceAfterSafeImportedStateIsPublished() async throws {
        let invite = makeInvite()
        let target = makeTarget()
        let expectedHandoff = makeHandoff(invite: invite, target: target)
        let expectedReceipt = makeImportReceipt(handoff: expectedHandoff)
        var completionCallCount = 0
        var stateObservedByCompletion: PairingInviteFlowState?
        var receiptObservedByCompletion: PairingHandoffImportReceipt?
        var viewModel: PairingInviteViewModel!
        viewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) },
            targetIdentity: target,
            exchange: { _, _ in expectedHandoff },
            handoffImporter: { _, _ in expectedReceipt },
            onImportSucceeded: { receipt in
                completionCallCount += 1
                stateObservedByCompletion = viewModel.state
                receiptObservedByCompletion = viewModel.importReceipt
                XCTAssertEqual(receipt, expectedReceipt)
            }
        )
        viewModel.replaceInviteText(try inviteJSON(invite))

        await viewModel.pair()

        XCTAssertEqual(completionCallCount, 1)
        XCTAssertEqual(stateObservedByCompletion, .imported)
        XCTAssertEqual(receiptObservedByCompletion, expectedReceipt)
        XCTAssertEqual(viewModel.importReceipt, expectedReceipt)
    }

    func testPairingIsSingleFlightAndKeepsAcceptedInviteWhileExchangeIsSuspended() async throws {
        let acceptedInvite = makeInvite()
        var replacementInvite = makeInvite()
        replacementInvite = MacPairingInvite(
            version: replacementInvite.version,
            macBaseURL: replacementInvite.macBaseURL,
            pairing: MacPairingQRCodePayload(
                version: replacementInvite.pairing.version,
                sessionId: "pairing-session-2",
                sessionNonce: "pairing-nonce-2",
                sourceDeviceId: "mac-device-2",
                sourceDeviceDisplayName: "Other Mac",
                createdAt: replacementInvite.pairing.createdAt,
                expiresAt: replacementInvite.pairing.expiresAt
            )
        )
        let target = makeTarget()
        let exchange = SuspendedPairingExchange()
        let viewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) },
            targetIdentity: target,
            exchange: exchange.call,
            handoffImporter: { handoff, _ in
                self.makeImportReceipt(handoff: handoff)
            }
        )
        let acceptedInviteText = try inviteJSON(acceptedInvite)
        viewModel.replaceInviteText(acceptedInviteText)

        let firstPairTask = Task { await viewModel.pair() }
        await waitForExchangeCallCount(1, exchange: exchange)

        XCTAssertTrue(viewModel.isBusy)
        XCTAssertEqual(viewModel.state, .pairing)

        let secondPairTask = Task { await viewModel.pair() }
        await secondPairTask.value
        viewModel.replaceInviteText(try inviteJSON(replacementInvite))

        XCTAssertEqual(exchange.callCount, 1)
        XCTAssertEqual(viewModel.inviteText, acceptedInviteText)
        XCTAssertEqual(viewModel.macDisplayName, "Yuchen Mac")

        exchange.resume(with: makeHandoff(invite: acceptedInvite, target: target))
        await firstPairTask.value

        XCTAssertFalse(viewModel.isBusy)
        XCTAssertEqual(viewModel.state, .imported)
    }

    func testImportFailureDiscardsHandoffAndFailedAttempt() async throws {
        let invite = makeInvite()
        let target = makeTarget()
        let rawInvite = try inviteJSON(invite)
        let viewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) },
            targetIdentity: target,
            exchange: { _, _ in
                self.makeHandoff(invite: invite, target: target)
            },
            handoffImporter: { _, _ in
                throw SecretBearingImportFailure()
            }
        )
        viewModel.replaceInviteText(rawInvite)

        await viewModel.pair()

        XCTAssertEqual(viewModel.state, .importFailed)
        XCTAssertEqual(viewModel.statusMessage, "Import failed. Generate a fresh invite on your Mac.")
        XCTAssertEqual(viewModel.pairingFailureDiagnostic, "importFailed(unavailable)")
        XCTAssertFalse(viewModel.pairingFailureDiagnostic.contains("github-login"))
        XCTAssertFalse(viewModel.pairingFailureDiagnostic.contains("secret-github"))
        XCTAssertFalse(viewModel.pairingFailureDiagnostic.contains("password"))
        assertFailedAttemptWasDiscarded(viewModel, rawInvite: rawInvite)
    }

    func testPairingUsesInjectedTargetIdentityProvider() async throws {
        let invite = makeInvite()
        let providerTarget = PairingTargetIdentity(
            deviceId: "ios-provider-device",
            displayName: "Provider iPhone",
            publicKeyFingerprint: samplePublicKeyFingerprint,
            publicKeyAgreementDERBase64URL: samplePublicKeyAgreementDERBase64URL
        )
        var providerCallCount = 0
        var capturedTarget: PairingTargetIdentity?
        let viewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) },
            targetIdentityProvider: {
                providerCallCount += 1
                return providerTarget
            },
            exchange: { _, target in
                capturedTarget = target
                return self.makeHandoff(invite: invite, target: target)
            },
            handoffImporter: { handoff, _ in
                self.makeImportReceipt(handoff: handoff)
            }
        )
        viewModel.replaceInviteText(try inviteJSON(invite))

        await viewModel.pair()

        XCTAssertEqual(providerCallCount, 1)
        XCTAssertEqual(capturedTarget, providerTarget)
        XCTAssertEqual(viewModel.handoff?.targetDeviceId, providerTarget.deviceId)
        XCTAssertEqual(viewModel.handoff?.targetDeviceDisplayName, providerTarget.displayName)
        XCTAssertEqual(
            viewModel.handoff?.targetPublicKeyFingerprint,
            providerTarget.publicKeyFingerprint
        )
        XCTAssertEqual(viewModel.importReceipt?.importedCredentialCount, 1)
    }

    func testPairingFailureKeepsDiagnosticForReceiptHarness() async throws {
        let invite = makeInvite()
        let viewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) },
            targetIdentity: makeTarget(),
            exchange: { _, _ in throw PairingExchangeClientError.httpStatus(423) }
        )
        viewModel.replaceInviteText(try inviteJSON(invite))

        await viewModel.pair()

        XCTAssertEqual(viewModel.state, .failed)
        XCTAssertNil(viewModel.handoff)
        XCTAssertTrue(viewModel.pairingFailureDiagnostic.contains("httpStatus(423)"))
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

        XCTAssertTrue(renderedBody.contains("Pair with your Mac"))
        XCTAssertTrue(renderedBody.contains("Receive invite"))
        XCTAssertTrue(renderedBody.contains("Paste invite"))
        XCTAssertFalse(renderedBody.contains("Pair this iPhone"))
        XCTAssertFalse(renderedBody.contains("Mac invite"))
        XCTAssertTrue(renderedBody.contains("Pair"))
    }

    func testPairingViewAccessibilityContractCoversDynamicTypeVoiceOverAndTargets() {
        XCTAssertGreaterThanOrEqual(
            PairingInviteAccessibilityContract.minimumTouchTargetPoints,
            44
        )
        XCTAssertGreaterThanOrEqual(
            PairingInviteAccessibilityContract.primaryActionMinHeightPoints,
            PairingInviteAccessibilityContract.minimumTouchTargetPoints
        )
        XCTAssertGreaterThanOrEqual(
            PairingInviteAccessibilityContract.textEditorMinHeightPoints,
            PairingInviteAccessibilityContract.minimumTouchTargetPoints
        )
        XCTAssertTrue(
            PairingInviteAccessibilityContract.dynamicTypeProofSizes.contains(
                PairingInviteAccessibilityContract.dynamicTypeProofSize
            )
        )
        XCTAssertEqual(
            PairingInviteAccessibilityContract.dynamicTypeProofSize,
            .accessibility3
        )
        XCTAssertEqual(
            PairingInviteAccessibilityContract.dynamicTypeProofSizeName,
            "accessibility3"
        )
        XCTAssertEqual(PairingInviteAccessibilityContract.title, "Pair with your Mac")
        XCTAssertEqual(PairingInviteAccessibilityContract.inviteRecognized, "Invite recognized")
        XCTAssertEqual(PairingInviteAccessibilityContract.pasteInvite, "Paste invite")
        XCTAssertEqual(PairingInviteAccessibilityContract.inviteText, "Invite text")
        XCTAssertEqual(PairingInviteAccessibilityContract.pair, "Pair")
        XCTAssertEqual(
            PairingInviteAccessibilityContract.recognizedMacLabel("Yuchen Mac"),
            "Recognized Mac Yuchen Mac"
        )
        XCTAssertEqual(
            PairingInviteAccessibilityContract.recognizedMacLabel(""),
            "Recognized Mac waiting for invite"
        )
    }

    func testPairingViewHidesRawInviteAfterRecognition() throws {
        let invite = makeInvite()
        let viewModel = PairingInviteViewModel(
            now: { Date(timeIntervalSince1970: 1_060) },
            targetIdentity: makeTarget(),
            exchange: { _, _ in throw PairingInviteFlowError.exchangeUnavailable }
        )
        viewModel.replaceInviteText(try inviteJSON(invite))

        let renderedBody = String(describing: PairingInviteReceiveView(viewModel: viewModel).body)

        XCTAssertTrue(renderedBody.contains("Raw invite text stays hidden after it is recognized."))
        XCTAssertTrue(renderedBody.contains("Invite recognized"))
        XCTAssertTrue(renderedBody.contains("Local network • invite expires in 1 min"))
        XCTAssertFalse(renderedBody.contains("pairing-session-1"))
        XCTAssertFalse(renderedBody.contains("pairing-nonce-1"))
        XCTAssertFalse(renderedBody.contains("mac-device-1"))
        XCTAssertFalse(renderedBody.contains("192.168.1.42"))
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
            publicKeyFingerprint: samplePublicKeyFingerprint,
            publicKeyAgreementDERBase64URL: samplePublicKeyAgreementDERBase64URL
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
                algorithm: "P256-HKDF-SHA256-AES-GCM-256",
                senderPublicKeyAgreementDERBase64URL: samplePublicKeyAgreementDERBase64URL,
                nonce: "nonce-base64",
                ciphertext: "wrapped-ciphertext-base64",
                tag: "tag-base64"
            )
        )
    }

    private func makeImportReceipt(handoff: MacPairingHandoff) -> PairingHandoffImportReceipt {
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

    private func assertFailedAttemptWasDiscarded(
        _ viewModel: PairingInviteViewModel,
        rawInvite: String,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertEqual(viewModel.inviteText, "", file: file, line: line)
        XCTAssertNil(viewModel.handoff, file: file, line: line)
        XCTAssertNil(viewModel.importReceipt, file: file, line: line)
        XCTAssertEqual(viewModel.macDisplayName, "", file: file, line: line)
        XCTAssertEqual(viewModel.macEndpointText, "", file: file, line: line)
        XCTAssertEqual(viewModel.macInviteDetailText, "", file: file, line: line)
        XCTAssertFalse(viewModel.canPair, file: file, line: line)

        let renderedBody = String(describing: PairingInviteReceiveView(viewModel: viewModel).body)
        XCTAssertTrue(renderedBody.contains("Paste invite"), file: file, line: line)
        XCTAssertTrue(renderedBody.contains("Paste invite from Mac"), file: file, line: line)
        XCTAssertFalse(renderedBody.contains("Yuchen Mac"), file: file, line: line)
        XCTAssertFalse(renderedBody.contains(rawInvite), file: file, line: line)
        XCTAssertFalse(renderedBody.contains("192.168.1.42"), file: file, line: line)
    }

    private func waitForExchangeCallCount(
        _ expected: Int,
        exchange: SuspendedPairingExchange,
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
private final class SuspendedPairingExchange {
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

private enum PairingInviteFlowError: Error {
    case exchangeUnavailable
}

private struct SecretBearingImportFailure: Error, CustomStringConvertible {
    var description: String {
        "secret-github password github-login"
    }
}

private let samplePrivateKey = P256.KeyAgreement.PrivateKey()
private let samplePublicKeyAgreementDER = samplePrivateKey.publicKey.derRepresentation
private let samplePublicKeyAgreementDERBase64URL = samplePublicKeyAgreementDER
    .base64URLEncodedString()
private let samplePublicKeyFingerprint = "sha256:\(SHA256.hash(data: samplePublicKeyAgreementDER).hexString)"

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

private extension SHA256.Digest {
    var hexString: String {
        map { String(format: "%02x", $0) }.joined()
    }
}
