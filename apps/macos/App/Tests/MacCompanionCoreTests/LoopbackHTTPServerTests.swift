import Foundation
import XCTest
@testable import MacCompanionCore

final class LoopbackHTTPServerTests: XCTestCase {
    func testLoopbackReleaseRequiresNativeApprovalBeforeOneTimeClaim() async throws {
        let session = CompanionVaultSession()
        session.unlock(
            credentials: [
                CompanionCredential(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen",
                    password: "secret-github",
                    profileId: "personal",
                    websiteOrigin: "https://github.com"
                )
            ],
            ttl: 300
        )
        let service = CompanionBridgeService(session: session)
        let codec = BridgeHTTPCodec(service: service, accessToken: "bridge-token")
        let server = LoopbackHTTPServer(codec: codec, port: 17667)
        try server.start()
        defer { server.stop() }

        try await waitForServer(at: URL(string: "http://127.0.0.1:17667/status")!)

        let release = try await postJSON(
            url: URL(string: "http://127.0.0.1:17667/v1/credentials/release")!,
            token: "bridge-token",
            body: """
            {"id":"github-login","origin":"https://github.com/login","profileId":"personal","reason":"fill-active-page"}
            """
        )

        XCTAssertEqual(release.statusCode, 409)
        XCTAssertTrue(release.body.contains("approval_required"))
        XCTAssertFalse(release.body.contains("secret-github"))

        let httpApprove = try await postJSON(
            url: URL(string: "http://127.0.0.1:17667/v1/credentials/approve")!,
            token: "bridge-token",
            body: """
            {"id":"github-login"}
            """
        )

        XCTAssertEqual(httpApprove.statusCode, 404)
        XCTAssertFalse(httpApprove.body.contains("secret-github"))
        XCTAssertEqual(service.pendingApproval?.id, "github-login")

        XCTAssertEqual(
            service.approvePendingRelease(id: "github-login"),
            .released(
                CompanionReleasedCredential(
                    username: "yuchen",
                    password: "secret-github"
                )
            )
        )

        let claim = try await postJSON(
            url: URL(string: "http://127.0.0.1:17667/v1/credentials/claim")!,
            token: "bridge-token",
            body: """
            {"id":"github-login","origin":"https://github.com/login","profileId":"personal"}
            """
        )

        XCTAssertEqual(claim.statusCode, 200)
        XCTAssertTrue(claim.body.contains("secret-github"))

        let secondClaim = try await postJSON(
            url: URL(string: "http://127.0.0.1:17667/v1/credentials/claim")!,
            token: "bridge-token",
            body: """
            {"id":"github-login","origin":"https://github.com/login","profileId":"personal"}
            """
        )

        XCTAssertEqual(secondClaim.statusCode, 404)
        XCTAssertFalse(secondClaim.body.contains("secret-github"))
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
        token: String,
        body: String
    ) async throws -> (statusCode: Int, body: String) {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = Data(body.utf8)

        let (data, response) = try await URLSession.shared.data(for: request)
        return (
            (response as? HTTPURLResponse)?.statusCode ?? 0,
            String(data: data, encoding: .utf8) ?? ""
        )
    }
}
