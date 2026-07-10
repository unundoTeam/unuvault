import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMasterPasswordVerifier } from "../../../packages/security/src/master-password-verifier";
import {
  clearMasterPasswordVerifier,
  readMasterPasswordVerifier,
  writeMasterPasswordVerifier,
} from "../src/popup/master-password-storage";

type ChromeStorageArea = {
  get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

function installChromeStorageMock(initialValue?: unknown) {
  const store = new Map<string, unknown>();

  if (initialValue !== undefined) {
    store.set("unuvault.extension.master-password-verifier", initialValue);
  }

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

describe("extension master password storage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installChromeStorageMock();
  });

  it("round-trips a stored verifier", async () => {
    const verifier = await createMasterPasswordVerifier("correct horse");

    await writeMasterPasswordVerifier(verifier);

    await expect(readMasterPasswordVerifier()).resolves.toEqual(verifier);
  });

  it("preserves compatibility with raw-object verifiers", async () => {
    const verifier = await createMasterPasswordVerifier("correct horse");
    installChromeStorageMock(verifier);

    await expect(readMasterPasswordVerifier()).resolves.toEqual(verifier);
  });

  it("returns null when no verifier exists", async () => {
    await expect(readMasterPasswordVerifier()).resolves.toBeNull();
  });

  it("fails closed for malformed stored verifier values", async () => {
    installChromeStorageMock("{bad json");

    await expect(readMasterPasswordVerifier()).resolves.toBeNull();
  });

  it("rejects a string verifier with hostile Argon2 memory parameters", async () => {
    const verifier = await createMasterPasswordVerifier("correct horse");
    installChromeStorageMock(
      JSON.stringify({
        ...verifier,
        passwordHash: verifier.passwordHash.replace("m=65536", "m=1048576"),
      }),
    );

    await expect(readMasterPasswordVerifier()).resolves.toBeNull();
  });

  it("rejects a raw-object verifier with hostile Argon2 memory parameters", async () => {
    const verifier = await createMasterPasswordVerifier("correct horse");
    installChromeStorageMock({
      ...verifier,
      passwordHash: verifier.passwordHash.replace("m=65536", "m=1048576"),
    });

    await expect(readMasterPasswordVerifier()).resolves.toBeNull();
  });

  it("rejects oversized stored verifier JSON before parsing", async () => {
    const verifier = await createMasterPasswordVerifier("correct horse");
    installChromeStorageMock(JSON.stringify(verifier).padEnd(513, " "));

    await expect(readMasterPasswordVerifier()).resolves.toBeNull();
  });

  it("clears the stored verifier", async () => {
    await writeMasterPasswordVerifier(await createMasterPasswordVerifier("correct horse"));

    await clearMasterPasswordVerifier();

    await expect(readMasterPasswordVerifier()).resolves.toBeNull();
  });
});
