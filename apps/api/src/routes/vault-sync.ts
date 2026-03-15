import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { createConfiguredVaultSyncService } from "../lib/supabase";
import {
  VaultSyncProfileNotFoundError,
  VaultSyncUnauthorizedError,
} from "../services/vault-service";

type VaultSyncResponse = {
  server_time: string;
  updated_items: unknown[];
  deleted_item_ids: string[];
  conflicts: unknown[];
};

type VaultSyncRouteDependencies = {
  syncVaultFromToken(token: string): Promise<VaultSyncResponse>;
};

export function createVaultSyncRoutes(
  deps: VaultSyncRouteDependencies,
): FastifyPluginAsync {
  return async (app) => {
    app.post("/sync", async (request, reply) => {
      const authorization = request.headers.authorization;

      if (!authorization?.startsWith("Bearer ")) {
        reply.code(401);
        return {
          ok: false,
          error: "missing_bearer_token",
        };
      }

      const token = authorization.slice("Bearer ".length);

      try {
        return await deps.syncVaultFromToken(token);
      } catch (error) {
        if (error instanceof VaultSyncUnauthorizedError) {
          reply.code(401);
          return {
            ok: false,
            error: "invalid_token",
          };
        }

        if (error instanceof VaultSyncProfileNotFoundError) {
          reply.code(404);
          return {
            ok: false,
            error: "profile_not_found",
          };
        }

        reply.code(500);
        return {
          ok: false,
          error: "sync_failed",
        };
      }
    });
  };
}

export function registerVaultSyncRoute(app: FastifyInstance) {
  app.register(
    createVaultSyncRoutes(createConfiguredVaultSyncService()),
  );
}
