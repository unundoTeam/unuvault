import ServiceManagement
import XCTest
@testable import UnuVaultMacCompanion

@MainActor
final class CompanionLaunchAtLoginTests: XCTestCase {
    func testServiceManagementStatusMappingDoesNotClaimRuntimeRegistration() {
        XCTAssertEqual(ServiceManagementLaunchAtLoginController.mapStatus(.enabled), .enabled)
        XCTAssertEqual(ServiceManagementLaunchAtLoginController.mapStatus(.notRegistered), .disabled)
        XCTAssertEqual(
            ServiceManagementLaunchAtLoginController.mapStatus(.requiresApproval),
            .requiresApproval
        )
        XCTAssertEqual(ServiceManagementLaunchAtLoginController.mapStatus(.notFound), .unavailable)
    }

    func testLaunchAtLoginStatusUsesControllerWithoutTouchingVault() {
        let controller = RecordingLaunchAtLoginController(status: .disabled)
        let viewModel = CompanionViewModel(
            vaultStore: nil,
            launchAtLoginController: controller
        )

        XCTAssertEqual(viewModel.launchAtLoginStatus, .disabled)
        XCTAssertEqual(controller.statusReadCount, 1)
        XCTAssertEqual(viewModel.launchAtLoginStatusText, L10n.string("install.login_item.disabled"))
    }

    func testLaunchAtLoginToggleStateFollowsStatus() {
        let enabledController = RecordingLaunchAtLoginController(status: .enabled)
        let enabledViewModel = CompanionViewModel(
            vaultStore: nil,
            launchAtLoginController: enabledController
        )
        let disabledController = RecordingLaunchAtLoginController(status: .disabled)
        let disabledViewModel = CompanionViewModel(
            vaultStore: nil,
            launchAtLoginController: disabledController
        )
        let approvalController = RecordingLaunchAtLoginController(status: .requiresApproval)
        let approvalViewModel = CompanionViewModel(
            vaultStore: nil,
            launchAtLoginController: approvalController
        )

        XCTAssertTrue(enabledViewModel.isLaunchAtLoginEnabled)
        XCTAssertFalse(disabledViewModel.isLaunchAtLoginEnabled)
        XCTAssertFalse(approvalViewModel.isLaunchAtLoginEnabled)
    }

    func testEnablingLaunchAtLoginCallsControllerAndRefreshesStatus() {
        let controller = RecordingLaunchAtLoginController(status: .disabled)
        let viewModel = CompanionViewModel(
            vaultStore: nil,
            launchAtLoginController: controller
        )

        viewModel.setLaunchAtLoginEnabled(true)

        XCTAssertEqual(controller.enabledRequests, [true])
        XCTAssertEqual(viewModel.launchAtLoginStatus, .enabled)
        XCTAssertEqual(viewModel.launchAtLoginStatusText, L10n.string("install.login_item.enabled"))
    }

    func testLaunchAtLoginFailureKeepsStatusUnavailable() {
        let controller = RecordingLaunchAtLoginController(
            status: .disabled,
            error: LaunchAtLoginControllerError.unavailable
        )
        let viewModel = CompanionViewModel(
            vaultStore: nil,
            launchAtLoginController: controller
        )

        viewModel.setLaunchAtLoginEnabled(true)

        XCTAssertEqual(controller.enabledRequests, [true])
        XCTAssertEqual(viewModel.launchAtLoginStatus, .unavailable)
        XCTAssertEqual(viewModel.launchAtLoginStatusText, L10n.string("install.login_item.unavailable"))
    }
}

private final class RecordingLaunchAtLoginController: LaunchAtLoginControlling {
    private var currentStatus: LaunchAtLoginStatus
    private let error: Error?
    private(set) var enabledRequests: [Bool] = []
    private(set) var statusReadCount = 0

    init(
        status: LaunchAtLoginStatus,
        error: Error? = nil
    ) {
        self.currentStatus = status
        self.error = error
    }

    var status: LaunchAtLoginStatus {
        statusReadCount += 1
        return currentStatus
    }

    func setEnabled(_ enabled: Bool) throws {
        enabledRequests.append(enabled)

        if let error {
            throw error
        }

        currentStatus = enabled ? .enabled : .disabled
    }
}
