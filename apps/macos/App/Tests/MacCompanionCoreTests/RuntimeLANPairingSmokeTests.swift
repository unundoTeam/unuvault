import Foundation
import XCTest
@testable import MacCompanionCore
@testable import UnuVaultMacCompanion

@MainActor
final class RuntimeLANPairingSmokeTests: XCTestCase {
    func testLANBoundPairingClaimRoundTripsWrappedHandoffWithoutSecrets() async throws {
        let environment = ProcessInfo.processInfo.environment
        guard let lanHost = environment["UNUVAULT_PAIRING_LAN_HOST"],
              !lanHost.isEmpty
        else {
            throw XCTSkip("Set UNUVAULT_PAIRING_LAN_HOST to run LAN pairing smoke proof")
        }
        XCTAssertFalse(Self.isLoopbackHost(lanHost))

        let port = UInt16(environment["UNUVAULT_PAIRING_LAN_PORT"] ?? "") ?? 17669
        let baseURL = try XCTUnwrap(URL(string: "http://\(lanHost):\(port)"))
        let vaultDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("unuvault-lan-pairing-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(
            at: vaultDirectory,
            withIntermediateDirectories: true
        )

        let viewModel = CompanionAppConfiguration.makeViewModel(
            environment: [
                "UNUVAULT_MAC_COMPANION_PROOF": "1",
                "UNUVAULT_MAC_COMPANION_PROOF_BIND_HOST": "0.0.0.0",
                "UNUVAULT_MAC_COMPANION_PROOF_PORT": "\(port)",
                "UNUVAULT_MAC_COMPANION_PROOF_PAIRING_BASE_URL": baseURL.absoluteString,
                "UNUVAULT_MAC_COMPANION_PROOF_VAULT_DIR": vaultDirectory.path,
                "UNUVAULT_MAC_COMPANION_PROOF_ORIGIN": "https://github.com",
                "UNUVAULT_MAC_COMPANION_PROOF_CREDENTIAL_ID": "github-login",
                "UNUVAULT_MAC_COMPANION_PROOF_LABEL": "github.com",
                "UNUVAULT_MAC_COMPANION_PROOF_USERNAME": "mac-lan-user",
                "UNUVAULT_MAC_COMPANION_PROOF_PASSWORD": "mac-lan-password"
            ]
        )
        viewModel.start()
        defer {
            viewModel.stop()
            try? FileManager.default.removeItem(at: vaultDirectory)
        }

        try await waitForServer(at: baseURL.appendingPathComponent("status"))
        viewModel.pairIPhone()

        let inviteText = try XCTUnwrap(viewModel.pairingInviteText)
        let invite = try JSONDecoder().decode(
            LANPairingInviteEnvelope.self,
            from: Data(inviteText.utf8)
        )

        XCTAssertEqual(invite.macBaseURL, baseURL)
        XCTAssertFalse(inviteText.contains("github-login"))
        XCTAssertFalse(inviteText.contains("mac-lan-user"))
        XCTAssertFalse(inviteText.contains("mac-lan-password"))

        let targetDeviceId = "ios-lan-device-1"
        let targetFingerprint = "ios-lan-public-key-fingerprint"
        let body = """
        {
          "sessionId": "\(invite.pairing.sessionId)",
          "sessionNonce": "\(invite.pairing.sessionNonce)",
          "target": {
            "deviceId": "\(targetDeviceId)",
            "displayName": "LAN iPhone",
            "publicKeyFingerprint": "\(targetFingerprint)"
          }
        }
        """
        let claimURL = baseURL
            .appendingPathComponent("v1")
            .appendingPathComponent("pairing")
            .appendingPathComponent("claim")
        let firstClaim = try await postJSON(url: claimURL, body: body)

        XCTAssertEqual(firstClaim.statusCode, 200)
        XCTAssertFalse(firstClaim.body.contains("github-login"))
        XCTAssertFalse(firstClaim.body.contains("mac-lan-user"))
        XCTAssertFalse(firstClaim.body.contains("mac-lan-password"))

        let envelope = try JSONDecoder().decode(
            LANPairingClaimEnvelope.self,
            from: Data(firstClaim.body.utf8)
        )
        XCTAssertEqual(envelope.handoff.handoffId, invite.pairing.sessionId)
        XCTAssertEqual(envelope.handoff.targetDeviceId, targetDeviceId)
        XCTAssertEqual(envelope.handoff.targetPublicKeyFingerprint, targetFingerprint)
        XCTAssertEqual(envelope.handoff.material.algorithm, "AES-GCM-256")

        let replayClaim = try await postJSON(url: claimURL, body: body)

        XCTAssertEqual(replayClaim.statusCode, 409)
        XCTAssertFalse(replayClaim.body.contains("github-login"))
        XCTAssertFalse(replayClaim.body.contains("mac-lan-user"))
        XCTAssertFalse(replayClaim.body.contains("mac-lan-password"))
    }

    private static func isLoopbackHost(_ host: String) -> Bool {
        host == "127.0.0.1" || host == "localhost" || host == "::1"
    }

    private func waitForServer(at url: URL) async throws {
        for _ in 0..<40 {
            do {
                let (_, response) = try await URLSession.shared.data(from: url)
                if (response as? HTTPURLResponse)?.statusCode == 200 {
                    return
                }
            } catch {
                try await Task.sleep(nanoseconds: 50_000_000)
            }
        }

        XCTFail("LAN-bound pairing server did not become ready at \(url.absoluteString)")
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

private struct LANPairingClaimEnvelope: Decodable {
    let handoff: CompanionPairingHandoff
}

private struct LANPairingInviteEnvelope: Decodable {
    let macBaseURL: URL
    let pairing: CompanionPairingQRCodePayload
}
