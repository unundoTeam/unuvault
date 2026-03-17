import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredAuthState,
  readStoredAuthState,
  writeStoredAuthState,
} from "../src/background/auth-storage";

const AUTH_STORAGE_KEY = "unuvault.extension.auth-state";

type ChromeStorageArea = {
  get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

function installChromeStorageMock(initialValue?: unknown) {
  const store = new Map<string, unknown>();

  if (initialValue !== undefined) {
    store.set(AUTH_STORAGE_KEY, initialValue);
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

describe("background auth storage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installChromeStorageMock();
  });

  it("returns null when auth storage is missing", async () => {
    await expect(readStoredAuthState()).resolves.toBeNull();
  });

  it("fails closed for malformed auth storage values", async () => {
    installChromeStorageMock("{bad json");

    await expect(readStoredAuthState()).resolves.toBeNull();
  });

  it("round-trips a stored auth state", async () => {
    const authState = {
      accessToken: "jwt-token",
      email: "user@example.com",
      profileId: "profile-1",
      signedInAt: "2026-03-17T00:00:00.000Z",
    };

    await writeStoredAuthState(authState);

    await expect(readStoredAuthState()).resolves.toEqual(authState);
  });

  it("clears persisted auth state", async () => {
    await writeStoredAuthState({
      accessToken: "jwt-token",
      email: "user@example.com",
      profileId: "profile-1",
      signedInAt: "2026-03-17T00:00:00.000Z",
    });

    await clearStoredAuthState();

    await expect(readStoredAuthState()).resolves.toBeNull();
  });
});
