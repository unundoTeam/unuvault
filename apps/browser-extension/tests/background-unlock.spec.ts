import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMasterPasswordVerifier,
  verifyMasterPassword,
} from "../../../packages/security/src/master-password-verifier";
import { sealVaultPassword } from "../../../packages/security/src/vault-envelope";
import { LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1 } from "../../../tests/fixtures/crypto-legacy-fixtures";
import {
  clearMasterPasswordVerifier,
  readMasterPasswordVerifier,
  writeMasterPasswordVerifier,
} from "../src/popup/master-password-storage";
import { writePopupVaultItems } from "../src/popup/popup-vault-storage";
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
  await writeMasterPasswordVerifier(await createMasterPasswordVerifier(password));
}

async function seedProtectedPopupVaultItem(passphrase: string) {
  await writePopupVaultItems([
    {
      id: "item-1",
      item_type: "login",
      title: "GitHub",
      encrypted_payload: {
        schema_version: 1,
        username: "alice@example.com",
        password_ciphertext: await sealVaultPassword("hunter2", passphrase),
        notes: "",
        website_url: "https://github.com/login",
      },
      favorite: false,
      source: "manual",
      last_used_at: null,
      created_at: "2026-03-17T00:00:00.000Z",
      updated_at: "2026-03-17T00:00:00.000Z",
    },
  ]);
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

  it("fails setup when cached protected items cannot be unlocked", async () => {
    await seedProtectedPopupVaultItem("correct horse");
    const runtime = createExtensionUnlockRuntime();

    await expect(runtime.unlockWithPassphrase("wrong battery")).resolves.toEqual({
      ok: false,
      error: "Master password must unlock existing saved passwords",
      unlockState: {
        mode: "needs_setup",
      },
    });
    await expect(readMasterPasswordVerifier()).resolves.toBeNull();
  });

  it("returns locked for a stored verifier without an active session", async () => {
    await seedVerifier("correct horse");
    const runtime = createExtensionUnlockRuntime();

    await expect(runtime.readUnlockState()).resolves.toEqual({
      mode: "locked",
    });
  });

  it("fails locked unlock when cached protected items cannot be unlocked", async () => {
    await seedVerifier("correct horse");
    await seedProtectedPopupVaultItem("different horse");
    const runtime = createExtensionUnlockRuntime();

    await expect(runtime.unlockWithPassphrase("correct horse")).resolves.toEqual({
      ok: false,
      error: "Wrong master password",
      unlockState: {
        mode: "locked",
      },
    });
  });

  it("upgrades a legacy verifier to v2 after a successful unlock", async () => {
    await writeMasterPasswordVerifier(
      LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1,
    );

    const runtime = createExtensionUnlockRuntime();

    await expect(runtime.unlockWithPassphrase("correct horse")).resolves.toEqual({
      ok: true,
      unlockState: {
        mode: "unlocked",
      },
    });

    const verifier = await readMasterPasswordVerifier();

    if (!verifier) {
      throw new Error("expected upgraded verifier");
    }

    expect(verifier).toMatchObject({
      version: 2,
      algorithm: "argon2id13",
    });

    await expect(verifyMasterPassword(verifier, "correct horse")).resolves.toEqual(
      expect.objectContaining({
        success: true,
      }),
    );
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
