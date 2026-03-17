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

type BackgroundCallerContext = {
  source: "content" | "popup" | "internal";
  trustedPageUrl?: string | null;
};

function createDefaultDeps(): BackgroundRuntimeDeps {
  return {
    authRuntime: createExtensionAuthRuntime(),
    hydratePopupVaultCache,
    unlockRuntime: extensionUnlockRuntime,
    unlockedVaultReader: defaultUnlockedVaultReader,
  };
}

function readPageOrigin(pageUrl: string) {
  try {
    return new URL(pageUrl).origin;
  } catch {
    return null;
  }
}

function buildAutofillCandidatesResponse(
  pageUrl: string,
  unlockedItems: Awaited<
    ReturnType<typeof defaultUnlockedVaultReader.readUnlockedLoginItems>
  >,
): BackgroundResponse {
  const pageOrigin = readPageOrigin(pageUrl);

  if (!pageOrigin) {
    return {
      ok: true,
      autofillCandidates: {
        status: "no_page_url",
        matches: [],
      },
    };
  }

  const matches = unlockedItems
    .filter((item) => item.websiteOrigin === pageOrigin)
    .map((item) => ({
      hasPassword: item.hasPassword,
      id: item.id,
      title: item.title,
      username: item.username,
      websiteOrigin: item.websiteOrigin,
      websiteUrl: item.websiteUrl,
    }));

  if (matches.length === 0) {
    return {
      ok: true,
      autofillCandidates: {
        status: "no_match",
        matches: [],
      },
    };
  }

  return {
    ok: true,
    autofillCandidates: {
      status: "ready",
      matches,
    },
  };
}

function readTrustedContentPageOrigin(callerContext: BackgroundCallerContext) {
  if (callerContext.source !== "content") {
    return null;
  }

  return callerContext.trustedPageUrl
    ? readPageOrigin(callerContext.trustedPageUrl)
    : null;
}

function buildAutofillFillDataResponse(
  callerContext: BackgroundCallerContext,
  unlockedItems: Awaited<
    ReturnType<typeof defaultUnlockedVaultReader.readUnlockedLoginItems>
  >,
): BackgroundResponse {
  const pageOrigin = readTrustedContentPageOrigin(callerContext);

  if (!pageOrigin) {
    return {
      ok: true,
      autofillFillData: {
        status: "no_page_url",
      },
    };
  }

  const matches = unlockedItems.filter((item) => item.websiteOrigin === pageOrigin);

  if (matches.length === 0) {
    return {
      ok: true,
      autofillFillData: {
        status: "no_match",
      },
    };
  }

  if (matches.length > 1) {
    return {
      ok: true,
      autofillFillData: {
        status: "multiple_matches",
        count: matches.length,
      },
    };
  }

  const [match] = matches;

  if (!match.password) {
    return {
      ok: true,
      autofillFillData: {
        status: "no_password",
      },
    };
  }

  return {
    ok: true,
    autofillFillData: {
      status: "ready",
      fillData: {
        password: match.password,
        username: match.username,
      },
    },
  };
}

export async function handleBackgroundRequest(
  request: BackgroundRequest,
  deps: BackgroundRuntimeDeps = createDefaultDeps(),
  callerContext: BackgroundCallerContext = {
    source: "internal",
  },
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
    case "read_autofill_candidates": {
      const authState = await deps.authRuntime.readExtensionAuthState();

      if (authState.status !== "signed_in") {
        return {
          ok: true,
          autofillCandidates: {
            status: "signed_out",
            matches: [],
          },
        };
      }

      const unlockState = await deps.unlockRuntime.readUnlockState();

      if (unlockState.mode !== "unlocked") {
        return {
          ok: true,
          autofillCandidates: {
            status: "locked",
            matches: [],
          },
        };
      }

      return buildAutofillCandidatesResponse(
        request.pageUrl,
        await deps.unlockedVaultReader.readUnlockedLoginItems(),
      );
    }
    case "read_autofill_fill_data": {
      const authState = await deps.authRuntime.readExtensionAuthState();

      if (authState.status !== "signed_in") {
        return {
          ok: true,
          autofillFillData: {
            status: "signed_out",
          },
        };
      }

      const unlockState = await deps.unlockRuntime.readUnlockState();

      if (unlockState.mode !== "unlocked") {
        return {
          ok: true,
          autofillFillData: {
            status: "locked",
          },
        };
      }

      return buildAutofillFillDataResponse(
        callerContext,
        await deps.unlockedVaultReader.readUnlockedLoginItems(),
      );
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
