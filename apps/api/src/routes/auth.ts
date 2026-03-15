import type { FastifyPluginAsync } from "fastify";
import { createConfiguredAuthBootstrapService } from "../lib/supabase";
import { AuthBootstrapUnauthorizedError } from "../services/auth-bootstrap-service";

type BootstrapProfileResult = {
  profile: {
    id: string;
    email: string;
    locale: string;
  };
};

type AuthRouteDependencies = {
  bootstrapProfileFromToken(token: string): Promise<BootstrapProfileResult>;
};

export function createAuthRoutes(
  deps: AuthRouteDependencies,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/", async () => ({ ok: true, scope: "auth" }));

    app.post("/bootstrap", async (request, reply) => {
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
        return await deps.bootstrapProfileFromToken(token);
      } catch (error) {
        if (error instanceof AuthBootstrapUnauthorizedError) {
          reply.code(401);
          return {
            ok: false,
            error: "invalid_token",
          };
        }

        reply.code(500);
        return {
          ok: false,
          error: "bootstrap_failed",
        };
      }
    });
  };
}

export const authRoutes = createAuthRoutes(
  createConfiguredAuthBootstrapService(),
);
