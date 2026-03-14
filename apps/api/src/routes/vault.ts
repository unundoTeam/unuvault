import type { FastifyPluginAsync } from "fastify";
import { registerVaultSyncRoute } from "./vault-sync";

export const vaultRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ ok: true, scope: "vault" }));
  registerVaultSyncRoute(app);
};
