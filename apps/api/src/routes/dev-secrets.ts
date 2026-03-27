import type { FastifyPluginAsync } from "fastify";
import { createConfiguredDevSecretsService } from "../lib/supabase";
import type { DevSecretTarget } from "../lib/dev-secret-session-store";
import {
  DevSecretInvalidHandoffError,
  DevSecretRecordNotFoundError,
  DevSecretsUnauthorizedError,
  DevSecretValidationError,
} from "../services/dev-secrets-service";

type DevSecretsRouteDependencies = {
  createBrowserHandoff(
    token: string,
    target: DevSecretTarget,
  ): Promise<{ handoff_code: string }>;
  exchangeBrowserHandoff(
    handoffCode: string,
  ): Promise<{ cli_session_token: string }>;
  getPrivateRecord(
    cliSessionToken: string,
    target: DevSecretTarget,
  ): Promise<{ ciphertext: string }>;
  putPrivateRecord(
    cliSessionToken: string,
    target: DevSecretTarget,
    ciphertext: string,
  ): Promise<{ ok: true }>;
};

function buildTarget(appCode: string, targetEnv: string): DevSecretTarget {
  return {
    app_code: appCode,
    target_env: targetEnv,
    secret_kind: "dotenv",
  };
}

function readBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length);
}

export function createDevSecretsRoutes(
  deps: DevSecretsRouteDependencies,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/", async () => ({ ok: true, scope: "dev-secrets" }));

    app.post("/handoffs", async (request, reply) => {
      const token = readBearerToken(request.headers.authorization);

      if (!token) {
        reply.code(401);
        return {
          ok: false,
          error: "missing_bearer_token",
        };
      }

      const body = (request.body ?? {}) as {
        app?: string;
        env?: string;
      };

      try {
        return await deps.createBrowserHandoff(
          token,
          buildTarget(body.app ?? "", body.env ?? ""),
        );
      } catch (error) {
        if (error instanceof DevSecretsUnauthorizedError) {
          reply.code(401);
          return {
            ok: false,
            error: "invalid_token",
          };
        }

        if (error instanceof DevSecretValidationError) {
          reply.code(400);
          return {
            ok: false,
            error: "invalid_request",
          };
        }

        reply.code(500);
        return {
          ok: false,
          error: "handoff_create_failed",
        };
      }
    });

    app.post("/handoffs/exchange", async (request, reply) => {
      const body = (request.body ?? {}) as {
        handoff_code?: string;
      };

      try {
        return await deps.exchangeBrowserHandoff(body.handoff_code ?? "");
      } catch (error) {
        if (error instanceof DevSecretInvalidHandoffError) {
          reply.code(401);
          return {
            ok: false,
            error: "invalid_handoff_code",
          };
        }

        reply.code(500);
        return {
          ok: false,
          error: "handoff_exchange_failed",
        };
      }
    });

    app.get("/records/:app/:env/dotenv", async (request, reply) => {
      const token = readBearerToken(request.headers.authorization);

      if (!token) {
        reply.code(401);
        return {
          ok: false,
          error: "missing_bearer_token",
        };
      }

      const params = request.params as {
        app: string;
        env: string;
      };

      try {
        return await deps.getPrivateRecord(
          token,
          buildTarget(params.app, params.env),
        );
      } catch (error) {
        if (error instanceof DevSecretsUnauthorizedError) {
          reply.code(401);
          return {
            ok: false,
            error: "invalid_token",
          };
        }

        if (error instanceof DevSecretRecordNotFoundError) {
          reply.code(404);
          return {
            ok: false,
            error: "secret_not_found",
          };
        }

        if (error instanceof DevSecretValidationError) {
          reply.code(400);
          return {
            ok: false,
            error: "invalid_request",
          };
        }

        reply.code(500);
        return {
          ok: false,
          error: "secret_read_failed",
        };
      }
    });

    app.put("/records/:app/:env/dotenv", async (request, reply) => {
      const token = readBearerToken(request.headers.authorization);

      if (!token) {
        reply.code(401);
        return {
          ok: false,
          error: "missing_bearer_token",
        };
      }

      const params = request.params as {
        app: string;
        env: string;
      };
      const body = (request.body ?? {}) as {
        ciphertext?: string;
      };

      try {
        return await deps.putPrivateRecord(
          token,
          buildTarget(params.app, params.env),
          body.ciphertext ?? "",
        );
      } catch (error) {
        if (error instanceof DevSecretsUnauthorizedError) {
          reply.code(401);
          return {
            ok: false,
            error: "invalid_token",
          };
        }

        if (error instanceof DevSecretValidationError) {
          reply.code(400);
          return {
            ok: false,
            error: "invalid_request",
          };
        }

        reply.code(500);
        return {
          ok: false,
          error: "secret_write_failed",
        };
      }
    });
  };
}

export const devSecretsRoutes = createDevSecretsRoutes(
  createConfiguredDevSecretsService(),
);
