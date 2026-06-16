import Darwin
import Foundation
import LocalAuthentication

@main
struct MacLocalAuthenticationPromptReceiptHost {
    static func main() async {
        var shouldPrompt = false
        var timeoutSeconds: UInt64 = 12
        var reason = "解锁这台 Mac 上的本地保险库"
        var cancelTitle = "取消"

        var iterator = CommandLine.arguments.dropFirst().makeIterator()

        while let argument = iterator.next() {
            switch argument {
            case "--prompt":
                shouldPrompt = true
            case "--reason":
                guard let value = iterator.next() else {
                    record("status=failed error=missing_reason")
                    exit(2)
                }
                reason = value
            case "--cancel-title":
                guard let value = iterator.next() else {
                    record("status=failed error=missing_cancel_title")
                    exit(2)
                }
                cancelTitle = value
            case "--timeout-seconds":
                guard
                    let value = iterator.next(),
                    let parsed = UInt64(value),
                    parsed > 0
                else {
                    record("status=failed error=invalid_timeout")
                    exit(2)
                }
                timeoutSeconds = parsed
            case "--help", "-h":
                print("""
                Usage: MacLocalAuthenticationPromptReceiptHost [--prompt] [--reason <text>] [--cancel-title <text>] [--timeout-seconds <seconds>]

                Default mode performs a non-prompting LocalAuthentication readiness check.
                --prompt requests the real macOS owner-authentication prompt and cancels it after the timeout.
                """)
                return
            default:
                record("status=failed error=unknown_arg arg=\(argument)")
                exit(2)
            }
        }

        let context = LAContext()
        context.localizedCancelTitle = cancelTitle
        var authError: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &authError) else {
            let code = authError.map { String($0.code) } ?? "unknown"
            record("status=blocked reason=local_auth_unavailable code=\(code)")
            return
        }

        let biometricContext = LAContext()
        var biometricError: NSError?
        let canUseBiometrics = biometricContext.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            error: &biometricError
        )
        let biometry = biometryLabel(for: biometricContext.biometryType)

        if !shouldPrompt {
            record(
                "status=ready claim=local_auth_prompt_preflight biometry=\(biometry) can_biometrics=\(canUseBiometrics)"
            )
            return
        }

        record(
            "status=prompt_requested claim=touch_id_prompt_ux reason=\"\(reason)\" cancel_title=\"\(cancelTitle)\" timeout_seconds=\(timeoutSeconds) biometry=\(biometry) can_biometrics=\(canUseBiometrics)"
        )
        fflush(stdout)

        Task {
            try? await Task.sleep(nanoseconds: timeoutSeconds * 1_000_000_000)
            context.invalidate()
        }

        do {
            let authorized = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            )
            record("status=completed result=\(authorized ? "authorized" : "denied")")
        } catch {
            let nsError = error as NSError
            record("status=completed result=denied error_domain=\(nsError.domain) error_code=\(nsError.code)")
        }
    }

    private static func record(_ fields: String) {
        print("UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT \(fields)")
    }

    private static func biometryLabel(for type: LABiometryType) -> String {
        switch type {
        case .none:
            return "none"
        case .touchID:
            return "touch_id"
        case .faceID:
            return "face_id"
        case .opticID:
            return "optic_id"
        @unknown default:
            return "unknown"
        }
    }
}
