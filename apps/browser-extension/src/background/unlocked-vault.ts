import { openStoredVaultPassword } from "../../../../packages/security/src/vault-envelope";
import { readExtensionAuthState } from "./auth";
import { readExtensionUnlockPassphrase } from "./unlock-session";
import {
  normalizeVaultLoginPayload,
  parseVaultWebsiteMetadata,
} from "../popup/login-payload";
import { readPopupVaultItems } from "../popup/popup-vault-storage";

export type UnlockedVaultLoginItem = {
  hasPassword: boolean;
  id: string;
  password: string;
  title: string;
  username: string;
  websiteHostname: string;
  websiteOrigin: string;
  websiteUrl: string;
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

      return Promise.all(
        items
          .filter((item) => item.item_type === "login")
          .map(async (item) => {
            const payload = normalizeVaultLoginPayload(item.encrypted_payload);
            const password = await openStoredVaultPassword(
              payload.password_ciphertext,
              passphrase,
            );
            const websiteMetadata = parseVaultWebsiteMetadata(payload.website_url);

            return {
              hasPassword: Boolean(password),
              id: item.id,
              password,
              title: item.title,
              username: payload.username,
              websiteHostname: websiteMetadata.websiteHostname,
              websiteOrigin: websiteMetadata.websiteOrigin,
              websiteUrl: websiteMetadata.websiteUrl,
            };
          }),
      );
    },
  };
}
