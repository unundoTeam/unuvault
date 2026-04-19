import {
  createMasterPasswordVerifier,
  verifyMasterPassword,
} from "../../../../packages/security/src/master-password-verifier";
import {
  readMasterPasswordVerifier,
  writeMasterPasswordVerifier,
} from "../popup/master-password-storage";

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
  readMasterPasswordVerifier: typeof readMasterPasswordVerifier;
  verifyMasterPassword: typeof verifyMasterPassword;
  writeMasterPasswordVerifier: typeof writeMasterPasswordVerifier;
};

function createDefaultDeps(): ExtensionUnlockRuntimeDeps {
  return {
    createMasterPasswordVerifier,
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
