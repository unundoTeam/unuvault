import Foundation
import MacCompanionCore

let environment = ProcessInfo.processInfo.environment
let lanHost = environment["UNUVAULT_PAIRING_LAN_HOST"] ?? ""
let bindHost = environment["UNUVAULT_PAIRING_RECEIPT_BIND_HOST"] ?? "0.0.0.0"
let port = UInt16(environment["UNUVAULT_PAIRING_LAN_PORT"] ?? "17670") ?? 17670
let timeout = TimeInterval(environment["UNUVAULT_PAIRING_RECEIPT_TIMEOUT_SECONDS"] ?? "120") ?? 120
let now = Date()

func log(_ message: String) {
    FileHandle.standardOutput.write(Data("\(message)\n".utf8))
}

func base64URL(_ data: Data) -> String {
    data
        .base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
        .replacingOccurrences(of: "=", with: "")
}

guard lanHost.isEmpty == false else {
    log("UNUVAULT_PAIRING_RECEIPT_ERROR missing UNUVAULT_PAIRING_LAN_HOST")
    exit(1)
}

guard lanHost != "localhost",
      lanHost != "::1",
      lanHost.hasPrefix("127.") == false
else {
    log("UNUVAULT_PAIRING_RECEIPT_ERROR LAN host must be non-loopback, got \(lanHost)")
    exit(1)
}

let session = CompanionVaultSession(now: { now })
session.unlock(
    credentials: [
        CompanionCredential(
            id: "receipt-login",
            label: "receipt.example",
            username: "receipt-user",
            password: "receipt-password",
            profileId: "physical-receipt",
            websiteOrigin: "https://receipt.example"
        )
    ],
    ttl: timeout + 60
)

let pairingCoordinator = CompanionPairingSessionCoordinator(
    session: session,
    now: { now },
    makeSessionId: { "physical-receipt-session-\(UUID().uuidString)" },
    makeSessionNonce: { UUID().uuidString }
)
let service = CompanionBridgeService(session: session)
let codec = BridgeHTTPCodec(
    service: service,
    accessToken: "physical-receipt-token",
    pairingCoordinator: pairingCoordinator,
    pairingTransferKeyData: Data(repeating: 31, count: 32)
)
let server = LoopbackHTTPServer(codec: codec, port: port, bindHost: bindHost)

do {
    try server.start()

    let pairing = try pairingCoordinator.startSession(
        sourceDeviceId: "mac-physical-receipt-host",
        sourceDeviceDisplayName: "Yuchen MacBook Pro",
        ttl: timeout
    )
    let baseURL = try URL(
        string: "http://\(lanHost):\(port)"
    ).orThrow(message: "invalid LAN base URL")
    let invite = try CompanionPairingInviteBuilder().makeInvite(
        pairing: pairing,
        macBaseURL: baseURL
    )
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    let inviteData = try encoder.encode(invite)
    let encodedInvite = base64URL(inviteData)
    let deepLink = "unuvault-ioshost://pair?invite=\(encodedInvite)"

    log("UNUVAULT_PAIRING_RECEIPT_HOST_READY \(baseURL.absoluteString)")
    log("UNUVAULT_PAIRING_RECEIPT_INVITE_BASE64URL \(encodedInvite)")
    log("UNUVAULT_PAIRING_RECEIPT_DEEPLINK \(deepLink)")

    RunLoop.main.run(until: Date().addingTimeInterval(timeout))
    server.stop()
} catch {
    log("UNUVAULT_PAIRING_RECEIPT_ERROR \(error)")
    server.stop()
    exit(1)
}

private extension Optional where Wrapped == URL {
    func orThrow(message: String) throws -> URL {
        guard let value = self else {
            throw ReceiptHostError.invalidConfiguration(message)
        }

        return value
    }
}

private enum ReceiptHostError: Error {
    case invalidConfiguration(String)
}
