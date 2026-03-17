import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultSyncItem } from "../../../packages/api-client/src/vault";
import { sealVaultPassword } from "../../../packages/security/src/vault-envelope";
import { writePopupVaultItems } from "../src/popup/popup-vault-storage";
import { createUnlockedVaultReader } from "../src/background/unlocked-vault";

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

function createEncryptedVaultItem(): VaultSyncItem {
  return createVaultItem({
    encrypted_payload: {
      schema_version: 1,
      username: "alice@example.com",
      password_ciphertext: sealVaultPassword("hunter2", "correct horse"),
      notes: "",
    },
  });
}

describe("background unlocked vault reader", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installChromeStorageMock();
  });

  it("returns no readable items when signed out", async () => {
    const reader = createUnlockedVaultReader({
      readExtensionAuthState: async () => ({
        status: "signed_out" as const,
      }),
      readUnlockPassphrase: async () => "correct horse",
    });

    await expect(reader.readUnlockedLoginItems()).resolves.toEqual([]);
  });

  it("returns no readable items when signed in but locked", async () => {
    await writePopupVaultItems([createEncryptedVaultItem()]);
    const reader = createUnlockedVaultReader({
      readExtensionAuthState: async () => ({
        status: "signed_in" as const,
        accessToken: "jwt-token",
        email: "user@example.com",
        profileId: "profile-1",
        signedInAt: "2026-03-17T00:00:00.000Z",
      }),
      readUnlockPassphrase: async () => null,
    });

    await expect(reader.readUnlockedLoginItems()).resolves.toEqual([]);
  });

  it("returns decrypted login items when signed in and unlocked", async () => {
    await writePopupVaultItems([createEncryptedVaultItem()]);
    const reader = createUnlockedVaultReader({
      readExtensionAuthState: async () => ({
        status: "signed_in" as const,
        accessToken: "jwt-token",
        email: "user@example.com",
        profileId: "profile-1",
        signedInAt: "2026-03-17T00:00:00.000Z",
      }),
      readUnlockPassphrase: async () => "correct horse",
    });

    await expect(reader.readUnlockedLoginItems()).resolves.toEqual([
      {
        hasPassword: true,
        id: "item-1",
        password: "hunter2",
        title: "GitHub",
        username: "alice@example.com",
      },
    ]);
  });
});
