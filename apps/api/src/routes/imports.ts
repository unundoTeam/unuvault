import type { FastifyPluginAsync } from "fastify";
import { createBrowserImportJob } from "../services/import-service";

export const importRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ ok: true, scope: "imports" }));
  app.post("/browser", async (_request, reply) => {
    return reply.status(202).send(createBrowserImportJob());
  });
};
