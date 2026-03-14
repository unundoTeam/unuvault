import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("GET /activity/recent", () => {
  afterAll(async () => {
    await app.close();
  });

  it("lists recent activity for the current user", async () => {
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/activity/recent",
    });

    expect(response.statusCode).toBe(200);
  });
});
