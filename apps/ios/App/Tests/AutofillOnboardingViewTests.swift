import XCTest
@testable import App

@MainActor
final class AutofillOnboardingViewTests: XCTestCase {
    func testAutofillOnboardingShowsEnableAutofill() {
        let view = AutofillOnboardingView()
        let renderedBody = String(describing: view.body)

        XCTAssertTrue(renderedBody.contains("Enable AutoFill"))
    }
}
