import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("local auth runtime CORS", () => {
  afterAll(async () => {
    await app.close();
  });

  it("answers the local web preflight for auth bootstrap", async () => {
    await app.ready();

    const response = await app.inject({
      method: "OPTIONS",
      url: "/auth/bootstrap",
      headers: {
        origin: "http://127.0.0.1:3001",
        "access-control-request-method": "POST",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://127.0.0.1:3001",
    );
  });
});
