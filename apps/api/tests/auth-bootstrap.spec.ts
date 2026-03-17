import Fastify from "fastify";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  AuthBootstrapUnauthorizedError,
  createAuthBootstrapService,
} from "../src/services/auth-bootstrap-service";
import { createAuthRoutes } from "../src/routes/auth";

describe("POST /auth/bootstrap", () => {
  const app = Fastify();

  app.register(
    createAuthRoutes({
      bootstrapProfileFromToken: async (token) => ({
        profile: {
          id: `profile:${token}`,
          account_id: "account-1",
          email: "user@example.com",
          locale: "zh-CN",
        },
      }),
    }),
    { prefix: "/auth" },
  );

  afterAll(async () => {
    await app.close();
  });

  it("bootstraps a profile for a valid bearer token", async () => {
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/auth/bootstrap",
      headers: {
        authorization: "Bearer test-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      profile: {
        id: "profile:test-token",
        account_id: "account-1",
        email: "user@example.com",
        locale: "zh-CN",
      },
    });
  });

  it("rejects missing bearer auth", async () => {
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/auth/bootstrap",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "missing_bearer_token",
      ok: false,
    });
  });

  it("returns 401 when the service rejects the bearer token", async () => {
    const unauthorizedApp = Fastify();

    unauthorizedApp.register(
      createAuthRoutes({
        bootstrapProfileFromToken: async () => {
          throw new AuthBootstrapUnauthorizedError("invalid token");
        },
      }),
      { prefix: "/auth" },
    );

    await unauthorizedApp.ready();

    const response = await unauthorizedApp.inject({
      method: "POST",
      url: "/auth/bootstrap",
      headers: {
        authorization: "Bearer bad-token",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "invalid_token",
      ok: false,
    });

    await unauthorizedApp.close();
  });

  it("returns 500 when bootstrap fails unexpectedly", async () => {
    const brokenApp = Fastify();

    brokenApp.register(
      createAuthRoutes({
        bootstrapProfileFromToken: async () => {
          throw new Error("boom");
        },
      }),
      { prefix: "/auth" },
    );

    await brokenApp.ready();

    const response = await brokenApp.inject({
      method: "POST",
      url: "/auth/bootstrap",
      headers: {
        authorization: "Bearer bad-token",
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: "bootstrap_failed",
      ok: false,
    });

    await brokenApp.close();
  });
});

describe("createAuthBootstrapService", () => {
  it("upserts the authenticated user's profile with the default locale", async () => {
    const service = createAuthBootstrapService({
      getUserByToken: async () => ({
        id: "auth-user-1",
        account_id: "account-1",
        email: "user@example.com",
      }),
      upsertUserProfile: async (profile) => ({
        id: "profile-1",
        account_id: profile.account_id,
        email: profile.email,
        locale: profile.locale,
      }),
    });

    const result = await service.bootstrapProfileFromToken("jwt-token");

    expect(result).toEqual({
      profile: {
        id: "profile-1",
        account_id: "account-1",
        email: "user@example.com",
        locale: "zh-CN",
      },
    });
  });

  it("upserts the profile by account_id while preserving auth_user_id", async () => {
    const upsertUserProfile = vi.fn(async (profile) => ({
      id: "profile-1",
      account_id: profile.account_id,
      email: profile.email,
      locale: profile.locale,
    }));
    const service = createAuthBootstrapService({
      getUserByToken: async () => ({
        id: "auth-user-1",
        account_id: "account-1",
        email: "user@example.com",
      }),
      upsertUserProfile,
    });

    await service.bootstrapProfileFromToken("jwt-token");

    expect(upsertUserProfile).toHaveBeenCalledWith({
      auth_user_id: "auth-user-1",
      account_id: "account-1",
      email: "user@example.com",
      locale: "zh-CN",
    });
  });

  it("rejects tokens that do not resolve to an email-bearing user", async () => {
    const service = createAuthBootstrapService({
      getUserByToken: async () => null,
      upsertUserProfile: async () => {
        throw new Error("should not be reached");
      },
    });

    await expect(service.bootstrapProfileFromToken("jwt-token")).rejects.toBeInstanceOf(
      AuthBootstrapUnauthorizedError,
    );
  });

  it("rejects tokens that do not resolve to an account-bearing user", async () => {
    const upsertUserProfile = vi.fn();
    const service = createAuthBootstrapService({
      getUserByToken: async () => ({
        id: "auth-user-1",
        account_id: null as never,
        email: "user@example.com",
      }),
      upsertUserProfile: async (profile) => {
        upsertUserProfile(profile);
        throw new Error("should not be reached");
      },
    });

    await expect(service.bootstrapProfileFromToken("jwt-token")).rejects.toBeInstanceOf(
      AuthBootstrapUnauthorizedError,
    );
    expect(upsertUserProfile).not.toHaveBeenCalled();
  });
});
