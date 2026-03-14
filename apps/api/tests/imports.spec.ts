import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("POST /imports/browser", () => {
  afterAll(async () => {
    await app.close();
  });

  it("creates a browser import job", async () => {
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/imports/browser",
      payload: { source: "chrome", payload: [] },
    });

    expect(response.statusCode).toBe(202);
  });
});
