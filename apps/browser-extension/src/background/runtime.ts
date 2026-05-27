import { createExtensionAuthRuntime } from "./auth";
import { createMacCompanionClient } from "./mac-companion";
import type { MacCompanionClient } from "./mac-companion";
import type { BackgroundRequest, BackgroundResponse } from "./protocol";
import { extensionUnlockRuntime } from "./unlock-session";
import { createUnlockedVaultReader } from "./unlocked-vault";
import { hydratePopupVaultCache } from "./vault-cache";

const defaultUnlockedVaultReader = createUnlockedVaultReader();

export type BackgroundRuntimeDeps = {
  authRuntime: ReturnType<typeof createExtensionAuthRuntime>;
  hydratePopupVaultCache(): Promise<{ ok: boolean }>;
  macCompanionClient?: MacCompanionClient;
  unlockRuntime: typeof extensionUnlockRuntime;
  unlockedVaultReader: typeof defaultUnlockedVaultReader;
};

export type BackgroundCallerContext = {
  source: "content" | "popup" | "internal";
  trustedPageUrl?: string | null;
};

function createDefaultDeps(): BackgroundRuntimeDeps {
  return {
    authRuntime: createExtensionAuthRuntime(),
    hydratePopupVaultCache,
    macCompanionClient: createMacCompanionClient(),
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
  pageOrigin: string,
  unlockedItems: Awaited<
    ReturnType<typeof defaultUnlockedVaultReader.readUnlockedLoginItems>
  >,
): BackgroundResponse {
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

async function buildMacCompanionCandidatesResponse(
  input: {
    accessToken: string;
    macCompanionClient?: MacCompanionClient;
    pageOrigin: string;
    profileId: string;
  },
): Promise<BackgroundResponse | null> {
  if (!input.macCompanionClient) {
    return null;
  }

  const metadata = await input.macCompanionClient.readCredentialMetadata({
    accessToken: input.accessToken,
    origin: input.pageOrigin,
    profileId: input.profileId,
  });

  if (metadata.status === "unavailable") {
    return null;
  }

  if (metadata.status === "locked") {
    return {
      ok: true,
      autofillCandidates: {
        status: "locked",
        matches: [],
      },
    };
  }

  if (metadata.credentials.length === 0) {
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
      matches: metadata.credentials.map((credential) => ({
        hasPassword: true,
        id: credential.id,
        title: credential.label,
        username: credential.username,
        websiteOrigin: input.pageOrigin,
        websiteUrl: input.pageOrigin,
      })),
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

function hasReleasedCredential(
  result: Awaited<ReturnType<MacCompanionClient["requestCredentialRelease"]>>,
): result is {
  credential: {
    username: string;
    password: string;
  };
} {
  return "credential" in result;
}

async function claimApprovedMacCompanionRelease(input: {
  accessToken: string;
  id: string;
  macCompanionClient: MacCompanionClient;
  origin: string;
  profileId: string;
}): Promise<BackgroundResponse> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const claim = await input.macCompanionClient.claimCredentialRelease({
      accessToken: input.accessToken,
      id: input.id,
      origin: input.origin,
      profileId: input.profileId,
    });

    if (hasReleasedCredential(claim)) {
      return {
        ok: true,
        autofillFillData: {
          status: "ready",
          fillData: claim.credential,
        },
      };
    }

    if (claim.error !== "credential_not_found") {
      break;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  return {
    ok: true,
    autofillFillData: {
      status: "approval_required",
    },
  };
}

async function buildMacCompanionFillDataResponse(input: {
  accessToken: string;
  macCompanionClient?: MacCompanionClient;
  pageOrigin: string;
  profileId: string;
}): Promise<BackgroundResponse | null> {
  if (!input.macCompanionClient) {
    return null;
  }

  const metadata = await input.macCompanionClient.readCredentialMetadata({
    accessToken: input.accessToken,
    origin: input.pageOrigin,
    profileId: input.profileId,
  });

  if (metadata.status === "unavailable") {
    return null;
  }

  if (metadata.status === "locked") {
    return {
      ok: true,
      autofillFillData: {
        status: "locked",
      },
    };
  }

  if (metadata.credentials.length === 0) {
    return {
      ok: true,
      autofillFillData: {
        status: "no_match",
      },
    };
  }

  if (metadata.credentials.length > 1) {
    return {
      ok: true,
      autofillFillData: {
        status: "multiple_matches",
        count: metadata.credentials.length,
      },
    };
  }

  const [credential] = metadata.credentials;
  const release = await input.macCompanionClient.requestCredentialRelease({
    accessToken: input.accessToken,
    id: credential.id,
    origin: input.pageOrigin,
    profileId: input.profileId,
    reason: "fill-active-page",
  });

  if (hasReleasedCredential(release)) {
    return {
      ok: true,
      autofillFillData: {
        status: "ready",
        fillData: release.credential,
      },
    };
  }

  if (release.error === "approval_required") {
    return claimApprovedMacCompanionRelease({
      accessToken: input.accessToken,
      id: credential.id,
      macCompanionClient: input.macCompanionClient,
      origin: input.pageOrigin,
      profileId: input.profileId,
    });
  }

  if (release.error === "credential_not_found") {
    return {
      ok: true,
      autofillFillData: {
        status: "no_match",
      },
    };
  }

  if (release.error === "mac_companion_unavailable") {
    return null;
  }

  return {
    ok: true,
    autofillFillData: {
      status: "approval_required",
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

      const pageOrigin = readTrustedContentPageOrigin(callerContext);

      if (!pageOrigin) {
        return {
          ok: true,
          autofillCandidates: {
            status: "no_page_url",
            matches: [],
          },
        };
      }

      const macCompanionResponse = await buildMacCompanionCandidatesResponse({
        accessToken: authState.accessToken,
        macCompanionClient: deps.macCompanionClient,
        pageOrigin,
        profileId: authState.profileId,
      });

      if (macCompanionResponse) {
        return macCompanionResponse;
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
        pageOrigin,
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

      const pageOrigin = readTrustedContentPageOrigin(callerContext);

      if (pageOrigin) {
        const macCompanionResponse = await buildMacCompanionFillDataResponse({
          accessToken: authState.accessToken,
          macCompanionClient: deps.macCompanionClient,
          pageOrigin,
          profileId: authState.profileId,
        });

        if (macCompanionResponse) {
          return macCompanionResponse;
        }
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

      if (!pageOrigin) {
        return {
          ok: true,
          autofillFillData: {
            status: "no_page_url",
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
