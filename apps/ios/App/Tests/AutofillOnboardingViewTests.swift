import XCTest
@testable import App

final class AutofillOnboardingViewTests: XCTestCase {
    func testAutofillOnboardingShowsEnableAutofill() {
        let view = AutofillOnboardingView()
        XCTAssertTrue(String(describing: view.body).contains("Enable AutoFill"))
    }
}
