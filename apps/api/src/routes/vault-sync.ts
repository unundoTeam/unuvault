import type { FastifyInstance } from "fastify";
import { buildVaultSyncPayload } from "../services/vault-service";

export function registerVaultSyncRoute(app: FastifyInstance) {
  app.post("/sync", async (_request, reply) => {
    return reply.send(buildVaultSyncPayload());
  });
}
