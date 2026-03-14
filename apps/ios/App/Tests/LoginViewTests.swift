import XCTest
@testable import App

final class LoginViewTests: XCTestCase {
    func testLoginViewShowsSecureSyncMessage() {
        let view = LoginView()
        XCTAssertTrue(String(describing: view.body).contains("securely synced"))
    }
}
