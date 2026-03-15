import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type {
  VaultSyncRequest,
  VaultSyncResponse,
} from "../../../../packages/api-client/src/vault";
import { createConfiguredVaultSyncService } from "../lib/supabase";
import {
  VaultSyncItemConflictError,
  VaultSyncProfileNotFoundError,
  VaultSyncUnauthorizedError,
} from "../services/vault-service";

type VaultSyncRouteDependencies = {
  syncVaultFromToken(
    token: string,
    payload: VaultSyncRequest,
  ): Promise<VaultSyncResponse>;
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
      const body = (request.body ?? {}) as Partial<VaultSyncRequest>;
      const payload: VaultSyncRequest = {
        changed_items: body.changed_items ?? [],
        deleted_item_ids: body.deleted_item_ids ?? [],
      };

      try {
        return await deps.syncVaultFromToken(token, payload);
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

        if (error instanceof VaultSyncItemConflictError) {
          reply.code(409);
          return {
            ok: false,
            error: "item_id_conflict",
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
