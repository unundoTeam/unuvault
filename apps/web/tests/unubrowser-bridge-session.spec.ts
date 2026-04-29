import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultSyncItem } from "../../../packages/api-client/src/vault";
import { sealVaultPassword } from "../../../packages/security/src/vault-envelope";

describe("unubrowser bridge session publisher", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://127.0.0.1:3000");
  });

  function createVaultItem(
    overrides?: Partial<VaultSyncItem>,
  ): VaultSyncItem {
    return {
      id: "550e8400-e29b-41d4-a716-446655440000",
      item_type: "login",
      title: "Developer console client A",
      encrypted_payload: {
        schema_version: 1,
        username: "client-a@example.com",
        password_ciphertext: "",
        notes: "",
        website_url: "https://console.example.com/login",
      },
      favorite: false,
      source: "manual",
      last_used_at: null,
      created_at: "2026-04-29T00:00:00.000Z",
      updated_at: "2026-04-29T00:00:00.000Z",
      ...overrides,
    };
  }

  it("publishes decrypted login credentials for the unlocked local bridge session", async () => {
    const { publishUnubrowserBridgeSession } = await import(
      "../src/lib/unubrowser/bridge-session"
    );
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        credential_count: 1,
      }),
    });
    const protectedItem = createVaultItem({
      encrypted_payload: {
        schema_version: 1,
        username: "client-a@example.com",
        password_ciphertext: await sealVaultPassword(
          "client-a-password",
          "correct horse",
        ),
        notes: "",
        website_url: "https://console.example.com/login",
      },
    });
    const emptyPasswordItem = createVaultItem({
      id: "550e8400-e29b-41d4-a716-446655440001",
      encrypted_payload: {
        schema_version: 1,
        username: "empty@example.com",
        password_ciphertext: "",
        notes: "",
        website_url: "https://console.example.com/login",
      },
    });

    await expect(
      publishUnubrowserBridgeSession({
        accessToken: "browser-jwt",
        fetcher,
        items: [protectedItem, emptyPasswordItem],
        unlockPassphrase: "correct horse",
      }),
    ).resolves.toEqual({
      ok: true,
      credential_count: 1,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/v1/credentials/unlocked-session",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          authorization: "Bearer browser-jwt",
          "content-type": "application/json",
        }),
      }),
    );
    const body = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as {
      credentials: unknown[];
    };

    expect(body).toEqual({
      credentials: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          label: "Developer console client A",
          password: "client-a-password",
          username: "client-a@example.com",
          websiteOrigin: "https://console.example.com",
        },
      ],
    });
  });

  it("clears the unlocked local bridge session", async () => {
    const { clearUnubrowserBridgeSession } = await import(
      "../src/lib/unubrowser/bridge-session"
    );
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await expect(
      clearUnubrowserBridgeSession({
        accessToken: "browser-jwt",
        fetcher,
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/v1/credentials/unlocked-session",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          authorization: "Bearer browser-jwt",
        }),
      }),
    );
  });
});
