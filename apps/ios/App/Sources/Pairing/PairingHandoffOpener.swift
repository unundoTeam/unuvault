import CryptoKit
import Foundation

public enum PairingHandoffOpenError: Error, Equatable, Sendable {
    case expired
    case invalidKey
    case openFailed
    case replayed
    case targetMismatch
    case unsupportedAlgorithm
}

public struct PairingImportedCredential: Equatable, Identifiable, Codable, Sendable {
    public let id: String
    public let label: String
    public let username: String
    public let password: String
    public let profileId: String
    public let websiteOrigin: String

    public init(
        id: String,
        label: String,
        username: String,
        password: String,
        profileId: String,
        websiteOrigin: String
    ) {
        self.id = id
        self.label = label
        self.username = username
        self.password = password
        self.profileId = profileId
        self.websiteOrigin = websiteOrigin
    }
}

public struct PairingHandoffOpenedPayload: Equatable, Codable, Sendable {
    public let items: [PairingImportedCredential]

    public init(items: [PairingImportedCredential]) {
        self.items = items
    }
}

public final class PairingHandoffOpener {
    private static let algorithm = "P256-HKDF-SHA256-AES-GCM-256"
    private var consumedHandoffIds: Set<String> = []

    public init() {}

    public func open(
        _ handoff: MacPairingHandoff,
        recipientPrivateKey: P256.KeyAgreement.PrivateKey,
        expectedTarget: PairingTargetIdentity,
        now: Date = Date()
    ) throws -> PairingHandoffOpenedPayload {
        guard handoff.material.algorithm == Self.algorithm else {
            throw PairingHandoffOpenError.unsupportedAlgorithm
        }

        guard now <= handoff.expiresAt else {
            throw PairingHandoffOpenError.expired
        }

        guard handoff.targetDeviceId == expectedTarget.deviceId,
              handoff.targetPublicKeyFingerprint == expectedTarget.publicKeyFingerprint
        else {
            throw PairingHandoffOpenError.targetMismatch
        }

        guard consumedHandoffIds.contains(handoff.handoffId) == false else {
            throw PairingHandoffOpenError.replayed
        }

        let payload = try openPayload(handoff, recipientPrivateKey: recipientPrivateKey)
        consumedHandoffIds.insert(handoff.handoffId)
        return payload
    }

    private func openPayload(
        _ handoff: MacPairingHandoff,
        recipientPrivateKey: P256.KeyAgreement.PrivateKey
    ) throws -> PairingHandoffOpenedPayload {
        do {
            guard handoff.version == 1,
                  !handoff.handoffId.isEmpty,
                  !handoff.sourceDeviceId.isEmpty,
                  !handoff.targetDeviceId.isEmpty,
                  !handoff.targetPublicKeyFingerprint.isEmpty,
                  handoff.createdAt <= handoff.expiresAt,
                  let senderPublicKeyData = Data(
                    base64URLEncoded: handoff.material.senderPublicKeyAgreementDERBase64URL
                  ),
                  let nonceData = Data(base64Encoded: handoff.material.nonce),
                  let ciphertext = Data(base64Encoded: handoff.material.ciphertext),
                  let tag = Data(base64Encoded: handoff.material.tag)
            else {
                throw PairingHandoffOpenError.openFailed
            }

            let senderPublicKey = try P256.KeyAgreement.PublicKey(
                derRepresentation: senderPublicKeyData
            )
            let sharedSecret = try recipientPrivateKey.sharedSecretFromKeyAgreement(
                with: senderPublicKey
            )
            let associatedData = Self.associatedData(
                handoffId: handoff.handoffId,
                sourceDeviceId: handoff.sourceDeviceId,
                targetDeviceId: handoff.targetDeviceId,
                targetPublicKeyFingerprint: handoff.targetPublicKeyFingerprint
            )
            let symmetricKey = sharedSecret.hkdfDerivedSymmetricKey(
                using: SHA256.self,
                salt: Data("unuvault-pairing-handoff-v1".utf8),
                sharedInfo: associatedData,
                outputByteCount: 32
            )
            let sealedBox = try AES.GCM.SealedBox(
                nonce: AES.GCM.Nonce(data: nonceData),
                ciphertext: ciphertext,
                tag: tag
            )
            let payloadData = try AES.GCM.open(
                sealedBox,
                using: symmetricKey,
                authenticating: associatedData
            )

            return try JSONDecoder()
                .decode(PairingHandoffOpenedPayload.self, from: payloadData)
        } catch let error as PairingHandoffOpenError {
            throw error
        } catch {
            throw PairingHandoffOpenError.openFailed
        }
    }

    private static func associatedData(
        handoffId: String,
        sourceDeviceId: String,
        targetDeviceId: String,
        targetPublicKeyFingerprint: String
    ) -> Data {
        Data(
            [
                "unuvault-pairing-v1",
                handoffId,
                sourceDeviceId,
                targetDeviceId,
                targetPublicKeyFingerprint
            ].joined(separator: "|").utf8
        )
    }
}

private extension Data {
    init?(base64URLEncoded value: String) {
        var base64URL = value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        let padding = base64URL.count % 4
        if padding > 0 {
            base64URL.append(String(repeating: "=", count: 4 - padding))
        }

        self.init(base64Encoded: base64URL)
    }
}
