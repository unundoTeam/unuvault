import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultSyncItem } from "../../../packages/api-client/src/vault";
import { readPopupVaultItems } from "../src/popup/popup-vault-storage";
import { createVaultCacheHydrator } from "../src/background/vault-cache";

type ChromeStorageArea = {
  get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
};

function createVaultItem(overrides?: Partial<VaultSyncItem>): VaultSyncItem {
  return {
    id: "item-1",
    item_type: "login",
    title: "GitHub",
    encrypted_payload: {
      schema_version: 1,
      username: "alice@example.com",
      password_ciphertext: "",
      notes: "",
      website_url: "",
    },
    favorite: false,
    source: "manual",
    last_used_at: null,
    created_at: "2026-03-17T00:00:00.000Z",
    updated_at: "2026-03-17T00:00:00.000Z",
    ...overrides,
  };
}

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

describe("vault cache hydration", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installChromeStorageMock();
  });

  it("hydrates popup vault cache from syncVault for a signed-in session", async () => {
    const syncVault = vi.fn().mockResolvedValue({
      server_time: "2026-03-17T00:00:00.000Z",
      updated_items: [createVaultItem()],
      deleted_item_ids: [],
      conflicts: [],
    });
    const hydrator = createVaultCacheHydrator({
      createApiFetch: () => vi.fn(),
      readExtensionAuthState: async () => ({
        status: "signed_in" as const,
        accessToken: "jwt-token",
        email: "user@example.com",
        profileId: "profile-1",
        signedInAt: "2026-03-17T00:00:00.000Z",
      }),
      syncVault,
    });

    await expect(hydrator.hydratePopupVaultCache()).resolves.toEqual({ ok: true });
    await expect(readPopupVaultItems()).resolves.toEqual([createVaultItem()]);
    expect(syncVault).toHaveBeenCalledWith(expect.any(Function), "jwt-token", {
      changed_items: [],
      deleted_item_ids: [],
    });
  });

  it("does not hydrate when the extension is signed out", async () => {
    const syncVault = vi.fn();
    const hydrator = createVaultCacheHydrator({
      createApiFetch: () => vi.fn(),
      readExtensionAuthState: async () => ({
        status: "signed_out" as const,
      }),
      syncVault,
    });

    await expect(hydrator.hydratePopupVaultCache()).resolves.toEqual({ ok: false });
    expect(syncVault).not.toHaveBeenCalled();
    await expect(readPopupVaultItems()).resolves.toEqual([]);
  });
});
