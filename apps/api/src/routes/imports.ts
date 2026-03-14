import type { FastifyPluginAsync } from "fastify";

export const importRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ ok: true, scope: "imports" }));
};
