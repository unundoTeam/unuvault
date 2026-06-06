import Foundation
import ServiceManagement

enum LaunchAtLoginStatus: Equatable {
    case enabled
    case disabled
    case requiresApproval
    case unavailable
}

enum LaunchAtLoginControllerError: Error {
    case unavailable
}

@MainActor
protocol LaunchAtLoginControlling: AnyObject {
    var status: LaunchAtLoginStatus { get }
    func setEnabled(_ enabled: Bool) throws
}

@MainActor
final class ServiceManagementLaunchAtLoginController: LaunchAtLoginControlling {
    var status: LaunchAtLoginStatus {
        Self.mapStatus(SMAppService.mainApp.status)
    }

    static func mapStatus(_ status: SMAppService.Status) -> LaunchAtLoginStatus {
        switch status {
        case .enabled:
            .enabled
        case .notRegistered:
            .disabled
        case .requiresApproval:
            .requiresApproval
        case .notFound:
            .unavailable
        @unknown default:
            .unavailable
        }
    }

    func setEnabled(_ enabled: Bool) throws {
        if enabled {
            guard status != .enabled else {
                return
            }

            try SMAppService.mainApp.register()
            return
        }

        guard status != .disabled else {
            return
        }

        try SMAppService.mainApp.unregister()
    }
}
