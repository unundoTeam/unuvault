import { describe, expect, it, vi } from "vitest";
import { startApiServer } from "../src/server-runtime";

describe("startApiServer", () => {
  it("starts the Fastify app on localhost:3000 by default", async () => {
    const listen = vi.fn().mockResolvedValue("http://127.0.0.1:3000");
    const logger = {
      info: vi.fn(),
    };

    await startApiServer({ listen }, {}, logger);

    expect(listen).toHaveBeenCalledWith({
      host: "127.0.0.1",
      port: 3000,
    });
    expect(logger.info).toHaveBeenCalledWith(
      "API listening at http://127.0.0.1:3000",
    );
  });
});
