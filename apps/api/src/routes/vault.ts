import type { FastifyPluginAsync } from "fastify";

export const vaultRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ ok: true, scope: "vault" }));
};
