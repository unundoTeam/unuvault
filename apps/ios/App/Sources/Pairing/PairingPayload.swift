import Foundation

public enum PairingPayloadError: Error, Equatable {
    case expired
    case invalidPayload
    case invalidVersion
}

public struct MacPairingQRCodePayload: Equatable, Codable {
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

public enum PairingPayloadParser {
    public static func parse(
        _ data: Data,
        now: Date = Date()
    ) throws -> MacPairingQRCodePayload {
        let payload: MacPairingQRCodePayload

        do {
            payload = try JSONDecoder().decode(MacPairingQRCodePayload.self, from: data)
        } catch {
            throw PairingPayloadError.invalidPayload
        }

        guard payload.version == 1 else {
            throw PairingPayloadError.invalidVersion
        }

        guard !payload.sessionId.isEmpty,
              !payload.sessionNonce.isEmpty,
              !payload.sourceDeviceId.isEmpty,
              !payload.sourceDeviceDisplayName.isEmpty,
              payload.createdAt <= payload.expiresAt
        else {
            throw PairingPayloadError.invalidPayload
        }

        guard now <= payload.expiresAt else {
            throw PairingPayloadError.expired
        }

        return payload
    }
}

public struct PairingTargetIdentity: Equatable, Codable {
    public let deviceId: String
    public let displayName: String
    public let publicKeyFingerprint: String

    public init(
        deviceId: String,
        displayName: String,
        publicKeyFingerprint: String
    ) {
        self.deviceId = deviceId
        self.displayName = displayName
        self.publicKeyFingerprint = publicKeyFingerprint
    }
}

public struct PairingTargetClaim: Equatable, Codable {
    public let sessionId: String
    public let sessionNonce: String
    public let target: PairingTargetIdentity

    public init(
        sessionId: String,
        sessionNonce: String,
        target: PairingTargetIdentity
    ) {
        self.sessionId = sessionId
        self.sessionNonce = sessionNonce
        self.target = target
    }
}

public struct PairingTargetClaimBuilder {
    public init() {}

    public func makeClaim(
        payload: MacPairingQRCodePayload,
        targetIdentity: PairingTargetIdentity
    ) throws -> PairingTargetClaim {
        guard payload.version == 1,
              !payload.sessionId.isEmpty,
              !payload.sessionNonce.isEmpty,
              !targetIdentity.deviceId.isEmpty,
              !targetIdentity.displayName.isEmpty,
              !targetIdentity.publicKeyFingerprint.isEmpty
        else {
            throw PairingPayloadError.invalidPayload
        }

        return PairingTargetClaim(
            sessionId: payload.sessionId,
            sessionNonce: payload.sessionNonce,
            target: targetIdentity
        )
    }
}
