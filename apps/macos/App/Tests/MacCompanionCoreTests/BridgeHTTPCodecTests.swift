import XCTest
@testable import MacCompanionCore

final class BridgeHTTPCodecTests: XCTestCase {
    func testStatusResponseDoesNotExposeSecrets() {
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
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: session),
            accessToken: "bridge-token"
        )

        let response = codec.handle(
            method: "GET",
            path: "/status",
            headers: [:],
            body: Data()
        )

        XCTAssertEqual(response.statusCode, 200)
        XCTAssertTrue(response.bodyString.contains("\"state\":\"unlocked\""))
        XCTAssertFalse(response.bodyString.contains("secret-github"))
    }

    func testReleaseRequiresBearerToken() {
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: CompanionVaultSession()),
            accessToken: "bridge-token"
        )

        let response = codec.handle(
            method: "POST",
            path: "/v1/credentials/release",
            headers: [:],
            body: Data()
        )

        XCTAssertEqual(response.statusCode, 401)
        XCTAssertTrue(response.bodyString.contains("invalid_bridge_token"))
    }

    func testCredentialMetadataResponseUsesActiveOriginOnly() {
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
                ),
                CompanionCredential(
                    id: "apple-login",
                    label: "apple.com",
                    username: "me@example.com",
                    password: "secret-apple",
                    profileId: "personal",
                    websiteOrigin: "https://apple.com"
                )
            ],
            ttl: 300
        )
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: session),
            accessToken: "bridge-token"
        )

        let response = codec.handle(
            method: "GET",
            path: "/v1/credentials?origin=https%3A%2F%2Fgithub.com%2Flogin&profileId=personal",
            headers: ["authorization": "Bearer bridge-token"],
            body: Data()
        )

        XCTAssertEqual(response.statusCode, 200)
        XCTAssertTrue(response.bodyString.contains("github-login"))
        XCTAssertFalse(response.bodyString.contains("apple-login"))
        XCTAssertFalse(response.bodyString.contains("secret-github"))
    }

    func testReleaseResponseCreatesApprovalRequestBeforeSecretRelease() {
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
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: session),
            accessToken: "bridge-token"
        )

        let releaseResponse = codec.handle(
            method: "POST",
            path: "/v1/credentials/release",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"github-login","origin":"https://github.com/login","profileId":"personal","reason":"fill-active-page"}
            """.utf8)
        )

        XCTAssertEqual(releaseResponse.statusCode, 409)
        XCTAssertTrue(releaseResponse.bodyString.contains("approval_required"))
        XCTAssertFalse(releaseResponse.bodyString.contains("secret-github"))

        let approveResponse = codec.handle(
            method: "POST",
            path: "/v1/credentials/approve",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"github-login"}
            """.utf8)
        )

        XCTAssertEqual(approveResponse.statusCode, 200)
        XCTAssertTrue(approveResponse.bodyString.contains("secret-github"))
    }

    func testDenyPendingReleaseClearsApprovalWithoutSecret() {
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
        let codec = BridgeHTTPCodec(
            service: CompanionBridgeService(session: session),
            accessToken: "bridge-token"
        )

        _ = codec.handle(
            method: "POST",
            path: "/v1/credentials/release",
            headers: [
                "Authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"github-login","origin":"https://github.com","profileId":"personal","reason":"fill-active-page"}
            """.utf8)
        )

        let denyResponse = codec.handle(
            method: "POST",
            path: "/v1/credentials/deny",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"github-login"}
            """.utf8)
        )

        XCTAssertEqual(denyResponse.statusCode, 200)
        XCTAssertTrue(denyResponse.bodyString.contains("\"status\":\"denied\""))
        XCTAssertFalse(denyResponse.bodyString.contains("secret-github"))

        let approveResponse = codec.handle(
            method: "POST",
            path: "/v1/credentials/approve",
            headers: [
                "authorization": "Bearer bridge-token",
                "content-type": "application/json"
            ],
            body: Data("""
            {"id":"github-login"}
            """.utf8)
        )

        XCTAssertEqual(approveResponse.statusCode, 404)
        XCTAssertFalse(approveResponse.bodyString.contains("secret-github"))
    }
}
