import XCTest
@testable import MacCompanionCore

final class CompanionBridgeServiceTests: XCTestCase {
    func testLockedBridgeRejectsMetadataAndRelease() {
        let service = CompanionBridgeService(session: CompanionVaultSession())

        XCTAssertEqual(
            service.metadata(origin: "https://github.com", profileId: "personal"),
            .locked
        )
        XCTAssertEqual(
            service.requestRelease(
                id: "github-login",
                origin: "https://github.com",
                profileId: "personal",
                reason: "fill-active-page"
            ),
            .locked
        )
    }

    func testReleaseRequiresApprovalBeforeReturningSecret() {
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

        XCTAssertEqual(
            service.requestRelease(
                id: "github-login",
                origin: "https://github.com/login",
                profileId: "personal",
                reason: "fill-active-page"
            ),
            .approvalRequired(
                CompanionApprovalRequest(
                    id: "github-login",
                    origin: "https://github.com",
                    profileId: "personal",
                    label: "github.com",
                    username: "yuchen"
                )
            )
        )

        XCTAssertEqual(
            service.approvePendingRelease(id: "github-login"),
            .released(
                CompanionReleasedCredential(
                    username: "yuchen",
                    password: "secret-github"
                )
            )
        )

        XCTAssertEqual(service.pendingApproval, nil)
    }

    func testPendingApprovalIsClearedIfSessionLocksBeforeApproval() {
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

        XCTAssertEqual(
            service.requestRelease(
                id: "github-login",
                origin: "https://github.com",
                profileId: "personal",
                reason: "fill-active-page"
            ),
            .approvalRequired(
                CompanionApprovalRequest(
                    id: "github-login",
                    origin: "https://github.com",
                    profileId: "personal",
                    label: "github.com",
                    username: "yuchen"
                )
            )
        )

        session.lock()

        XCTAssertEqual(service.approvePendingRelease(id: "github-login"), .locked)
        XCTAssertEqual(service.pendingApproval, nil)
    }

    func testUnsupportedReleaseReasonFailsClosed() {
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

        XCTAssertEqual(
            service.requestRelease(
                id: "github-login",
                origin: "https://github.com",
                profileId: "personal",
                reason: "bulk-export"
            ),
            .invalidRequest
        )
    }
}
