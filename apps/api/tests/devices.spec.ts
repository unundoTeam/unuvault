import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("GET /devices", () => {
  afterAll(async () => {
    await app.close();
  });

  it("lists devices for the current user", async () => {
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/devices",
    });

    expect(response.statusCode).toBe(200);
  });
});
