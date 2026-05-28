import Foundation
import MacCompanionCore

enum CompanionAppConfiguration {
    @MainActor
    static func makeViewModel(
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> CompanionViewModel {
        guard environment["UNUVAULT_MAC_COMPANION_PROOF"] == "1" else {
            return CompanionViewModel()
        }

        let accessToken = environment["UNUVAULT_MAC_COMPANION_PROOF_TOKEN"] ??
            "local-dev-bridge-token"
        let bridgePort = UInt16(environment["UNUVAULT_MAC_COMPANION_PROOF_PORT"] ?? "") ??
            17666
        let pairingBaseURL = environment["UNUVAULT_MAC_COMPANION_PROOF_PAIRING_BASE_URL"]
            .flatMap(URL.init(string:))
        let profileId = environment["UNUVAULT_MAC_COMPANION_PROOF_PROFILE_ID"] ??
            "personal"
        let vaultDirectory = URL(
            fileURLWithPath: environment["UNUVAULT_MAC_COMPANION_PROOF_VAULT_DIR"] ??
                NSTemporaryDirectory(),
            isDirectory: true
        )
        let vaultStore = LocalCompanionVaultStore(
            keyProvider: StaticCompanionVaultKeyProvider(
                keyData: Data(repeating: 29, count: 32)
            ),
            vaultURL: vaultDirectory.appendingPathComponent("vault.json")
        )
        let proofCredential = makeStartupCredential(
            environment: environment,
            profileId: profileId
        )
        let prefillAddLogin = environment["UNUVAULT_MAC_COMPANION_PROOF_PREFILL_ADD_LOGIN"] == "1"

        return CompanionViewModel(
            vaultStore: vaultStore,
            accessToken: accessToken,
            addLoginDraftCredential: prefillAddLogin ? proofCredential : nil,
            bridgePort: bridgePort,
            pairingBaseURL: pairingBaseURL,
            startupCredential: prefillAddLogin ? nil : proofCredential,
            unlockOnStart: environment["UNUVAULT_MAC_COMPANION_PROOF_AUTOUNLOCK"] != "0"
        )
    }

    private static func makeStartupCredential(
        environment: [String: String],
        profileId: String
    ) -> CompanionCredential? {
        guard let origin = environment["UNUVAULT_MAC_COMPANION_PROOF_ORIGIN"],
              !origin.isEmpty
        else {
            return nil
        }

        return CompanionCredential(
            id: environment["UNUVAULT_MAC_COMPANION_PROOF_CREDENTIAL_ID"] ??
                "github-login",
            label: environment["UNUVAULT_MAC_COMPANION_PROOF_LABEL"] ??
                "github.com",
            username: environment["UNUVAULT_MAC_COMPANION_PROOF_USERNAME"] ??
                "mac-menu-user",
            password: environment["UNUVAULT_MAC_COMPANION_PROOF_PASSWORD"] ??
                "mac-menu-password",
            profileId: profileId,
            websiteOrigin: origin
        )
    }
}
