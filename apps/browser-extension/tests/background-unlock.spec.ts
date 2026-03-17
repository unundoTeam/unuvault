import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMasterPasswordVerifier } from "../../../packages/security/src/master-password-verifier";
import {
  clearMasterPasswordVerifier,
  writeMasterPasswordVerifier,
} from "../src/popup/master-password-storage";
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
