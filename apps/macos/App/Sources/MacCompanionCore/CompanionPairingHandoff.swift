import CryptoKit
import Foundation

public enum CompanionPairingHandoffError: Error, Equatable {
    case expired
    case invalidKey
    case openFailed
    case replayed
    case targetMismatch
}

public struct CompanionPairingTarget: Equatable, Codable {
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

public struct CompanionPairingHandoffMaterial: Equatable, Codable {
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

public struct CompanionPairingHandoff: Equatable, Codable {
    public let handoffId: String
    public let version: Int
    public let sourceDeviceId: String
    public let targetDeviceId: String
    public let targetDeviceDisplayName: String
    public let targetPublicKeyFingerprint: String
    public let createdAt: Date
    public let expiresAt: Date
    public let material: CompanionPairingHandoffMaterial

    public init(
        handoffId: String,
        version: Int,
        sourceDeviceId: String,
        targetDeviceId: String,
        targetDeviceDisplayName: String,
        targetPublicKeyFingerprint: String,
        createdAt: Date,
        expiresAt: Date,
        material: CompanionPairingHandoffMaterial
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

public final class CompanionPairingHandoffVerifier {
    private var consumedHandoffIds: Set<String> = []
    private let builder: CompanionPairingHandoffBuilder

    public init(builder: CompanionPairingHandoffBuilder = CompanionPairingHandoffBuilder()) {
        self.builder = builder
    }

    public func openHandoff(
        _ handoff: CompanionPairingHandoff,
        transferKeyData: Data,
        expectedTarget: CompanionPairingTarget,
        now: Date = Date()
    ) throws -> [CompanionCredential] {
        guard now <= handoff.expiresAt else {
            throw CompanionPairingHandoffError.expired
        }

        guard handoff.targetDeviceId == expectedTarget.deviceId,
              handoff.targetPublicKeyFingerprint == expectedTarget.publicKeyFingerprint
        else {
            throw CompanionPairingHandoffError.targetMismatch
        }

        guard consumedHandoffIds.contains(handoff.handoffId) == false else {
            throw CompanionPairingHandoffError.replayed
        }

        let credentials = try builder.openHandoff(handoff, transferKeyData: transferKeyData)
        consumedHandoffIds.insert(handoff.handoffId)
        return credentials
    }
}

public struct CompanionPairingHandoffBuilder {
    public init() {}

    public func makeHandoff(
        credentials: [CompanionCredential],
        sourceDeviceId: String,
        target: CompanionPairingTarget,
        transferKeyData: Data,
        now: Date = Date(),
        ttl: TimeInterval = 300,
        handoffId: String = UUID().uuidString
    ) throws -> CompanionPairingHandoff {
        let payload = try JSONEncoder().encode(
            PairingVaultPayload(items: credentials)
        )
        let sealedBox = try AES.GCM.seal(payload, using: symmetricKey(transferKeyData))
        let nonce = sealedBox.nonce.withUnsafeBytes { Data($0) }

        return CompanionPairingHandoff(
            handoffId: handoffId,
            version: 1,
            sourceDeviceId: sourceDeviceId,
            targetDeviceId: target.deviceId,
            targetDeviceDisplayName: target.displayName,
            targetPublicKeyFingerprint: target.publicKeyFingerprint,
            createdAt: now,
            expiresAt: now.addingTimeInterval(ttl),
            material: CompanionPairingHandoffMaterial(
                algorithm: "AES-GCM-256",
                nonce: nonce.base64EncodedString(),
                ciphertext: sealedBox.ciphertext.base64EncodedString(),
                tag: sealedBox.tag.base64EncodedString()
            )
        )
    }

    public func openHandoff(
        _ handoff: CompanionPairingHandoff,
        transferKeyData: Data
    ) throws -> [CompanionCredential] {
        do {
            guard handoff.version == 1,
                  handoff.material.algorithm == "AES-GCM-256",
                  let nonceData = Data(base64Encoded: handoff.material.nonce),
                  let ciphertext = Data(base64Encoded: handoff.material.ciphertext),
                  let tag = Data(base64Encoded: handoff.material.tag)
            else {
                throw CompanionPairingHandoffError.openFailed
            }

            let sealedBox = try AES.GCM.SealedBox(
                nonce: AES.GCM.Nonce(data: nonceData),
                ciphertext: ciphertext,
                tag: tag
            )
            let payloadData = try AES.GCM.open(
                sealedBox,
                using: symmetricKey(transferKeyData)
            )

            return try JSONDecoder()
                .decode(PairingVaultPayload.self, from: payloadData)
                .items
        } catch let error as CompanionPairingHandoffError {
            throw error
        } catch {
            throw CompanionPairingHandoffError.openFailed
        }
    }

    private func symmetricKey(_ keyData: Data) throws -> SymmetricKey {
        guard keyData.count == 32 else {
            throw CompanionPairingHandoffError.invalidKey
        }

        return SymmetricKey(data: keyData)
    }
}

private struct PairingVaultPayload: Codable {
    let items: [CompanionCredential]
}
