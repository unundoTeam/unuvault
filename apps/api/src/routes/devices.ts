import type { FastifyPluginAsync } from "fastify";

export const deviceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ ok: true, scope: "devices" }));
};
