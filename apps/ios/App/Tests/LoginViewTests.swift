import XCTest
@testable import App

@MainActor
final class LoginViewTests: XCTestCase {
    func testLoginViewShowsSecureSyncMessage() {
        let view = LoginView()
        let renderedBody = String(describing: view.body)

        XCTAssertTrue(renderedBody.contains("securely synced"))
    }
}
