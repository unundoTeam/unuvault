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
    public let publicKeyAgreementDERBase64URL: String

    public init(
        deviceId: String,
        displayName: String,
        publicKeyFingerprint: String,
        publicKeyAgreementDERBase64URL: String
    ) {
        self.deviceId = deviceId
        self.displayName = displayName
        self.publicKeyFingerprint = publicKeyFingerprint
        self.publicKeyAgreementDERBase64URL = publicKeyAgreementDERBase64URL
    }

    public var isValidKeyAgreementPublicKey: Bool {
        guard let publicKeyData = Data(base64URLEncoded: publicKeyAgreementDERBase64URL),
              (try? P256.KeyAgreement.PublicKey(derRepresentation: publicKeyData)) != nil
        else {
            return false
        }

        return publicKeyFingerprint == Self.fingerprint(for: publicKeyData)
    }

    fileprivate func keyAgreementPublicKey() throws -> P256.KeyAgreement.PublicKey {
        guard let publicKeyData = Data(base64URLEncoded: publicKeyAgreementDERBase64URL) else {
            throw CompanionPairingHandoffError.invalidKey
        }

        do {
            return try P256.KeyAgreement.PublicKey(derRepresentation: publicKeyData)
        } catch {
            throw CompanionPairingHandoffError.invalidKey
        }
    }

    fileprivate static func fingerprint(for data: Data) -> String {
        let digest = SHA256.hash(data: data)
        return "sha256:\(digest.map { String(format: "%02x", $0) }.joined())"
    }
}

public struct CompanionPairingHandoffMaterial: Equatable, Codable {
    public let algorithm: String
    public let senderPublicKeyAgreementDERBase64URL: String
    public let nonce: String
    public let ciphertext: String
    public let tag: String

    public init(
        algorithm: String,
        senderPublicKeyAgreementDERBase64URL: String,
        nonce: String,
        ciphertext: String,
        tag: String
    ) {
        self.algorithm = algorithm
        self.senderPublicKeyAgreementDERBase64URL = senderPublicKeyAgreementDERBase64URL
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
        recipientPrivateKey: P256.KeyAgreement.PrivateKey,
        expectedTarget: CompanionPairingTarget,
        now: Date = Date()
    ) throws -> [CompanionCredential] {
        try validate(handoff, expectedTarget: expectedTarget, now: now)

        let credentials = try builder.openHandoff(
            handoff,
            recipientPrivateKey: recipientPrivateKey
        )
        consumedHandoffIds.insert(handoff.handoffId)
        return credentials
    }

    public func openHandoff(
        _ handoff: CompanionPairingHandoff,
        transferKeyData: Data,
        expectedTarget: CompanionPairingTarget,
        now: Date = Date()
    ) throws -> [CompanionCredential] {
        try validate(handoff, expectedTarget: expectedTarget, now: now)

        let credentials = try builder.openHandoff(handoff, transferKeyData: transferKeyData)
        consumedHandoffIds.insert(handoff.handoffId)
        return credentials
    }

    private func validate(
        _ handoff: CompanionPairingHandoff,
        expectedTarget: CompanionPairingTarget,
        now: Date
    ) throws {
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
    }
}

public struct CompanionPairingHandoffBuilder {
    private static let algorithm = "P256-HKDF-SHA256-AES-GCM-256"

    public init() {}

    public func makeHandoff(
        credentials: [CompanionCredential],
        sourceDeviceId: String,
        target: CompanionPairingTarget,
        now: Date = Date(),
        ttl: TimeInterval = 300,
        handoffId: String = UUID().uuidString
    ) throws -> CompanionPairingHandoff {
        let payload = try JSONEncoder().encode(
            PairingVaultPayload(items: credentials)
        )
        let senderPrivateKey = P256.KeyAgreement.PrivateKey()
        let recipientPublicKey = try target.keyAgreementPublicKey()
        let associatedData = Self.associatedData(
            handoffId: handoffId,
            sourceDeviceId: sourceDeviceId,
            targetDeviceId: target.deviceId,
            targetPublicKeyFingerprint: target.publicKeyFingerprint
        )
        let sealedBox = try AES.GCM.seal(
            payload,
            using: symmetricKey(
                senderPrivateKey: senderPrivateKey,
                recipientPublicKey: recipientPublicKey,
                associatedData: associatedData
            ),
            authenticating: associatedData
        )
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
                algorithm: Self.algorithm,
                senderPublicKeyAgreementDERBase64URL: senderPrivateKey
                    .publicKey
                    .derRepresentation
                    .base64URLEncodedString(),
                nonce: nonce.base64EncodedString(),
                ciphertext: sealedBox.ciphertext.base64EncodedString(),
                tag: sealedBox.tag.base64EncodedString()
            )
        )
    }

    public func makeHandoff(
        credentials: [CompanionCredential],
        sourceDeviceId: String,
        target: CompanionPairingTarget,
        transferKeyData _: Data,
        now: Date = Date(),
        ttl: TimeInterval = 300,
        handoffId: String = UUID().uuidString
    ) throws -> CompanionPairingHandoff {
        try makeHandoff(
            credentials: credentials,
            sourceDeviceId: sourceDeviceId,
            target: target,
            now: now,
            ttl: ttl,
            handoffId: handoffId
        )
    }

    public func openHandoff(
        _ handoff: CompanionPairingHandoff,
        recipientPrivateKey: P256.KeyAgreement.PrivateKey
    ) throws -> [CompanionCredential] {
        do {
            guard handoff.version == 1,
                  handoff.material.algorithm == Self.algorithm,
                  let senderPublicKeyData = Data(
                    base64URLEncoded: handoff.material.senderPublicKeyAgreementDERBase64URL
                  ),
                  let nonceData = Data(base64Encoded: handoff.material.nonce),
                  let ciphertext = Data(base64Encoded: handoff.material.ciphertext),
                  let tag = Data(base64Encoded: handoff.material.tag)
            else {
                throw CompanionPairingHandoffError.openFailed
            }

            let senderPublicKey = try P256.KeyAgreement.PublicKey(
                derRepresentation: senderPublicKeyData
            )
            let associatedData = Self.associatedData(
                handoffId: handoff.handoffId,
                sourceDeviceId: handoff.sourceDeviceId,
                targetDeviceId: handoff.targetDeviceId,
                targetPublicKeyFingerprint: handoff.targetPublicKeyFingerprint
            )
            let sealedBox = try AES.GCM.SealedBox(
                nonce: AES.GCM.Nonce(data: nonceData),
                ciphertext: ciphertext,
                tag: tag
            )
            let payloadData = try AES.GCM.open(
                sealedBox,
                using: symmetricKey(
                    recipientPrivateKey: recipientPrivateKey,
                    senderPublicKey: senderPublicKey,
                    associatedData: associatedData
                ),
                authenticating: associatedData
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

    private func symmetricKey(
        senderPrivateKey: P256.KeyAgreement.PrivateKey,
        recipientPublicKey: P256.KeyAgreement.PublicKey,
        associatedData: Data
    ) throws -> SymmetricKey {
        let sharedSecret = try senderPrivateKey.sharedSecretFromKeyAgreement(
            with: recipientPublicKey
        )
        return derivedSymmetricKey(sharedSecret: sharedSecret, associatedData: associatedData)
    }

    private func symmetricKey(
        recipientPrivateKey: P256.KeyAgreement.PrivateKey,
        senderPublicKey: P256.KeyAgreement.PublicKey,
        associatedData: Data
    ) throws -> SymmetricKey {
        let sharedSecret = try recipientPrivateKey.sharedSecretFromKeyAgreement(
            with: senderPublicKey
        )
        return derivedSymmetricKey(sharedSecret: sharedSecret, associatedData: associatedData)
    }

    private func derivedSymmetricKey(
        sharedSecret: SharedSecret,
        associatedData: Data
    ) -> SymmetricKey {
        sharedSecret.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: Data("unuvault-pairing-handoff-v1".utf8),
            sharedInfo: associatedData,
            outputByteCount: 32
        )
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

private struct PairingVaultPayload: Codable {
    let items: [CompanionCredential]
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

    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
