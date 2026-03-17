import { createExtensionAuthRuntime } from "./auth";
import type { BackgroundRequest, BackgroundResponse } from "./protocol";
import { extensionUnlockRuntime } from "./unlock-session";
import { createUnlockedVaultReader } from "./unlocked-vault";
import { hydratePopupVaultCache } from "./vault-cache";

const defaultUnlockedVaultReader = createUnlockedVaultReader();

type BackgroundRuntimeDeps = {
  authRuntime: ReturnType<typeof createExtensionAuthRuntime>;
  hydratePopupVaultCache(): Promise<{ ok: boolean }>;
  unlockRuntime: typeof extensionUnlockRuntime;
  unlockedVaultReader: typeof defaultUnlockedVaultReader;
};

function createDefaultDeps(): BackgroundRuntimeDeps {
  return {
    authRuntime: createExtensionAuthRuntime(),
    hydratePopupVaultCache,
    unlockRuntime: extensionUnlockRuntime,
    unlockedVaultReader: defaultUnlockedVaultReader,
  };
}

export async function handleBackgroundRequest(
  request: BackgroundRequest,
  deps: BackgroundRuntimeDeps = createDefaultDeps(),
): Promise<BackgroundResponse> {
  switch (request.type) {
    case "read_extension_auth_state":
      return {
        ok: true,
        authState: await deps.authRuntime.readExtensionAuthState(),
      };
    case "read_extension_unlock_state":
      return {
        ok: true,
        unlockState: await deps.unlockRuntime.readUnlockState(),
      };
    case "sign_in_with_password":
      try {
        return {
          ok: true,
          authState: await deps.authRuntime.signInWithPassword({
            email: request.email,
            password: request.password,
          }),
        };
      } catch {
        return {
          ok: false,
          error: "We couldn't sign you in. Please try again.",
        };
      }
    case "unlock_extension_vault": {
      const result = await deps.unlockRuntime.unlockWithPassphrase(request.passphrase);

      if (!result.ok) {
        return {
          ok: false,
          error: result.error,
        };
      }

      return {
        ok: true,
        unlockState: result.unlockState,
      };
    }
    case "lock_extension_vault":
      return {
        ok: true,
        unlockState: await deps.unlockRuntime.lock(),
      };
    case "read_autofill_status": {
      const authState = await deps.authRuntime.readExtensionAuthState();

      if (authState.status !== "signed_in") {
        return {
          ok: true,
          autofillStatus: {
            status: "signed_out",
          },
        };
      }

      const unlockState = await deps.unlockRuntime.readUnlockState();

      if (unlockState.mode !== "unlocked") {
        return {
          ok: true,
          autofillStatus: {
            status: "locked",
          },
        };
      }

      const unlockedItems = await deps.unlockedVaultReader.readUnlockedLoginItems();

      return {
        ok: true,
        autofillStatus: {
          status: unlockedItems.length > 0 ? "ready" : "empty",
        },
      };
    }
    case "hydrate_popup_vault_cache":
      try {
        return {
          ok: true,
          result: await deps.hydratePopupVaultCache(),
        };
      } catch {
        return {
          ok: false,
          error: "We couldn't refresh your vault.",
        };
      }
    case "sign_out":
      await deps.authRuntime.signOut();
      return {
        ok: true,
      };
  }
}
