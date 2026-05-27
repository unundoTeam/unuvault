import XCTest
@testable import MacCompanionCore

final class PackageSmokeTests: XCTestCase {
    func testCompanionCredentialMetadataIsCodable() throws {
        let metadata = CompanionCredentialMetadata(
            id: "github-login",
            label: "github.com",
            username: "yuchen"
        )

        let data = try JSONEncoder().encode(metadata)
        let decoded = try JSONDecoder().decode(
            CompanionCredentialMetadata.self,
            from: data
        )

        XCTAssertEqual(decoded, metadata)
    }
}
