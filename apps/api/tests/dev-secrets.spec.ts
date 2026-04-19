import Fastify from "fastify";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createDevSecretSessionStore } from "../src/lib/dev-secret-session-store";
import { createDevSecretsRoutes } from "../src/routes/dev-secrets";
import {
  DevSecretRecordNotFoundError,
  DevSecretValidationError,
  DevSecretsUnauthorizedError,
  createDevSecretsService,
} from "../src/services/dev-secrets-service";

describe("/dev/secrets", () => {
  const createBrowserHandoff = vi.fn();
  const exchangeBrowserHandoff = vi.fn();
  const getPrivateRecord = vi.fn();
  const putPrivateRecord = vi.fn();
  const app = Fastify();

  app.register(
    createDevSecretsRoutes({
      createBrowserHandoff,
      exchangeBrowserHandoff,
      getPrivateRecord,
      putPrivateRecord,
    }),
    { prefix: "/dev/secrets" },
  );

  afterEach(() => {
    createBrowserHandoff.mockReset();
    exchangeBrowserHandoff.mockReset();
    getPrivateRecord.mockReset();
    putPrivateRecord.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 404 when the private dotenv record does not exist", async () => {
    getPrivateRecord.mockRejectedValueOnce(
      new DevSecretRecordNotFoundError("missing record"),
    );

    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/dev/secrets/records/unundo/local/dotenv",
      headers: {
        authorization: "Bearer cli-session-token",
      },
    });

    expect(getPrivateRecord).toHaveBeenCalledWith("cli-session-token", {
      app_code: "unundo",
      target_env: "local",
      secret_kind: "dotenv",
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      ok: false,
      error: "secret_not_found",
    });
  });

  it("returns invalid_token when browser auth cannot mint a handoff", async () => {
    createBrowserHandoff.mockRejectedValueOnce(
      new DevSecretsUnauthorizedError("invalid token"),
    );

    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/dev/secrets/handoffs",
      headers: {
        authorization: "Bearer browser-jwt",
      },
      payload: {
        app: "unundo",
        env: "local",
      },
    });

    expect(createBrowserHandoff).toHaveBeenCalledWith("browser-jwt", {
      app_code: "unundo",
      target_env: "local",
      secret_kind: "dotenv",
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      ok: false,
      error: "invalid_token",
    });
  });

  it("creates a one-time handoff and exchanges it for a short-lived cli session", async () => {
    createBrowserHandoff.mockResolvedValueOnce({
      handoff_code: "handoff-code-1",
    });
    exchangeBrowserHandoff.mockResolvedValueOnce({
      cli_session_token: "cli-session-token",
    });

    await app.ready();

    const handoffResponse = await app.inject({
      method: "POST",
      url: "/dev/secrets/handoffs",
      headers: {
        authorization: "Bearer browser-jwt",
      },
      payload: {
        app: "unundo",
        env: "local",
      },
    });

    expect(handoffResponse.statusCode).toBe(200);
    expect(handoffResponse.json()).toEqual({
      handoff_code: "handoff-code-1",
    });

    const exchangeResponse = await app.inject({
      method: "POST",
      url: "/dev/secrets/handoffs/exchange",
      payload: {
        handoff_code: "handoff-code-1",
      },
    });

    expect(exchangeBrowserHandoff).toHaveBeenCalledWith("handoff-code-1");
    expect(exchangeResponse.statusCode).toBe(200);
    expect(exchangeResponse.json()).toEqual({
      cli_session_token: "cli-session-token",
    });
  });
});

describe("createDevSecretsService", () => {
  it("accepts unuidentity/production/dotenv as a supported target", async () => {
    const service = createDevSecretsService({
      sessionStore: createDevSecretSessionStore(),
      getBrowserAccountIdFromToken: async () => "account-1",
      getStoredRecord: async () => ({
        ciphertext: "ciphertext",
      }),
      putStoredRecord: async () => undefined,
    });

    const result = await service.createBrowserHandoff("browser-jwt", {
      app_code: "unuidentity",
      target_env: "production",
      secret_kind: "dotenv",
    });

    expect(result.handoff_code).toBeTruthy();
  });

  it("still rejects unsupported app/env combinations", async () => {
    const service = createDevSecretsService({
      sessionStore: createDevSecretSessionStore(),
      getBrowserAccountIdFromToken: async () => "account-1",
      getStoredRecord: async () => ({
        ciphertext: "ciphertext",
      }),
      putStoredRecord: async () => undefined,
    });

    await expect(
      service.createBrowserHandoff("browser-jwt", {
        app_code: "unuidentity",
        target_env: "qa",
        secret_kind: "dotenv",
      }),
    ).rejects.toThrowError(new DevSecretValidationError("unsupported_target"));
  });
});
