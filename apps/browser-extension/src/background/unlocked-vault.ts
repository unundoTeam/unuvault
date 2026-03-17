import { openStoredVaultPassword } from "../../../../packages/security/src/vault-envelope";
import { readExtensionAuthState } from "./auth";
import { readExtensionUnlockPassphrase } from "./unlock-session";
import { normalizeVaultLoginPayload } from "../popup/login-payload";
import { readPopupVaultItems } from "../popup/popup-vault-storage";

export type UnlockedVaultLoginItem = {
  hasPassword: boolean;
  id: string;
  password: string;
  title: string;
  username: string;
};

type UnlockedVaultReaderDeps = {
  readExtensionAuthState: typeof readExtensionAuthState;
  readPopupVaultItems: typeof readPopupVaultItems;
  readUnlockPassphrase: typeof readExtensionUnlockPassphrase;
};

function createDefaultDeps(): UnlockedVaultReaderDeps {
  return {
    readExtensionAuthState,
    readPopupVaultItems,
    readUnlockPassphrase: readExtensionUnlockPassphrase,
  };
}

export function createUnlockedVaultReader(
  deps: Partial<UnlockedVaultReaderDeps> = {},
) {
  const resolvedDeps = {
    ...createDefaultDeps(),
    ...deps,
  };

  return {
    async readUnlockedLoginItems(): Promise<UnlockedVaultLoginItem[]> {
      const authState = await resolvedDeps.readExtensionAuthState();

      if (authState.status !== "signed_in") {
        return [];
      }

      const passphrase = await resolvedDeps.readUnlockPassphrase();

      if (!passphrase) {
        return [];
      }

      const items = await resolvedDeps.readPopupVaultItems();

      return items
        .filter((item) => item.item_type === "login")
        .map((item) => {
          const payload = normalizeVaultLoginPayload(item.encrypted_payload);
          const password = openStoredVaultPassword(
            payload.password_ciphertext,
            passphrase,
          );

          return {
            hasPassword: Boolean(password),
            id: item.id,
            password,
            title: item.title,
            username: payload.username,
          };
        });
    },
  };
}
