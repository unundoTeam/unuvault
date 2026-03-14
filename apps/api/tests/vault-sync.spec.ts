import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("POST /vault/sync", () => {
  afterAll(async () => {
    await app.close();
  });

  it("returns sync payload with updated_items and conflicts", async () => {
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/vault/sync",
      payload: { changed_items: [] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("updated_items");
    expect(response.json()).toHaveProperty("conflicts");
  });
});
