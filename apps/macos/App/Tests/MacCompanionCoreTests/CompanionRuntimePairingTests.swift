import Foundation
import XCTest
@testable import MacCompanionCore
@testable import UnuVaultMacCompanion

@MainActor
final class CompanionRuntimePairingTests: XCTestCase {
    func testRuntimeLoopbackPairingClaimUsesStartedSessionWithoutBearer() async throws {
        let port: UInt16 = 17668
        let vaultDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("unuvault-runtime-pairing-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(
            at: vaultDirectory,
            withIntermediateDirectories: true
        )

        let viewModel = CompanionAppConfiguration.makeViewModel(
            environment: [
                "UNUVAULT_MAC_COMPANION_PROOF": "1",
                "UNUVAULT_MAC_COMPANION_PROOF_PORT": "\(port)",
                "UNUVAULT_MAC_COMPANION_PROOF_PAIRING_BASE_URL": "http://192.168.1.42:\(port)",
                "UNUVAULT_MAC_COMPANION_PROOF_VAULT_DIR": vaultDirectory.path,
                "UNUVAULT_MAC_COMPANION_PROOF_ORIGIN": "https://github.com",
                "UNUVAULT_MAC_COMPANION_PROOF_CREDENTIAL_ID": "github-login",
                "UNUVAULT_MAC_COMPANION_PROOF_LABEL": "github.com",
                "UNUVAULT_MAC_COMPANION_PROOF_USERNAME": "yuchen",
                "UNUVAULT_MAC_COMPANION_PROOF_PASSWORD": "secret-github"
            ]
        )
        viewModel.start()
        defer {
            viewModel.stop()
            try? FileManager.default.removeItem(at: vaultDirectory)
        }

        try await waitForServer(at: URL(string: "http://127.0.0.1:\(port)/status")!)
        viewModel.pairIPhone()

        guard let payload = viewModel.pairingPayload else {
            return XCTFail("Expected pairIPhone() to create a QR pairing payload")
        }
        let inviteText = try XCTUnwrap(viewModel.pairingInviteText)
        let invite = try JSONDecoder().decode(
            RuntimePairingInviteEnvelope.self,
            from: Data(inviteText.utf8)
        )
        XCTAssertEqual(invite.macBaseURL.absoluteString, "http://192.168.1.42:\(port)")
        XCTAssertEqual(invite.pairing.sessionId, payload.sessionId)
        XCTAssertEqual(invite.pairing.sessionNonce, payload.sessionNonce)
        XCTAssertFalse(inviteText.contains("github-login"))
        XCTAssertFalse(inviteText.contains("yuchen"))
        XCTAssertFalse(inviteText.contains("secret-github"))

        let claim = try await postJSON(
            url: URL(string: "http://127.0.0.1:\(port)/v1/pairing/claim")!,
            body: """
            {
              "sessionId": "\(payload.sessionId)",
              "sessionNonce": "\(payload.sessionNonce)",
              "target": {
                "deviceId": "ios-device-1",
                "displayName": "Yuchen iPhone",
                "publicKeyFingerprint": "ios-public-key-fingerprint"
              }
            }
            """
        )

        XCTAssertEqual(claim.statusCode, 200)
        XCTAssertTrue(claim.body.contains("\"handoff\""))
        XCTAssertFalse(claim.body.contains("github-login"))
        XCTAssertFalse(claim.body.contains("yuchen"))
        XCTAssertFalse(claim.body.contains("secret-github"))

        let envelope = try JSONDecoder().decode(
            RuntimePairingClaimEnvelope.self,
            from: Data(claim.body.utf8)
        )
        XCTAssertEqual(envelope.handoff.handoffId, payload.sessionId)
        XCTAssertEqual(envelope.handoff.targetDeviceId, "ios-device-1")
        XCTAssertEqual(
            envelope.handoff.targetPublicKeyFingerprint,
            "ios-public-key-fingerprint"
        )
    }

    private func waitForServer(at url: URL) async throws {
        for _ in 0..<20 {
            do {
                let (_, response) = try await URLSession.shared.data(from: url)
                if (response as? HTTPURLResponse)?.statusCode == 200 {
                    return
                }
            } catch {
                try await Task.sleep(nanoseconds: 50_000_000)
            }
        }

        XCTFail("Loopback server did not become ready")
    }

    private func postJSON(
        url: URL,
        body: String
    ) async throws -> (statusCode: Int, body: String) {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = Data(body.utf8)

        let (data, response) = try await URLSession.shared.data(for: request)
        return (
            (response as? HTTPURLResponse)?.statusCode ?? 0,
            String(data: data, encoding: .utf8) ?? ""
        )
    }
}

private struct RuntimePairingClaimEnvelope: Decodable {
    let handoff: CompanionPairingHandoff
}

private struct RuntimePairingInviteEnvelope: Decodable {
    let macBaseURL: URL
    let pairing: CompanionPairingQRCodePayload
}
