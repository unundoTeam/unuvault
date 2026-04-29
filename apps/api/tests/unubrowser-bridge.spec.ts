import Fastify from "fastify";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUnubrowserBridgeRoutes } from "../src/routes/unubrowser-bridge";
import {
  createInMemoryUnubrowserBridgeCredentialStore,
  createUnubrowserBridgeService,
  UnubrowserBridgeCredentialNotFoundError,
  UnubrowserBridgeValidationError,
} from "../src/services/unubrowser-bridge-service";

describe("/v1 unubrowser bridge", () => {
  const findCredentialMetadata = vi.fn();
  const releaseSecret = vi.fn();
  const app = Fastify();

  app.register(
    createUnubrowserBridgeRoutes({
      accessToken: "bridge-token",
      service: {
        findCredentialMetadata,
        releaseSecret,
      },
    }),
    { prefix: "/v1" },
  );

  afterEach(() => {
    findCredentialMetadata.mockReset();
    releaseSecret.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects bridge requests without the local bearer token", async () => {
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/credentials?origin=https%3A%2F%2Fconsole.example.com&profileId=workspace-client-a",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      error: "invalid_bridge_token",
    });
    expect(findCredentialMetadata).not.toHaveBeenCalled();
  });

  it("rejects bridge requests from non-loopback addresses", async () => {
    await app.ready();

    const response = await app.inject({
      method: "GET",
      remoteAddress: "203.0.113.10",
      url: "/v1/credentials?origin=https%3A%2F%2Fconsole.example.com&profileId=workspace-client-a",
      headers: {
        authorization: "Bearer bridge-token",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      ok: false,
      error: "local_bridge_only",
    });
    expect(findCredentialMetadata).not.toHaveBeenCalled();
  });

  it("returns credential metadata without secret material", async () => {
    findCredentialMetadata.mockResolvedValueOnce([
      {
        id: "vault-workspace-client-a",
        label: "Developer console client A",
        username: "client-a@example.com",
      },
    ]);

    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/credentials?origin=https%3A%2F%2Fconsole.example.com&profileId=workspace-client-a",
      headers: {
        authorization: "Bearer bridge-token",
      },
    });

    expect(findCredentialMetadata).toHaveBeenCalledWith({
      origin: "https://console.example.com",
      profileId: "workspace-client-a",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      credentials: [
        {
          id: "vault-workspace-client-a",
          label: "Developer console client A",
          username: "client-a@example.com",
        },
      ],
    });
    expect(response.body).not.toContain("password");
  });

  it("releases one credential only through the explicit fill action", async () => {
    releaseSecret.mockResolvedValueOnce({
      username: "client-a@example.com",
      password: "client-a-password",
    });

    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/v1/credentials/release",
      headers: {
        authorization: "Bearer bridge-token",
      },
      payload: {
        id: "vault-workspace-client-a",
        origin: "https://console.example.com",
        profileId: "workspace-client-a",
        reason: "fill-active-page",
      },
    });

    expect(releaseSecret).toHaveBeenCalledWith({
      id: "vault-workspace-client-a",
      origin: "https://console.example.com",
      profileId: "workspace-client-a",
      reason: "fill-active-page",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      credential: {
        username: "client-a@example.com",
        password: "client-a-password",
      },
    });
  });

  it("maps bridge service misses and validation failures to safe errors", async () => {
    releaseSecret.mockRejectedValueOnce(
      new UnubrowserBridgeCredentialNotFoundError("credential not found"),
    );
    findCredentialMetadata.mockRejectedValueOnce(
      new UnubrowserBridgeValidationError("invalid origin"),
    );

    await app.ready();

    const releaseResponse = await app.inject({
      method: "POST",
      url: "/v1/credentials/release",
      headers: {
        authorization: "Bearer bridge-token",
      },
      payload: {
        id: "vault-missing",
        origin: "https://console.example.com",
        profileId: "workspace-client-a",
        reason: "fill-active-page",
      },
    });
    const metadataResponse = await app.inject({
      method: "GET",
      url: "/v1/credentials?origin=file%3A%2F%2Ftmp%2Flogin.html&profileId=workspace-client-a",
      headers: {
        authorization: "Bearer bridge-token",
      },
    });

    expect(releaseResponse.statusCode).toBe(404);
    expect(releaseResponse.json()).toEqual({
      ok: false,
      error: "credential_not_found",
    });
    expect(metadataResponse.statusCode).toBe(400);
    expect(metadataResponse.json()).toEqual({
      ok: false,
      error: "invalid_bridge_request",
    });
  });

  it("publishes a browser-unlocked session and serves it to the local bridge", async () => {
    const store = createInMemoryUnubrowserBridgeCredentialStore({
      now: () => new Date("2026-04-29T12:00:00.000Z").getTime(),
      ttlMs: 300_000,
    });
    const recordBridgeAuditEvent = vi.fn().mockResolvedValue(undefined);
    const service = createUnubrowserBridgeService({
      readUnlockedCredentials: store.readUnlockedCredentials,
      replaceUnlockedCredentials: store.replaceUnlockedCredentials,
      clearUnlockedCredentials: store.clearUnlockedCredentials,
      getBrowserAccountIdFromToken: async (token) =>
        token === "browser-jwt" ? "account-1" : null,
      recordBridgeAuditEvent,
    });
    const sessionApp = Fastify();

    sessionApp.register(
      createUnubrowserBridgeRoutes({
        accessToken: "bridge-token",
        service,
      }),
      { prefix: "/v1" },
    );
    await sessionApp.ready();

    try {
      const publishResponse = await sessionApp.inject({
        method: "PUT",
        url: "/v1/credentials/unlocked-session",
        headers: {
          authorization: "Bearer browser-jwt",
        },
        payload: {
          credentials: [
            {
              id: "550e8400-e29b-41d4-a716-446655440000",
              label: "Developer console client A",
              password: "client-a-password",
              username: "client-a@example.com",
              websiteOrigin: "https://console.example.com",
            },
          ],
        },
      });
      const metadataResponse = await sessionApp.inject({
        method: "GET",
        url: "/v1/credentials?origin=https%3A%2F%2Fconsole.example.com%2Flogin&profileId=workspace-client-a",
        headers: {
          authorization: "Bearer bridge-token",
        },
      });
      const releaseResponse = await sessionApp.inject({
        method: "POST",
        url: "/v1/credentials/release",
        headers: {
          authorization: "Bearer bridge-token",
        },
        payload: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          origin: "https://console.example.com/login",
          profileId: "workspace-client-a",
          reason: "fill-active-page",
        },
      });
      const clearResponse = await sessionApp.inject({
        method: "DELETE",
        url: "/v1/credentials/unlocked-session",
        headers: {
          authorization: "Bearer browser-jwt",
        },
      });
      const clearedMetadataResponse = await sessionApp.inject({
        method: "GET",
        url: "/v1/credentials?origin=https%3A%2F%2Fconsole.example.com&profileId=workspace-client-a",
        headers: {
          authorization: "Bearer bridge-token",
        },
      });

      expect(publishResponse.statusCode).toBe(200);
      expect(publishResponse.json()).toEqual({
        ok: true,
        credential_count: 1,
      });
      expect(metadataResponse.statusCode).toBe(200);
      expect(metadataResponse.json()).toEqual({
        credentials: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            label: "Developer console client A",
            username: "client-a@example.com",
          },
        ],
      });
      expect(metadataResponse.body).not.toContain("client-a-password");
      expect(releaseResponse.statusCode).toBe(200);
      expect(releaseResponse.json()).toEqual({
        credential: {
          username: "client-a@example.com",
          password: "client-a-password",
        },
      });
      expect(recordBridgeAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "550e8400-e29b-41d4-a716-446655440000",
          origin: "https://console.example.com",
          profileId: "workspace-client-a",
          type: "credential_release",
        }),
      );
      expect(clearResponse.statusCode).toBe(200);
      expect(clearResponse.json()).toEqual({ ok: true });
      expect(clearedMetadataResponse.json()).toEqual({ credentials: [] });
    } finally {
      await sessionApp.close();
    }
  });

  it("rejects unlocked session publish without a valid browser token", async () => {
    const store = createInMemoryUnubrowserBridgeCredentialStore();
    const service = createUnubrowserBridgeService({
      readUnlockedCredentials: store.readUnlockedCredentials,
      replaceUnlockedCredentials: store.replaceUnlockedCredentials,
      clearUnlockedCredentials: store.clearUnlockedCredentials,
      getBrowserAccountIdFromToken: async () => null,
      recordBridgeAuditEvent: async () => undefined,
    });
    const sessionApp = Fastify();

    sessionApp.register(
      createUnubrowserBridgeRoutes({
        accessToken: "bridge-token",
        service,
      }),
      { prefix: "/v1" },
    );
    await sessionApp.ready();

    try {
      const response = await sessionApp.inject({
        method: "PUT",
        url: "/v1/credentials/unlocked-session",
        headers: {
          authorization: "Bearer invalid-browser-jwt",
        },
        payload: {
          credentials: [],
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        ok: false,
        error: "invalid_token",
      });
    } finally {
      await sessionApp.close();
    }
  });

  it("expires unlocked bridge session credentials after the configured ttl", async () => {
    let now = new Date("2026-04-29T12:00:00.000Z").getTime();
    const store = createInMemoryUnubrowserBridgeCredentialStore({
      now: () => now,
      ttlMs: 1_000,
    });

    await store.replaceUnlockedCredentials([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        label: "Developer console client A",
        password: "client-a-password",
        username: "client-a@example.com",
        websiteOrigin: "https://console.example.com",
      },
    ]);

    await expect(store.readUnlockedCredentials()).resolves.toHaveLength(1);

    now += 1_001;

    await expect(store.readUnlockedCredentials()).resolves.toEqual([]);
  });
});

describe("createUnubrowserBridgeService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns exact-origin metadata for the requested browser profile", async () => {
    const service = createUnubrowserBridgeService({
      readUnlockedCredentials: async () => [
        {
          id: "vault-workspace-client-a",
          label: "Developer console client A",
          password: "client-a-password",
          profileId: "workspace-client-a",
          username: "client-a@example.com",
          websiteOrigin: "https://console.example.com",
        },
        {
          id: "vault-workspace-client-b",
          label: "Developer console client B",
          password: "client-b-password",
          profileId: "workspace-client-b",
          username: "client-b@example.com",
          websiteOrigin: "https://console.example.com",
        },
      ],
      recordBridgeAuditEvent: async () => undefined,
    });

    const metadata = await service.findCredentialMetadata({
      origin: "https://console.example.com/login",
      profileId: "workspace-client-a",
    });

    expect(metadata).toEqual([
      {
        id: "vault-workspace-client-a",
        label: "Developer console client A",
        username: "client-a@example.com",
      },
    ]);
    expect(JSON.stringify(metadata)).not.toContain("password");
  });

  it("releases a matching credential and records a non-secret audit event", async () => {
    const recordBridgeAuditEvent = vi.fn().mockResolvedValue(undefined);
    const service = createUnubrowserBridgeService({
      readUnlockedCredentials: async () => [
        {
          id: "vault-workspace-client-a",
          label: "Developer console client A",
          password: "client-a-password",
          profileId: "workspace-client-a",
          username: "client-a@example.com",
          websiteOrigin: "https://console.example.com",
        },
      ],
      recordBridgeAuditEvent,
    });

    await expect(
      service.releaseSecret({
        id: "vault-workspace-client-a",
        origin: "https://console.example.com/login",
        profileId: "workspace-client-a",
        reason: "fill-active-page",
      }),
    ).resolves.toEqual({
      username: "client-a@example.com",
      password: "client-a-password",
    });
    expect(recordBridgeAuditEvent).toHaveBeenCalledWith({
      id: "vault-workspace-client-a",
      origin: "https://console.example.com",
      profileId: "workspace-client-a",
      reason: "fill-active-page",
      releasedAt: "2026-04-29T12:00:00.000Z",
      type: "credential_release",
    });
    expect(JSON.stringify(recordBridgeAuditEvent.mock.calls)).not.toContain(
      "client-a-password",
    );
  });

  it("rejects unsupported origins, profile ids, ids, and release reasons", async () => {
    const service = createUnubrowserBridgeService({
      readUnlockedCredentials: async () => [],
      recordBridgeAuditEvent: async () => undefined,
    });

    await expect(
      service.findCredentialMetadata({
        origin: "file:///tmp/login.html",
        profileId: "workspace-client-a",
      }),
    ).rejects.toBeInstanceOf(UnubrowserBridgeValidationError);
    await expect(
      service.findCredentialMetadata({
        origin: "https://console.example.com",
        profileId: "../client-a",
      }),
    ).rejects.toBeInstanceOf(UnubrowserBridgeValidationError);
    await expect(
      service.releaseSecret({
        id: "../item-1",
        origin: "https://console.example.com",
        profileId: "workspace-client-a",
        reason: "fill-active-page",
      }),
    ).rejects.toBeInstanceOf(UnubrowserBridgeValidationError);
    await expect(
      service.releaseSecret({
        id: "vault-workspace-client-a",
        origin: "https://console.example.com",
        profileId: "workspace-client-a",
        reason: "copy-password",
      }),
    ).rejects.toBeInstanceOf(UnubrowserBridgeValidationError);
  });
});
