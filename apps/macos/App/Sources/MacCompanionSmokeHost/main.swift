import Foundation
import MacCompanionCore

let environment = ProcessInfo.processInfo.environment
let origin = environment["UNUVAULT_MAC_COMPANION_SMOKE_ORIGIN"] ?? "http://127.0.0.1:3001"
let profileId = environment["UNUVAULT_MAC_COMPANION_SMOKE_PROFILE_ID"] ?? "personal"
let accessToken = environment["UNUVAULT_MAC_COMPANION_SMOKE_TOKEN"] ?? "local-dev-bridge-token"
let port = UInt16(environment["UNUVAULT_MAC_COMPANION_SMOKE_PORT"] ?? "17666") ?? 17666

func log(_ message: String) {
    FileHandle.standardOutput.write(Data("\(message)\n".utf8))
}

let session = CompanionVaultSession()
session.unlock(
    credentials: [
        CompanionCredential(
            id: "github-login",
            label: "github.com",
            username: "mac-smoke-user",
            password: "mac-smoke-password",
            profileId: profileId,
            websiteOrigin: origin
        )
    ],
    ttl: 300
)

let service = CompanionBridgeService(session: session)
let codec = BridgeHTTPCodec(service: service, accessToken: accessToken)
let server = LoopbackHTTPServer(codec: codec, port: port)

do {
    try server.start()
} catch {
    log("unuvault-mac-companion-smoke-host failed: \(error)")
    exit(1)
}

let approvalTimer = Timer(timeInterval: 0.05, repeats: true) { _ in
    guard let approval = service.pendingApproval else {
        return
    }

    _ = service.approvePendingRelease(id: approval.id)
    log("unuvault-mac-companion-smoke-host approved \(approval.id)")
}

log("unuvault-mac-companion-smoke-host ready origin=\(origin) port=\(port)")
RunLoop.main.add(approvalTimer, forMode: .common)
RunLoop.main.run()
