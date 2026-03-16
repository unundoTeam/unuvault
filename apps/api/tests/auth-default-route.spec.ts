import Fastify from "fastify";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/supabase", () => ({
  createConfiguredAuthBootstrapService: () => ({
    bootstrapProfileFromToken: async () => ({
      profile: {
        id: "profile-1",
        account_id: "account-1",
        email: "user@example.com",
        locale: "zh-CN",
      },
    }),
  }),
}));

import { authRoutes } from "../src/routes/auth";

describe("authRoutes default wiring", () => {
  const app = Fastify();

  app.register(authRoutes, { prefix: "/auth" });

  afterAll(async () => {
    await app.close();
  });

  it("uses the configured bootstrap service for POST /auth/bootstrap", async () => {
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
        id: "profile-1",
        account_id: "account-1",
        email: "user@example.com",
        locale: "zh-CN",
      },
    });
  });
});
