import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("phase1 route groups", () => {
  afterAll(async () => {
    await app.close();
  });

  it("exposes the phase1 route groups", async () => {
    await app.ready();

    const healthResponse = await app.inject({
      method: "GET",
      url: "/health",
    });
    const routeGroupResponses = await Promise.all([
      app.inject({ method: "GET", url: "/auth" }),
      app.inject({ method: "GET", url: "/vault" }),
      app.inject({ method: "GET", url: "/devices" }),
      app.inject({ method: "GET", url: "/imports" }),
      app.inject({ method: "GET", url: "/activity" }),
    ]);

    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toEqual({ ok: true });
    expect(routeGroupResponses.map((response) => response.statusCode)).toEqual([
      200,
      200,
      200,
      200,
      200,
    ]);
  });
});
