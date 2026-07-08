import CryptoKit
import Foundation

@MainActor
final class DefaultPairingHandoffImporter {
    private let opener: PairingHandoffOpener
    private let privateKeyStore: PairingTargetIdentityPrivateKeyStore
    private var importStore: PairingHandoffImportStore
    private let now: @Sendable () -> Date

    init(
        opener: PairingHandoffOpener = PairingHandoffOpener(),
        privateKeyStore: PairingTargetIdentityPrivateKeyStore =
            KeychainPairingTargetIdentityPrivateKeyStore(),
        importStore: PairingHandoffImportStore = PairingHandoffImportStore(),
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.opener = opener
        self.privateKeyStore = privateKeyStore
        self.importStore = importStore
        self.now = now
    }

    func importHandoff(
        _ handoff: MacPairingHandoff,
        expectedTarget: PairingTargetIdentity
    ) throws -> PairingHandoffImportReceipt {
        guard let privateKeyData = try privateKeyStore.loadPrivateKeyData() else {
            throw PairingTargetIdentityProviderError.invalidStoredPrivateKey
        }

        let privateKey: P256.KeyAgreement.PrivateKey

        do {
            privateKey = try P256.KeyAgreement.PrivateKey(rawRepresentation: privateKeyData)
        } catch {
            throw PairingTargetIdentityProviderError.invalidStoredPrivateKey
        }

        let openedPayload = try opener.open(
            handoff,
            recipientPrivateKey: privateKey,
            expectedTarget: expectedTarget,
            now: now()
        )

        return try importStore.importPayload(openedPayload, from: handoff)
    }
}
