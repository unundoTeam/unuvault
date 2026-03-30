import { syncVault } from "../../../../packages/api-client/src/vault";
import { readExtensionAuthState } from "./auth";
import { writePopupVaultItems } from "../popup/popup-vault-storage";

type SyncFetcher = Parameters<typeof syncVault>[0];

type VaultCacheHydratorDeps = {
  createApiFetch(): SyncFetcher;
  readExtensionAuthState: typeof readExtensionAuthState;
  syncVault: typeof syncVault;
  writePopupVaultItems: typeof writePopupVaultItems;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function createApiFetch(): SyncFetcher {
  return (input, init) => fetch(`${API_BASE_URL}${input}`, init) as ReturnType<SyncFetcher>;
}

function createDefaultDeps(): VaultCacheHydratorDeps {
  return {
    createApiFetch,
    readExtensionAuthState,
    syncVault,
    writePopupVaultItems,
  };
}

export function createVaultCacheHydrator(
  deps: Partial<VaultCacheHydratorDeps> = {},
) {
  const resolvedDeps = {
    ...createDefaultDeps(),
    ...deps,
  };

  return {
    async hydratePopupVaultCache(): Promise<{ ok: boolean }> {
      const authState = await resolvedDeps.readExtensionAuthState();

      if (authState.status !== "signed_in") {
        return { ok: false };
      }

      const response = await resolvedDeps.syncVault(
        resolvedDeps.createApiFetch(),
        authState.accessToken,
        {
          changed_items: [],
          deleted_item_ids: [],
        },
      );

      await resolvedDeps.writePopupVaultItems(response.updated_items);

      return { ok: true };
    },
  };
}

export async function hydratePopupVaultCache(): Promise<{ ok: boolean }> {
  return createVaultCacheHydrator().hydratePopupVaultCache();
}
