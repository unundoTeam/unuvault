import XCTest
@testable import MacCompanionCore

final class CompanionVaultSessionTests: XCTestCase {
    func testLockedSessionDoesNotReturnCredentials() {
        let session = CompanionVaultSession(
            now: { Date(timeIntervalSince1970: 1_000) }
        )

        XCTAssertEqual(session.lockState, .locked)
        XCTAssertEqual(
            session.metadata(origin: "https://github.com", profileId: "personal"),
            []
        )
    }

    func testUnlockReturnsOnlyExactOriginMetadataUntilTimeout() {
        var now = Date(timeIntervalSince1970: 1_000)
        let session = CompanionVaultSession(now: { now })
        let github = CompanionCredential(
            id: "github-login",
            label: "github.com",
            username: "yuchen",
            password: "secret-github",
            profileId: "personal",
            websiteOrigin: "HTTPS://GitHub.com/login"
        )
        let apple = CompanionCredential(
            id: "apple-login",
            label: "apple.com",
            username: "me@example.com",
            password: "secret-apple",
            profileId: "personal",
            websiteOrigin: "https://apple.com"
        )

        session.unlock(credentials: [github, apple], ttl: 60)

        XCTAssertEqual(
            session.metadata(origin: "https://github.com/login", profileId: "personal"),
            [
                CompanionCredentialMetadata(
                    id: "github-login",
                    label: "github.com",
                    username: "yuchen"
                )
            ]
        )

        now = Date(timeIntervalSince1970: 1_061)

        XCTAssertEqual(
            session.metadata(origin: "https://github.com", profileId: "personal"),
            []
        )
        XCTAssertEqual(session.lockState, .attentionNeeded(reason: .unlockExpired))
    }

    func testLostDeviceClearsReleaseMaterial() {
        let session = CompanionVaultSession(
            now: { Date(timeIntervalSince1970: 1_000) }
        )
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
            ttl: 60
        )

        session.markLostDevice()

        XCTAssertEqual(session.lockState, .attentionNeeded(reason: .lostDevice))
        XCTAssertEqual(
            session.metadata(origin: "https://github.com", profileId: "personal"),
            []
        )
    }
}
