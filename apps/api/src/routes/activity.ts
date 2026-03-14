import type { FastifyPluginAsync } from "fastify";

export const activityRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ ok: true, scope: "activity" }));
};
