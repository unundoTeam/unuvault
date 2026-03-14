import type { FastifyPluginAsync } from "fastify";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ ok: true, scope: "auth" }));
};
