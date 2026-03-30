import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackgroundRequest, BackgroundResponse } from "../src/background/protocol";

type MessageSender = {
  tab?: {
    url?: string | null;
  } | null;
  url?: string;
};

type MessageListener = (
  request: BackgroundRequest,
  sender: MessageSender,
  sendResponse: (response: BackgroundResponse) => void,
) => boolean | void;

function createSignedInDeps() {
  return {
    authRuntime: {
      readExtensionAuthState: vi.fn().mockResolvedValue({
        status: "signed_in" as const,
        accessToken: "jwt-token",
        email: "user@example.com",
        profileId: "profile-1",
        signedInAt: "2026-03-17T00:00:00.000Z",
      }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    hydratePopupVaultCache: vi.fn(),
    unlockRuntime: {
      lock: vi.fn(),
      readUnlockPassphrase: vi.fn(),
      readUnlockState: vi.fn().mockResolvedValue({
        mode: "unlocked" as const,
      }),
      unlockWithPassphrase: vi.fn(),
    },
    unlockedVaultReader: {
      readUnlockedLoginItems: vi.fn().mockResolvedValue([
        {
          hasPassword: true,
          id: "item-1",
          password: "hunter2",
          title: "GitHub",
          username: "alice@example.com",
          websiteHostname: "github.com",
          websiteOrigin: "https://github.com",
          websiteUrl: "https://github.com/login",
        },
      ]),
    },
  };
}

async function invokeListener(
  listener: MessageListener,
  request: BackgroundRequest,
  sender: MessageSender,
) {
  return new Promise<BackgroundResponse>((resolve) => {
    const result = listener(request, sender, (response) => {
      resolve(response);
    });

    if (result !== true) {
      resolve({
        ok: false,
        error: "Listener did not respond asynchronously",
      });
    }
  });
}

describe("background message bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("registers a runtime onMessage listener", async () => {
    const addListener = vi.fn();

    vi.stubGlobal("chrome", {
      runtime: {
        id: "extension-id",
        onMessage: {
          addListener,
        },
      },
    });

    const bridge = await import("../src/background/index");

    expect(typeof bridge.registerBackgroundMessageBridge).toBe("function");
    expect(addListener).toHaveBeenCalledTimes(1);
  });

  it("maps sender.tab.url into trusted content caller context", async () => {
    const handleRequest = vi.fn().mockResolvedValue({
      ok: true,
      authState: {
        status: "signed_out" as const,
      },
    });

    const bridge = await import("../src/background/index");
    const listener = bridge.createBackgroundMessageListener({
      extensionOrigin: "chrome-extension://extension-id/",
      handleRequest,
    });

    const response = await invokeListener(
      listener,
      {
        type: "read_extension_auth_state",
      },
      {
        tab: {
          url: "https://github.com/login",
        },
      },
    );

    expect(handleRequest).toHaveBeenCalledWith(
      {
        type: "read_extension_auth_state",
      },
      undefined,
      {
        source: "content",
        trustedPageUrl: "https://github.com/login",
      },
    );
    expect(response).toEqual({
      ok: true,
      authState: {
        status: "signed_out",
      },
    });
  });

  it("maps extension-page senders to popup caller context", async () => {
    const handleRequest = vi.fn().mockResolvedValue({
      ok: true,
      authState: {
        status: "signed_out" as const,
      },
    });

    const bridge = await import("../src/background/index");
    const listener = bridge.createBackgroundMessageListener({
      extensionOrigin: "chrome-extension://extension-id/",
      handleRequest,
    });

    await invokeListener(
      listener,
      {
        type: "read_extension_auth_state",
      },
      {
        url: "chrome-extension://extension-id/popup.html",
      },
    );

    expect(handleRequest).toHaveBeenCalledWith(
      {
        type: "read_extension_auth_state",
      },
      undefined,
      {
        source: "popup",
        trustedPageUrl: null,
      },
    );
  });

  it("fails closed on password fill-data reads from popup senders", async () => {
    const bridge = await import("../src/background/index");
    const listener = bridge.createBackgroundMessageListener({
      deps: createSignedInDeps(),
      extensionOrigin: "chrome-extension://extension-id/",
    });

    const response = await invokeListener(
      listener,
      {
        type: "read_autofill_fill_data",
      },
      {
        url: "chrome-extension://extension-id/popup.html",
      },
    );

    expect(response).toEqual({
      ok: true,
      autofillFillData: {
        status: "no_page_url",
      },
    });
  });
});
