import Foundation
import ServiceManagement

enum ReceiptError: Error {
    case notBundled
    case bundleIdentifierMismatch(expected: String, actual: String?)
}

let arguments = Set(CommandLine.arguments.dropFirst())
let mutate = arguments.contains("--mutate")
let expectedBundleIdentifier = argumentValue(for: "--expected-bundle-id")
let cleanupAfterMutation = !arguments.contains("--no-cleanup")

do {
    try validateBundle(expectedBundleIdentifier: expectedBundleIdentifier)

    let initialStatus = SMAppService.mainApp.status
    printReceipt("status=running mode=\(mutate ? "mutating" : "read-only")")
    printReceipt("bundle_path=\(Bundle.main.bundleURL.path)")
    printReceipt("bundle_identifier=\(Bundle.main.bundleIdentifier ?? "unknown")")
    printReceipt("initial_status=\(statusLabel(initialStatus))")

    if mutate {
        try runMutationReceipt(initialStatus: initialStatus, cleanupAfterMutation: cleanupAfterMutation)
    } else {
        printReceipt("status=ready claim=packaged_app_login_item_status_read unclaimed=login_item_persistence_mutation")
    }
} catch {
    printReceipt("status=failed error=\(error)")
    exit(1)
}

func argumentValue(for flag: String) -> String? {
    let args = CommandLine.arguments
    guard let index = args.firstIndex(of: flag),
          args.indices.contains(args.index(after: index))
    else {
        return nil
    }
    return args[args.index(after: index)]
}

func validateBundle(expectedBundleIdentifier: String?) throws {
    let bundleURL = Bundle.main.bundleURL
    guard bundleURL.pathExtension == "app" else {
        throw ReceiptError.notBundled
    }

    if let expectedBundleIdentifier,
       Bundle.main.bundleIdentifier != expectedBundleIdentifier
    {
        throw ReceiptError.bundleIdentifierMismatch(
            expected: expectedBundleIdentifier,
            actual: Bundle.main.bundleIdentifier
        )
    }
}

func runMutationReceipt(
    initialStatus: SMAppService.Status,
    cleanupAfterMutation: Bool
) throws {
    guard initialStatus != .requiresApproval else {
        printReceipt("status=blocked reason=requires_approval_existing_login_item")
        printReceipt("status=ready claim=packaged_app_login_item_requires_approval_observed unclaimed=register_cleanup_receipt")
        return
    }

    printReceipt("mutates_system_login_items=true")
    try SMAppService.mainApp.register()
    let registeredStatus = SMAppService.mainApp.status
    printReceipt("after_register_status=\(statusLabel(registeredStatus))")

    if cleanupAfterMutation, initialStatus != .enabled {
        try SMAppService.mainApp.unregister()
        let cleanupStatus = SMAppService.mainApp.status
        printReceipt("after_cleanup_status=\(statusLabel(cleanupStatus))")
    }

    printReceipt("status=ready claim=packaged_app_login_item_register_cleanup_receipt unclaimed=notarization,apple_developer_signing")
}

func statusLabel(_ status: SMAppService.Status) -> String {
    switch status {
    case .enabled:
        "enabled"
    case .notRegistered:
        "disabled"
    case .requiresApproval:
        "requires_approval"
    case .notFound:
        "not_found"
    @unknown default:
        "unknown"
    }
}

func printReceipt(_ message: String) {
    print("UNUVAULT_MAC_LOGIN_ITEM_RECEIPT \(message)")
}
