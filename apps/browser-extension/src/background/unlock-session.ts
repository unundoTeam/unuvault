import {
  createMasterPasswordVerifier,
  verifyMasterPassword,
} from "../../../../packages/security/src/master-password-verifier";
import {
  isPassphraseProtectedVaultPassword,
  openStoredVaultPassword,
} from "../../../../packages/security/src/vault-envelope";
import { normalizeVaultLoginPayload } from "../popup/login-payload";
import {
  readMasterPasswordVerifier,
  writeMasterPasswordVerifier,
} from "../popup/master-password-storage";
import { readPopupVaultItems } from "../popup/popup-vault-storage";

export type ExtensionUnlockMode = "needs_setup" | "locked" | "unlocked";

export type ExtensionUnlockState = {
  mode: ExtensionUnlockMode;
};

export type UnlockWithPassphraseResult =
  | {
      ok: true;
      unlockState: ExtensionUnlockState;
    }
  | {
      ok: false;
      error: string;
      unlockState: ExtensionUnlockState;
    };

type ExtensionUnlockRuntimeDeps = {
  createMasterPasswordVerifier: typeof createMasterPasswordVerifier;
  readPopupVaultItems: typeof readPopupVaultItems;
  readMasterPasswordVerifier: typeof readMasterPasswordVerifier;
  verifyMasterPassword: typeof verifyMasterPassword;
  writeMasterPasswordVerifier: typeof writeMasterPasswordVerifier;
};

function createDefaultDeps(): ExtensionUnlockRuntimeDeps {
  return {
    createMasterPasswordVerifier,
    readPopupVaultItems,
    readMasterPasswordVerifier,
    verifyMasterPassword,
    writeMasterPasswordVerifier,
  };
}

export function createExtensionUnlockRuntime(
  deps: Partial<ExtensionUnlockRuntimeDeps> = {},
) {
  const resolvedDeps = {
    ...createDefaultDeps(),
    ...deps,
  };
  let unlockPassphrase: string | null = null;

  async function canUnlockProtectedCiphertexts(passphrase: string): Promise<boolean> {
    const protectedCiphertexts = (await resolvedDeps.readPopupVaultItems())
      .map((item) => normalizeVaultLoginPayload(item.encrypted_payload).password_ciphertext)
      .filter((ciphertext) => isPassphraseProtectedVaultPassword(ciphertext));

    if (protectedCiphertexts.length === 0) {
      return true;
    }

    const openedPasswords = await Promise.all(
      protectedCiphertexts.map((ciphertext) =>
        openStoredVaultPassword(ciphertext, passphrase),
      ),
    );

    return openedPasswords.every((password) => password.length > 0);
  }

  async function readUnlockState(): Promise<ExtensionUnlockState> {
    const verifier = await resolvedDeps.readMasterPasswordVerifier();

    if (!verifier) {
      return {
        mode: "needs_setup",
      };
    }

    return {
      mode: unlockPassphrase ? "unlocked" : "locked",
    };
  }

  return {
    async readUnlockPassphrase(): Promise<string | null> {
      return unlockPassphrase;
    },
    readUnlockState,
    async unlockWithPassphrase(
      passphrase: string,
    ): Promise<UnlockWithPassphraseResult> {
      if (!passphrase) {
        return {
          ok: false,
          error: "Master password is required",
          unlockState: await readUnlockState(),
        };
      }

      const verifier = await resolvedDeps.readMasterPasswordVerifier();

      if (!verifier) {
        if (!(await canUnlockProtectedCiphertexts(passphrase))) {
          unlockPassphrase = null;

          return {
            ok: false,
            error: "Master password must unlock existing saved passwords",
            unlockState: {
              mode: "needs_setup",
            },
          };
        }

        const nextVerifier = await resolvedDeps.createMasterPasswordVerifier(
          passphrase,
        );
        await resolvedDeps.writeMasterPasswordVerifier(nextVerifier);
        unlockPassphrase = passphrase;

        return {
          ok: true,
          unlockState: {
            mode: "unlocked",
          },
        };
      }

      const verification = await resolvedDeps.verifyMasterPassword(
        verifier,
        passphrase,
      );

      if (!verification.success) {
        unlockPassphrase = null;

        return {
          ok: false,
          error: "Wrong master password",
          unlockState: {
            mode: "locked",
          },
        };
      }

      if (!(await canUnlockProtectedCiphertexts(passphrase))) {
        unlockPassphrase = null;

        return {
          ok: false,
          error: "Wrong master password",
          unlockState: {
            mode: "locked",
          },
        };
      }

      if (verification.upgradedVerifier) {
        await resolvedDeps.writeMasterPasswordVerifier(
          verification.upgradedVerifier,
        );
      }

      unlockPassphrase = passphrase;

      return {
        ok: true,
        unlockState: {
          mode: "unlocked",
        },
      };
    },
    async lock(): Promise<ExtensionUnlockState> {
      unlockPassphrase = null;

      return readUnlockState();
    },
  };
}

export const extensionUnlockRuntime = createExtensionUnlockRuntime();

export async function readExtensionUnlockPassphrase(): Promise<string | null> {
  return extensionUnlockRuntime.readUnlockPassphrase();
}
