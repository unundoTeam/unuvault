import Foundation

public enum CompanionPairingSessionError: Error, Equatable {
    case expired
    case invalidRequest
    case locked
    case replayed
}

public struct CompanionPairingQRCodePayload: Equatable, Codable {
    public let version: Int
    public let sessionId: String
    public let sessionNonce: String
    public let sourceDeviceId: String
    public let sourceDeviceDisplayName: String
    public let createdAt: Date
    public let expiresAt: Date

    public init(
        version: Int,
        sessionId: String,
        sessionNonce: String,
        sourceDeviceId: String,
        sourceDeviceDisplayName: String,
        createdAt: Date,
        expiresAt: Date
    ) {
        self.version = version
        self.sessionId = sessionId
        self.sessionNonce = sessionNonce
        self.sourceDeviceId = sourceDeviceId
        self.sourceDeviceDisplayName = sourceDeviceDisplayName
        self.createdAt = createdAt
        self.expiresAt = expiresAt
    }
}

public enum CompanionPairingInviteError: Error, Equatable {
    case invalidBaseURL
}

public struct CompanionPairingInvitePayload: Equatable, Codable {
    public let version: Int
    public let macBaseURL: URL
    public let pairing: CompanionPairingQRCodePayload

    public init(
        version: Int,
        macBaseURL: URL,
        pairing: CompanionPairingQRCodePayload
    ) {
        self.version = version
        self.macBaseURL = macBaseURL
        self.pairing = pairing
    }
}

public struct CompanionPairingInviteBuilder {
    public init() {}

    public func makeInvite(
        pairing: CompanionPairingQRCodePayload,
        macBaseURL: URL
    ) throws -> CompanionPairingInvitePayload {
        guard Self.isSupportedBaseURL(macBaseURL) else {
            throw CompanionPairingInviteError.invalidBaseURL
        }

        return CompanionPairingInvitePayload(
            version: 1,
            macBaseURL: macBaseURL,
            pairing: pairing
        )
    }

    private static func isSupportedBaseURL(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              let host = url.host(),
              !host.isEmpty
        else {
            return false
        }

        return true
    }
}

public final class CompanionPairingSessionCoordinator: @unchecked Sendable {
    private let stateLock = NSRecursiveLock()
    private let session: CompanionVaultSession
    private let handoffBuilder: CompanionPairingHandoffBuilder
    private let now: () -> Date
    private let makeSessionId: () -> String
    private let makeSessionNonce: () -> String
    private var pendingSessions: [String: CompanionPairingQRCodePayload] = [:]
    private var consumedSessionIds: Set<String> = []

    public init(
        session: CompanionVaultSession,
        handoffBuilder: CompanionPairingHandoffBuilder = CompanionPairingHandoffBuilder(),
        now: @escaping () -> Date = Date.init,
        makeSessionId: @escaping () -> String = { UUID().uuidString },
        makeSessionNonce: @escaping () -> String = { UUID().uuidString }
    ) {
        self.session = session
        self.handoffBuilder = handoffBuilder
        self.now = now
        self.makeSessionId = makeSessionId
        self.makeSessionNonce = makeSessionNonce
    }

    public func startSession(
        sourceDeviceId: String,
        sourceDeviceDisplayName: String,
        ttl: TimeInterval = 120
    ) throws -> CompanionPairingQRCodePayload {
        guard ttl > 0,
              !sourceDeviceId.isEmpty,
              !sourceDeviceDisplayName.isEmpty
        else {
            throw CompanionPairingSessionError.invalidRequest
        }

        guard session.credentialsForPairing() != nil else {
            throw CompanionPairingSessionError.locked
        }

        let createdAt = now()
        let payload = CompanionPairingQRCodePayload(
            version: 1,
            sessionId: makeSessionId(),
            sessionNonce: makeSessionNonce(),
            sourceDeviceId: sourceDeviceId,
            sourceDeviceDisplayName: sourceDeviceDisplayName,
            createdAt: createdAt,
            expiresAt: createdAt.addingTimeInterval(ttl)
        )

        stateLock.lock()
        defer { stateLock.unlock() }

        pendingSessions[payload.sessionId] = payload
        return payload
    }

    public func completeSession(
        sessionId: String,
        sessionNonce: String,
        target: CompanionPairingTarget,
        transferKeyData: Data
    ) throws -> CompanionPairingHandoff {
        stateLock.lock()
        defer { stateLock.unlock() }

        guard consumedSessionIds.contains(sessionId) == false else {
            throw CompanionPairingSessionError.replayed
        }

        guard let payload = pendingSessions[sessionId],
              payload.sessionNonce == sessionNonce
        else {
            throw CompanionPairingSessionError.invalidRequest
        }

        let currentNow = now()
        guard currentNow <= payload.expiresAt else {
            pendingSessions.removeValue(forKey: sessionId)
            throw CompanionPairingSessionError.expired
        }

        guard let credentials = session.credentialsForPairing() else {
            pendingSessions.removeValue(forKey: sessionId)
            throw CompanionPairingSessionError.locked
        }

        let handoff = try handoffBuilder.makeHandoff(
            credentials: credentials,
            sourceDeviceId: payload.sourceDeviceId,
            target: target,
            transferKeyData: transferKeyData,
            now: currentNow,
            ttl: payload.expiresAt.timeIntervalSince(currentNow),
            handoffId: payload.sessionId
        )

        pendingSessions.removeValue(forKey: sessionId)
        consumedSessionIds.insert(sessionId)
        return handoff
    }
}
