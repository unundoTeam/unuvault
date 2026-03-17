import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultSyncItem } from "../../../packages/api-client/src/vault";
import { sealVaultPassword } from "../../../packages/security/src/vault-envelope";
import { handleBackgroundRequest } from "../src/background/runtime";
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

function createEncryptedVaultItem(): VaultSyncItem {
  return createVaultItem({
    encrypted_payload: {
      schema_version: 1,
      username: "alice@example.com",
      password_ciphertext: sealVaultPassword("hunter2", "correct horse"),
      notes: "",
      website_url: "https://github.com/login",
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
        websiteHostname: "github.com",
        websiteOrigin: "https://github.com",
        websiteUrl: "https://github.com/login",
      },
    ]);
  });
});

describe("background autofill status", () => {
  function createDeps(options: {
    authState: { status: "signed_out" } | {
      status: "signed_in";
      accessToken: string;
      email: string;
      profileId: string;
      signedInAt: string;
    };
    items: Array<{
      hasPassword: boolean;
      id: string;
      password: string;
      title: string;
      username: string;
      websiteHostname?: string;
      websiteOrigin?: string;
      websiteUrl?: string;
    }>;
    unlockMode: "needs_setup" | "locked" | "unlocked";
  }) {
    return {
      authRuntime: {
        readExtensionAuthState: vi.fn().mockResolvedValue(options.authState),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
      },
      hydratePopupVaultCache: vi.fn(),
      unlockRuntime: {
        lock: vi.fn(),
        readUnlockPassphrase: vi.fn(),
        readUnlockState: vi.fn().mockResolvedValue({
          mode: options.unlockMode,
        }),
        unlockWithPassphrase: vi.fn(),
      },
      unlockedVaultReader: {
        readUnlockedLoginItems: vi.fn().mockResolvedValue(options.items),
      },
    };
  }

  it("returns signed_out autofill status when auth is missing", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_status",
      },
      createDeps({
        authState: {
          status: "signed_out",
        },
        items: [],
        unlockMode: "locked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillStatus: {
        status: "signed_out",
      },
    });
  });

  it("returns locked autofill status when auth exists but unlock is locked", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_status",
      },
      createDeps({
        authState: {
          status: "signed_in",
          accessToken: "jwt-token",
          email: "user@example.com",
          profileId: "profile-1",
          signedInAt: "2026-03-17T00:00:00.000Z",
        },
        items: [],
        unlockMode: "locked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillStatus: {
        status: "locked",
      },
    });
  });

  it("returns empty autofill status when no readable login items exist", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_status",
      },
      createDeps({
        authState: {
          status: "signed_in",
          accessToken: "jwt-token",
          email: "user@example.com",
          profileId: "profile-1",
          signedInAt: "2026-03-17T00:00:00.000Z",
        },
        items: [],
        unlockMode: "unlocked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillStatus: {
        status: "empty",
      },
    });
  });

  it("returns ready autofill status when at least one readable login item exists", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_status",
      },
      createDeps({
        authState: {
          status: "signed_in",
          accessToken: "jwt-token",
          email: "user@example.com",
          profileId: "profile-1",
          signedInAt: "2026-03-17T00:00:00.000Z",
        },
        items: [
          {
            hasPassword: true,
            id: "item-1",
            password: "hunter2",
            title: "GitHub",
            username: "alice@example.com",
          },
        ],
        unlockMode: "unlocked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillStatus: {
        status: "ready",
      },
    });
  });

  it("returns ready autofill candidates when page origin exactly matches websiteOrigin", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_candidates",
        pageUrl: "https://github.com/login",
      } as never,
      createDeps({
        authState: {
          status: "signed_in",
          accessToken: "jwt-token",
          email: "user@example.com",
          profileId: "profile-1",
          signedInAt: "2026-03-17T00:00:00.000Z",
        },
        items: [
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
        ],
        unlockMode: "unlocked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillCandidates: {
        status: "ready",
        matches: [
          {
            hasPassword: true,
            id: "item-1",
            title: "GitHub",
            username: "alice@example.com",
            websiteOrigin: "https://github.com",
            websiteUrl: "https://github.com/login",
          },
        ],
      },
    });
  });

  it("returns no_match when page origin differs from the item subdomain", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_candidates",
        pageUrl: "https://app.github.com/login",
      } as never,
      createDeps({
        authState: {
          status: "signed_in",
          accessToken: "jwt-token",
          email: "user@example.com",
          profileId: "profile-1",
          signedInAt: "2026-03-17T00:00:00.000Z",
        },
        items: [
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
        ],
        unlockMode: "unlocked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillCandidates: {
        status: "no_match",
        matches: [],
      },
    });
  });

  it("returns no_page_url when pageUrl is invalid", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_candidates",
        pageUrl: "not a url",
      } as never,
      createDeps({
        authState: {
          status: "signed_in",
          accessToken: "jwt-token",
          email: "user@example.com",
          profileId: "profile-1",
          signedInAt: "2026-03-17T00:00:00.000Z",
        },
        items: [
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
        ],
        unlockMode: "unlocked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillCandidates: {
        status: "no_page_url",
        matches: [],
      },
    });
  });

  it("returns signed_out autofill fill data when auth is missing", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_fill_data",
        pageUrl: "https://github.com/login",
      } as never,
      createDeps({
        authState: {
          status: "signed_out",
        },
        items: [],
        unlockMode: "locked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillFillData: {
        status: "signed_out",
      },
    });
  });

  it("returns locked autofill fill data when unlock is not active", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_fill_data",
        pageUrl: "https://github.com/login",
      } as never,
      createDeps({
        authState: {
          status: "signed_in",
          accessToken: "jwt-token",
          email: "user@example.com",
          profileId: "profile-1",
          signedInAt: "2026-03-17T00:00:00.000Z",
        },
        items: [],
        unlockMode: "locked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillFillData: {
        status: "locked",
      },
    });
  });

  it("returns no_page_url autofill fill data when pageUrl is invalid", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_fill_data",
        pageUrl: "not a url",
      } as never,
      createDeps({
        authState: {
          status: "signed_in",
          accessToken: "jwt-token",
          email: "user@example.com",
          profileId: "profile-1",
          signedInAt: "2026-03-17T00:00:00.000Z",
        },
        items: [],
        unlockMode: "unlocked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillFillData: {
        status: "no_page_url",
      },
    });
  });

  it("returns no_match autofill fill data when no exact-origin match exists", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_fill_data",
        pageUrl: "https://app.github.com/login",
      } as never,
      createDeps({
        authState: {
          status: "signed_in",
          accessToken: "jwt-token",
          email: "user@example.com",
          profileId: "profile-1",
          signedInAt: "2026-03-17T00:00:00.000Z",
        },
        items: [
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
        ],
        unlockMode: "unlocked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillFillData: {
        status: "no_match",
      },
    });
  });

  it("returns multiple_matches when more than one exact-origin match exists", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_fill_data",
        pageUrl: "https://github.com/login",
      } as never,
      createDeps({
        authState: {
          status: "signed_in",
          accessToken: "jwt-token",
          email: "user@example.com",
          profileId: "profile-1",
          signedInAt: "2026-03-17T00:00:00.000Z",
        },
        items: [
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
          {
            hasPassword: true,
            id: "item-2",
            password: "opensesame",
            title: "GitHub alt",
            username: "bob@example.com",
            websiteHostname: "github.com",
            websiteOrigin: "https://github.com",
            websiteUrl: "https://github.com/session",
          },
        ],
        unlockMode: "unlocked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillFillData: {
        status: "multiple_matches",
        count: 2,
      },
    });
  });

  it("returns no_password when the only exact-origin match has no password", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_fill_data",
        pageUrl: "https://github.com/login",
      } as never,
      createDeps({
        authState: {
          status: "signed_in",
          accessToken: "jwt-token",
          email: "user@example.com",
          profileId: "profile-1",
          signedInAt: "2026-03-17T00:00:00.000Z",
        },
        items: [
          {
            hasPassword: false,
            id: "item-1",
            password: "",
            title: "GitHub",
            username: "alice@example.com",
            websiteHostname: "github.com",
            websiteOrigin: "https://github.com",
            websiteUrl: "https://github.com/login",
          },
        ],
        unlockMode: "unlocked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillFillData: {
        status: "no_password",
      },
    });
  });

  it("returns ready autofill fill data when exactly one exact-origin match has a password", async () => {
    const response = await handleBackgroundRequest(
      {
        type: "read_autofill_fill_data",
        pageUrl: "https://github.com/login",
      } as never,
      createDeps({
        authState: {
          status: "signed_in",
          accessToken: "jwt-token",
          email: "user@example.com",
          profileId: "profile-1",
          signedInAt: "2026-03-17T00:00:00.000Z",
        },
        items: [
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
        ],
        unlockMode: "unlocked",
      }),
    );

    expect(response).toEqual({
      ok: true,
      autofillFillData: {
        status: "ready",
        fillData: {
          password: "hunter2",
          username: "alice@example.com",
        },
      },
    });
  });
});
