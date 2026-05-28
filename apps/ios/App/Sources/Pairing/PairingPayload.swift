import Foundation

public enum PairingPayloadError: Error, Equatable, Sendable {
    case expired
    case invalidPayload
    case invalidVersion
}

public enum PairingInviteError: Error, Equatable, Sendable {
    case invalidBaseURL
    case invalidPayload
    case invalidVersion
}

public enum PairingHandoffResponseError: Error, Equatable, Sendable {
    case expired
    case invalidPayload
    case invalidVersion
    case targetMismatch
    case unsupportedAlgorithm
}

public enum PairingExchangeClientError: Error, Equatable, Sendable {
    case httpStatus(Int)
    case invalidHTTPResponse
}

public typealias PairingExchangeTransport = @Sendable (URLRequest) async throws -> (
    Data,
    HTTPURLResponse
)

public struct MacPairingQRCodePayload: Equatable, Codable, Sendable {
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

public struct MacPairingInvite: Equatable, Codable, Sendable {
    public let version: Int
    public let macBaseURL: URL
    public let pairing: MacPairingQRCodePayload

    public init(
        version: Int,
        macBaseURL: URL,
        pairing: MacPairingQRCodePayload
    ) {
        self.version = version
        self.macBaseURL = macBaseURL
        self.pairing = pairing
    }
}

public enum PairingInviteParser {
    public static func parse(
        _ data: Data,
        now: Date = Date()
    ) throws -> MacPairingInvite {
        let invite: MacPairingInvite

        do {
            invite = try JSONDecoder().decode(MacPairingInvite.self, from: data)
        } catch {
            throw PairingInviteError.invalidPayload
        }

        guard invite.version == 1 else {
            throw PairingInviteError.invalidVersion
        }

        guard isSupportedBaseURL(invite.macBaseURL) else {
            throw PairingInviteError.invalidBaseURL
        }

        let payloadData = try JSONEncoder().encode(invite.pairing)
        _ = try PairingPayloadParser.parse(payloadData, now: now)

        return invite
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

public struct PairingTargetIdentity: Equatable, Codable, Sendable {
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

public struct PairingTargetClaim: Equatable, Codable, Sendable {
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

public struct MacPairingHandoffMaterial: Equatable, Codable, Sendable {
    public let algorithm: String
    public let nonce: String
    public let ciphertext: String
    public let tag: String

    public init(
        algorithm: String,
        nonce: String,
        ciphertext: String,
        tag: String
    ) {
        self.algorithm = algorithm
        self.nonce = nonce
        self.ciphertext = ciphertext
        self.tag = tag
    }
}

public struct MacPairingHandoff: Equatable, Codable, Sendable {
    public let handoffId: String
    public let version: Int
    public let sourceDeviceId: String
    public let targetDeviceId: String
    public let targetDeviceDisplayName: String
    public let targetPublicKeyFingerprint: String
    public let createdAt: Date
    public let expiresAt: Date
    public let material: MacPairingHandoffMaterial

    public init(
        handoffId: String,
        version: Int,
        sourceDeviceId: String,
        targetDeviceId: String,
        targetDeviceDisplayName: String,
        targetPublicKeyFingerprint: String,
        createdAt: Date,
        expiresAt: Date,
        material: MacPairingHandoffMaterial
    ) {
        self.handoffId = handoffId
        self.version = version
        self.sourceDeviceId = sourceDeviceId
        self.targetDeviceId = targetDeviceId
        self.targetDeviceDisplayName = targetDeviceDisplayName
        self.targetPublicKeyFingerprint = targetPublicKeyFingerprint
        self.createdAt = createdAt
        self.expiresAt = expiresAt
        self.material = material
    }
}

public struct MacPairingHandoffResponse: Equatable, Codable, Sendable {
    public let handoff: MacPairingHandoff

    public init(handoff: MacPairingHandoff) {
        self.handoff = handoff
    }
}

public enum PairingHandoffResponseParser {
    public static func parse(
        _ data: Data,
        expectedTarget: PairingTargetIdentity,
        now: Date = Date()
    ) throws -> MacPairingHandoff {
        let response: MacPairingHandoffResponse

        do {
            response = try JSONDecoder().decode(MacPairingHandoffResponse.self, from: data)
        } catch {
            throw PairingHandoffResponseError.invalidPayload
        }

        let handoff = response.handoff

        guard handoff.version == 1 else {
            throw PairingHandoffResponseError.invalidVersion
        }

        guard !handoff.handoffId.isEmpty,
              !handoff.sourceDeviceId.isEmpty,
              !handoff.targetDeviceId.isEmpty,
              !handoff.targetDeviceDisplayName.isEmpty,
              !handoff.targetPublicKeyFingerprint.isEmpty,
              !handoff.material.nonce.isEmpty,
              !handoff.material.ciphertext.isEmpty,
              !handoff.material.tag.isEmpty,
              handoff.createdAt <= handoff.expiresAt
        else {
            throw PairingHandoffResponseError.invalidPayload
        }

        guard handoff.material.algorithm == "AES-GCM-256" else {
            throw PairingHandoffResponseError.unsupportedAlgorithm
        }

        guard handoff.targetDeviceId == expectedTarget.deviceId,
              handoff.targetPublicKeyFingerprint == expectedTarget.publicKeyFingerprint
        else {
            throw PairingHandoffResponseError.targetMismatch
        }

        guard now <= handoff.expiresAt else {
            throw PairingHandoffResponseError.expired
        }

        return handoff
    }
}

public struct PairingExchangeClient: Sendable {
    private let macBaseURL: URL
    private let now: @Sendable () -> Date
    private let transport: PairingExchangeTransport

    public init(
        macBaseURL: URL,
        now: @escaping @Sendable () -> Date = Date.init,
        transport: PairingExchangeTransport? = nil
    ) {
        self.macBaseURL = macBaseURL
        self.now = now
        self.transport = transport ?? Self.defaultTransport
    }

    public init(
        invite: MacPairingInvite,
        now: @escaping @Sendable () -> Date = Date.init,
        transport: PairingExchangeTransport? = nil
    ) {
        self.init(
            macBaseURL: invite.macBaseURL,
            now: now,
            transport: transport
        )
    }

    public func exchange(
        payload: MacPairingQRCodePayload,
        targetIdentity: PairingTargetIdentity
    ) async throws -> MacPairingHandoff {
        let claim = try PairingTargetClaimBuilder().makeClaim(
            payload: payload,
            targetIdentity: targetIdentity
        )
        var request = URLRequest(url: endpointURL())
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try JSONEncoder().encode(claim)

        let (data, response) = try await transport(request)

        guard response.statusCode == 200 else {
            throw PairingExchangeClientError.httpStatus(response.statusCode)
        }

        return try PairingHandoffResponseParser.parse(
            data,
            expectedTarget: targetIdentity,
            now: now()
        )
    }

    private func endpointURL() -> URL {
        macBaseURL
            .appendingPathComponent("v1")
            .appendingPathComponent("pairing")
            .appendingPathComponent("claim")
    }

    private static func defaultTransport(
        request: URLRequest
    ) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw PairingExchangeClientError.invalidHTTPResponse
        }

        return (data, httpResponse)
    }
}
