import type { FastifyPluginAsync } from "fastify";
import { createConfiguredUnubrowserBridgeService } from "../lib/supabase";
import {
  UnubrowserBridgeCredentialNotFoundError,
  UnubrowserBridgeUnauthorizedError,
  UnubrowserBridgeValidationError,
} from "../services/unubrowser-bridge-service";

type UnubrowserBridgeRouteDependencies = {
  accessToken?: string;
  service: {
    findCredentialMetadata(request: {
      origin: string;
      profileId: string;
    }): Promise<Array<{ id: string; label: string; username: string }>>;
    releaseSecret(request: {
      id: string;
      origin: string;
      profileId: string;
      reason: string;
    }): Promise<{ password: string; username: string }>;
    publishUnlockedCredentialSession?(
      token: string,
      request: {
        credentials: Array<{
          id: string;
          label: string;
          password: string;
          profileId?: string;
          username: string;
          websiteOrigin: string;
        }>;
      },
    ): Promise<{ ok: true; credential_count: number }>;
    clearUnlockedCredentialSession?(token: string): Promise<{ ok: true }>;
  };
};

function readBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length);
}

function authorizeBridgeRequest(
  expectedAccessToken: string | undefined,
  authorizationHeader: string | undefined,
):
  | { ok: true }
  | { ok: false; statusCode: 401 | 503; error: string } {
  if (!expectedAccessToken) {
    return {
      ok: false,
      statusCode: 503,
      error: "bridge_not_configured",
    };
  }

  if (readBearerToken(authorizationHeader) !== expectedAccessToken) {
    return {
      ok: false,
      statusCode: 401,
      error: "invalid_bridge_token",
    };
  }

  return { ok: true };
}

function isLoopbackAddress(address: string | undefined): boolean {
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

function rejectNonLocalBridgeRequest(
  remoteAddress: string | undefined,
): { ok: true } | { ok: false; statusCode: 403; error: "local_bridge_only" } {
  if (isLoopbackAddress(remoteAddress)) {
    return { ok: true };
  }

  return {
    ok: false,
    statusCode: 403,
    error: "local_bridge_only",
  };
}

export function createUnubrowserBridgeRoutes(
  deps: UnubrowserBridgeRouteDependencies,
): FastifyPluginAsync {
  return async (app) => {
    app.put("/credentials/unlocked-session", async (request, reply) => {
      const localRequest = rejectNonLocalBridgeRequest(request.ip);

      if (!localRequest.ok) {
        reply.code(localRequest.statusCode);
        return {
          ok: false,
          error: localRequest.error,
        };
      }

      const token = readBearerToken(request.headers.authorization);

      if (!token || !deps.service.publishUnlockedCredentialSession) {
        reply.code(401);
        return {
          ok: false,
          error: "invalid_token",
        };
      }

      const body = (request.body ?? {}) as {
        credentials?: Array<{
          id?: string;
          label?: string;
          password?: string;
          profileId?: string;
          username?: string;
          websiteOrigin?: string;
        }>;
      };

      try {
        return await deps.service.publishUnlockedCredentialSession(token, {
          credentials: (body.credentials ?? []).map((credential) => ({
            id: credential.id ?? "",
            label: credential.label ?? "",
            password: credential.password ?? "",
            profileId: credential.profileId,
            username: credential.username ?? "",
            websiteOrigin: credential.websiteOrigin ?? "",
          })),
        });
      } catch (error) {
        if (error instanceof UnubrowserBridgeUnauthorizedError) {
          reply.code(401);
          return {
            ok: false,
            error: "invalid_token",
          };
        }

        if (error instanceof UnubrowserBridgeValidationError) {
          reply.code(400);
          return {
            ok: false,
            error: "invalid_bridge_request",
          };
        }

        reply.code(500);
        return {
          ok: false,
          error: "unlocked_session_publish_failed",
        };
      }
    });

    app.delete("/credentials/unlocked-session", async (request, reply) => {
      const localRequest = rejectNonLocalBridgeRequest(request.ip);

      if (!localRequest.ok) {
        reply.code(localRequest.statusCode);
        return {
          ok: false,
          error: localRequest.error,
        };
      }

      const token = readBearerToken(request.headers.authorization);

      if (!token || !deps.service.clearUnlockedCredentialSession) {
        reply.code(401);
        return {
          ok: false,
          error: "invalid_token",
        };
      }

      try {
        return await deps.service.clearUnlockedCredentialSession(token);
      } catch (error) {
        if (error instanceof UnubrowserBridgeUnauthorizedError) {
          reply.code(401);
          return {
            ok: false,
            error: "invalid_token",
          };
        }

        reply.code(500);
        return {
          ok: false,
          error: "unlocked_session_clear_failed",
        };
      }
    });

    app.get("/credentials", async (request, reply) => {
      const localRequest = rejectNonLocalBridgeRequest(request.ip);

      if (!localRequest.ok) {
        reply.code(localRequest.statusCode);
        return {
          ok: false,
          error: localRequest.error,
        };
      }

      const authorization = authorizeBridgeRequest(
        deps.accessToken,
        request.headers.authorization,
      );

      if (!authorization.ok) {
        reply.code(authorization.statusCode);
        return {
          ok: false,
          error: authorization.error,
        };
      }

      const query = (request.query ?? {}) as {
        origin?: string;
        profileId?: string;
      };

      try {
        const credentials = await deps.service.findCredentialMetadata({
          origin: query.origin ?? "",
          profileId: query.profileId ?? "",
        });

        return { credentials };
      } catch (error) {
        if (error instanceof UnubrowserBridgeValidationError) {
          reply.code(400);
          return {
            ok: false,
            error: "invalid_bridge_request",
          };
        }

        reply.code(500);
        return {
          ok: false,
          error: "credential_metadata_failed",
        };
      }
    });

    app.post("/credentials/release", async (request, reply) => {
      const localRequest = rejectNonLocalBridgeRequest(request.ip);

      if (!localRequest.ok) {
        reply.code(localRequest.statusCode);
        return {
          ok: false,
          error: localRequest.error,
        };
      }

      const authorization = authorizeBridgeRequest(
        deps.accessToken,
        request.headers.authorization,
      );

      if (!authorization.ok) {
        reply.code(authorization.statusCode);
        return {
          ok: false,
          error: authorization.error,
        };
      }

      const body = (request.body ?? {}) as {
        id?: string;
        origin?: string;
        profileId?: string;
        reason?: string;
      };

      try {
        const credential = await deps.service.releaseSecret({
          id: body.id ?? "",
          origin: body.origin ?? "",
          profileId: body.profileId ?? "",
          reason: body.reason ?? "",
        });

        return { credential };
      } catch (error) {
        if (error instanceof UnubrowserBridgeValidationError) {
          reply.code(400);
          return {
            ok: false,
            error: "invalid_bridge_request",
          };
        }

        if (error instanceof UnubrowserBridgeCredentialNotFoundError) {
          reply.code(404);
          return {
            ok: false,
            error: "credential_not_found",
          };
        }

        reply.code(500);
        return {
          ok: false,
          error: "credential_release_failed",
        };
      }
    });
  };
}

export const unubrowserBridgeRoutes = createUnubrowserBridgeRoutes({
  accessToken: process.env.UNUVAULT_BRIDGE_TOKEN,
  service: createConfiguredUnubrowserBridgeService(),
});
