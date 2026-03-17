import type { ExtensionAuthState } from "../background/auth";
import type { BackgroundRequest, BackgroundResponse } from "../background/protocol";
import type { ExtensionUnlockState } from "../background/unlock-session";
import { handleBackgroundRequest } from "../background/runtime";

type ExtensionRuntime = {
  sendMessage?(request: BackgroundRequest): Promise<BackgroundResponse>;
};

function getExtensionRuntime(): ExtensionRuntime | null {
  return (
    (globalThis as {
      chrome?: {
        runtime?: ExtensionRuntime;
      };
    }).chrome?.runtime ?? null
  );
}

async function callBackground(request: BackgroundRequest): Promise<BackgroundResponse> {
  const runtime = getExtensionRuntime();

  if (runtime?.sendMessage) {
    return runtime.sendMessage(request);
  }

  return handleBackgroundRequest(request);
}

export async function readExtensionAuthStateFromBackground(): Promise<ExtensionAuthState> {
  const response = await callBackground({
    type: "read_extension_auth_state",
  });

  if (!response.ok || !("authState" in response)) {
    throw new Error(response.ok ? "Missing auth state" : response.error);
  }

  return response.authState;
}

export async function signInWithPasswordInBackground(input: {
  email: string;
  password: string;
}): Promise<ExtensionAuthState> {
  const response = await callBackground({
    type: "sign_in_with_password",
    email: input.email,
    password: input.password,
  });

  if (!response.ok || !("authState" in response)) {
    throw new Error(response.ok ? "Missing auth state" : response.error);
  }

  return response.authState;
}

export async function readExtensionUnlockStateFromBackground(): Promise<ExtensionUnlockState> {
  const response = await callBackground({
    type: "read_extension_unlock_state",
  });

  if (!response.ok || !("unlockState" in response)) {
    throw new Error(response.ok ? "Missing unlock state" : response.error);
  }

  return response.unlockState;
}

export async function unlockExtensionVaultInBackground(
  passphrase: string,
): Promise<ExtensionUnlockState> {
  const response = await callBackground({
    type: "unlock_extension_vault",
    passphrase,
  });

  if (!response.ok || !("unlockState" in response)) {
    throw new Error(response.ok ? "Missing unlock state" : response.error);
  }

  return response.unlockState;
}

export async function lockExtensionVaultInBackground(): Promise<ExtensionUnlockState> {
  const response = await callBackground({
    type: "lock_extension_vault",
  });

  if (!response.ok || !("unlockState" in response)) {
    throw new Error(response.ok ? "Missing unlock state" : response.error);
  }

  return response.unlockState;
}

export async function hydratePopupVaultCacheInBackground(): Promise<{ ok: boolean }> {
  const response = await callBackground({
    type: "hydrate_popup_vault_cache",
  });

  if (!response.ok || !("result" in response)) {
    throw new Error(response.ok ? "Missing hydrate result" : response.error);
  }

  return response.result;
}

export async function signOutInBackground(): Promise<void> {
  const response = await callBackground({
    type: "sign_out",
  });

  if (!response.ok) {
    throw new Error(response.error);
  }
}
