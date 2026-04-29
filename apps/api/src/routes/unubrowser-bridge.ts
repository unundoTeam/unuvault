import type { FastifyPluginAsync } from "fastify";
import {
  createConfiguredUnubrowserBridgeService,
  UnubrowserBridgeCredentialNotFoundError,
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
