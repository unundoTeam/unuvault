import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredAuthState,
  readStoredAuthState,
  writeStoredAuthState,
} from "../src/background/auth-storage";
import { createExtensionAuthRuntime } from "../src/background/auth";

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

describe("background auth runtime", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installChromeStorageMock();
  });

  it("reads signed-out state when auth storage is missing", async () => {
    const runtime = createExtensionAuthRuntime({
      bootstrapProfile: vi.fn(),
      createApiFetch: () => vi.fn(),
      createSupabaseClient: vi.fn(),
      now: () => "2026-03-17T00:00:00.000Z",
      readStoredAuthState,
      clearStoredAuthState,
      writeStoredAuthState,
    });

    await expect(runtime.readExtensionAuthState()).resolves.toEqual({
      status: "signed_out",
    });
  });

  it("reads signed-in state from persisted auth storage", async () => {
    await writeStoredAuthState({
      accessToken: "jwt-token",
      email: "user@example.com",
      profileId: "profile-1",
      signedInAt: "2026-03-17T00:00:00.000Z",
    });

    const runtime = createExtensionAuthRuntime({
      bootstrapProfile: vi.fn(),
      createApiFetch: () => vi.fn(),
      createSupabaseClient: vi.fn(),
      now: () => "2026-03-17T00:00:00.000Z",
      readStoredAuthState,
      clearStoredAuthState,
      writeStoredAuthState,
    });

    await expect(runtime.readExtensionAuthState()).resolves.toEqual({
      status: "signed_in",
      accessToken: "jwt-token",
      email: "user@example.com",
      profileId: "profile-1",
      signedInAt: "2026-03-17T00:00:00.000Z",
    });
  });

  it("signs in with password, bootstraps the profile, and persists signed-in state", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "jwt-token",
        },
        user: {
          email: "user@example.com",
        },
      },
      error: null,
    });
    const bootstrapProfile = vi.fn().mockResolvedValue({
      profile: {
        id: "profile-1",
        email: "user@example.com",
        locale: "zh-CN",
      },
    });

    const runtime = createExtensionAuthRuntime({
      bootstrapProfile,
      createApiFetch: () => vi.fn(),
      createSupabaseClient: () => ({
        auth: {
          signInWithPassword,
        },
      }),
      now: () => "2026-03-17T00:00:00.000Z",
      readStoredAuthState,
      clearStoredAuthState,
      writeStoredAuthState,
    });

    await expect(
      runtime.signInWithPassword({
        email: "user@example.com",
        password: "correct horse",
      }),
    ).resolves.toEqual({
      status: "signed_in",
      accessToken: "jwt-token",
      email: "user@example.com",
      profileId: "profile-1",
      signedInAt: "2026-03-17T00:00:00.000Z",
    });
    expect(bootstrapProfile).toHaveBeenCalledWith(expect.any(Function), "jwt-token");
    await expect(readStoredAuthState()).resolves.toEqual({
      accessToken: "jwt-token",
      email: "user@example.com",
      profileId: "profile-1",
      signedInAt: "2026-03-17T00:00:00.000Z",
    });
  });

  it("clears persisted state on signOut", async () => {
    await writeStoredAuthState({
      accessToken: "jwt-token",
      email: "user@example.com",
      profileId: "profile-1",
      signedInAt: "2026-03-17T00:00:00.000Z",
    });

    const runtime = createExtensionAuthRuntime({
      bootstrapProfile: vi.fn(),
      createApiFetch: () => vi.fn(),
      createSupabaseClient: vi.fn(),
      now: () => "2026-03-17T00:00:00.000Z",
      readStoredAuthState,
      clearStoredAuthState,
      writeStoredAuthState,
    });

    await runtime.signOut();

    await expect(runtime.readExtensionAuthState()).resolves.toEqual({
      status: "signed_out",
    });
  });
});
