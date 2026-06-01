import Foundation
import LocalAuthentication

public enum LocalUserPresenceAuthorizationResult: Equatable {
    case authorized
    case denied
    case unavailable
}

@MainActor
public protocol LocalUserPresenceAuthorizing {
    func authorize(reason: String) async -> LocalUserPresenceAuthorizationResult
}

public struct StaticLocalUserPresenceAuthorizer: LocalUserPresenceAuthorizing {
    private let result: LocalUserPresenceAuthorizationResult

    public init(result: LocalUserPresenceAuthorizationResult) {
        self.result = result
    }

    public func authorize(reason: String) async -> LocalUserPresenceAuthorizationResult {
        result
    }
}

public final class LocalAuthenticationUserPresenceAuthorizer:
    LocalUserPresenceAuthorizing
{
    public init() {}

    public func authorize(reason: String) async -> LocalUserPresenceAuthorizationResult {
        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            return .unavailable
        }

        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            ) ? .authorized : .denied
        } catch {
            return .denied
        }
    }
}
