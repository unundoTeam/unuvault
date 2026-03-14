import XCTest
@testable import App

@MainActor
final class AutofillOnboardingViewTests: XCTestCase {
    func testAutofillOnboardingShowsEnableAutofill() {
        let view = AutofillOnboardingView()
        XCTAssertTrue(String(describing: view.body).contains("Enable AutoFill"))
    }
}
