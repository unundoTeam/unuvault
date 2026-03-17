import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultSyncItem } from "../../../packages/api-client/src/vault";
import { readPopupVaultItems } from "../src/popup/popup-vault-storage";

const POPUP_VAULT_STORAGE_KEY = "unuvault.extension.popup-vault-items";

type ChromeStorageArea = {
  get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
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
    },
    favorite: false,
    source: "manual",
    last_used_at: null,
    created_at: "2026-03-17T00:00:00.000Z",
    updated_at: "2026-03-17T00:00:00.000Z",
    ...overrides,
  };
}

function installChromeStorageMock(initialValue?: unknown) {
  const store = new Map<string, unknown>();

  if (initialValue !== undefined) {
    store.set(POPUP_VAULT_STORAGE_KEY, initialValue);
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
  };

  vi.stubGlobal("chrome", {
    storage: {
      local: storageArea,
    },
  });
}

describe("popup vault storage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installChromeStorageMock();
  });

  it("reads a cached vault list from extension storage", async () => {
    installChromeStorageMock(JSON.stringify([createVaultItem()]));

    await expect(readPopupVaultItems()).resolves.toEqual([createVaultItem()]);
  });

  it("returns an empty list when the vault cache key is missing", async () => {
    await expect(readPopupVaultItems()).resolves.toEqual([]);
  });

  it("returns an empty list for malformed cached values", async () => {
    installChromeStorageMock("{bad json");

    await expect(readPopupVaultItems()).resolves.toEqual([]);
  });

  it("fails closed when extension storage is unavailable", async () => {
    vi.unstubAllGlobals();

    await expect(readPopupVaultItems()).resolves.toEqual([]);
  });
});
