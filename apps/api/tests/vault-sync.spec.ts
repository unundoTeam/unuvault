import Fastify from "fastify";
import { afterAll, describe, expect, it } from "vitest";
import { createVaultSyncRoutes } from "../src/routes/vault-sync";
import {
  VaultSyncProfileNotFoundError,
  VaultSyncUnauthorizedError,
} from "../src/services/vault-service";

describe("POST /vault/sync", () => {
  const app = Fastify();

  app.register(
    createVaultSyncRoutes({
      syncVaultFromToken: async () => ({
        server_time: "2026-03-15T00:00:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              ciphertext: "abc",
            },
            favorite: true,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-14T00:00:00.000Z",
            updated_at: "2026-03-15T00:00:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      }),
    }),
    { prefix: "/vault" },
  );

  afterAll(async () => {
    await app.close();
  });

  it("rejects sync without a bearer token", async () => {
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/vault/sync",
      payload: { changed_items: [] },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      error: "missing_bearer_token",
    });
  });

  it("returns profile_not_found when the token has no users_profile", async () => {
    const profileMissingApp = Fastify();

    profileMissingApp.register(
      createVaultSyncRoutes({
        syncVaultFromToken: async () => {
          throw new VaultSyncProfileNotFoundError("profile not found");
        },
      }),
      { prefix: "/vault" },
    );

    await profileMissingApp.ready();

    const response = await profileMissingApp.inject({
      method: "POST",
      url: "/vault/sync",
      headers: {
        authorization: "Bearer jwt-token",
      },
      payload: { changed_items: [] },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      error: "profile_not_found",
    });

    await profileMissingApp.close();
  });

  it("returns invalid_token when the token cannot be resolved", async () => {
    const unauthorizedApp = Fastify();

    unauthorizedApp.register(
      createVaultSyncRoutes({
        syncVaultFromToken: async () => {
          throw new VaultSyncUnauthorizedError("invalid token");
        },
      }),
      { prefix: "/vault" },
    );

    await unauthorizedApp.ready();

    const response = await unauthorizedApp.inject({
      method: "POST",
      url: "/vault/sync",
      headers: {
        authorization: "Bearer bad-token",
      },
      payload: { changed_items: [] },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      error: "invalid_token",
    });

    await unauthorizedApp.close();
  });

  it("returns sync payload for an authenticated user", async () => {
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/vault/sync",
      headers: {
        authorization: "Bearer jwt-token",
      },
      payload: { changed_items: [] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      server_time: "2026-03-15T00:00:00.000Z",
      updated_items: [
        {
          id: "item-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: {
            ciphertext: "abc",
          },
          favorite: true,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-14T00:00:00.000Z",
          updated_at: "2026-03-15T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });
  });
});
