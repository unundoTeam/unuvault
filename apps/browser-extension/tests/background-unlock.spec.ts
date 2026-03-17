import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMasterPasswordVerifier } from "../../../packages/security/src/master-password-verifier";
import {
  clearMasterPasswordVerifier,
  writeMasterPasswordVerifier,
} from "../src/popup/master-password-storage";
import { handleBackgroundRequest } from "../src/background/runtime";
import { createExtensionUnlockRuntime } from "../src/background/unlock-session";

type ChromeStorageArea = {
  get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

function installChromeStorageMock() {
  const store = new Map<string, unknown>();

  const storageArea: ChromeStorageArea = {
    async get(keys) {
      const key =
        typeof keys === "string"
          ? keys
          : Array.isArray(keys)
            ? keys[0]
            : Object.keys(keys)[0];

      return key ? { [key]: store.get(key) } : {};
    },
    async set(items) {
      Object.entries(items).forEach(([key, value]) => {
        store.set(key, value);
      });
    },
    async remove(keys) {
      const keyList = Array.isArray(keys) ? keys : [keys];

      keyList.forEach((key) => {
        store.delete(key);
      });
    },
  };

  vi.stubGlobal("chrome", {
    storage: {
      local: storageArea,
    },
  });
}

async function seedVerifier(password: string) {
  await writeMasterPasswordVerifier(createMasterPasswordVerifier(password));
}

describe("background unlock runtime", () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    installChromeStorageMock();
    await clearMasterPasswordVerifier();
  });

  it("reports needs_setup when no verifier exists", async () => {
    const runtime = createExtensionUnlockRuntime();

    await expect(runtime.readUnlockState()).resolves.toEqual({
      mode: "needs_setup",
    });
  });

  it("creates a verifier and unlocks on first setup", async () => {
    const runtime = createExtensionUnlockRuntime();

    await expect(runtime.unlockWithPassphrase("correct horse")).resolves.toEqual({
      ok: true,
      unlockState: {
        mode: "unlocked",
      },
    });
  });

  it("returns locked for a stored verifier without an active session", async () => {
    await seedVerifier("correct horse");
    const runtime = createExtensionUnlockRuntime();

    await expect(runtime.readUnlockState()).resolves.toEqual({
      mode: "locked",
    });
  });
});

describe("background unlock protocol", () => {
  it("routes read_extension_unlock_state through the background runtime", async () => {
    const readUnlockState = vi.fn().mockResolvedValue({
      mode: "locked",
    });

    const response = await handleBackgroundRequest(
      {
        type: "read_extension_unlock_state",
      },
      {
        authRuntime: {
          readExtensionAuthState: vi.fn(),
          signInWithPassword: vi.fn(),
          signOut: vi.fn(),
        },
        hydratePopupVaultCache: vi.fn(),
        unlockRuntime: {
          lock: vi.fn(),
          readUnlockPassphrase: vi.fn(),
          readUnlockState,
          unlockWithPassphrase: vi.fn(),
        },
        unlockedVaultReader: {
          readUnlockedLoginItems: vi.fn(),
        },
      },
    );

    expect(response).toEqual({
      ok: true,
      unlockState: {
        mode: "locked",
      },
    });
    expect(readUnlockState).toHaveBeenCalledTimes(1);
  });

  it("routes unlock_extension_vault and lock_extension_vault through the background runtime", async () => {
    const unlockWithPassphrase = vi.fn().mockResolvedValue({
      ok: true,
      unlockState: {
        mode: "unlocked",
      },
    });
    const lock = vi.fn().mockResolvedValue({
      mode: "locked",
    });
    const deps = {
      authRuntime: {
        readExtensionAuthState: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
      },
      hydratePopupVaultCache: vi.fn(),
      unlockRuntime: {
        lock,
        readUnlockPassphrase: vi.fn(),
        readUnlockState: vi.fn(),
        unlockWithPassphrase,
      },
      unlockedVaultReader: {
        readUnlockedLoginItems: vi.fn(),
      },
    };

    await expect(
      handleBackgroundRequest(
        {
          type: "unlock_extension_vault",
          passphrase: "correct horse",
        },
        deps,
      ),
    ).resolves.toEqual({
      ok: true,
      unlockState: {
        mode: "unlocked",
      },
    });
    await expect(
      handleBackgroundRequest(
        {
          type: "lock_extension_vault",
        },
        deps,
      ),
    ).resolves.toEqual({
      ok: true,
      unlockState: {
        mode: "locked",
      },
    });
    expect(unlockWithPassphrase).toHaveBeenCalledWith("correct horse");
    expect(lock).toHaveBeenCalledTimes(1);
  });
});
