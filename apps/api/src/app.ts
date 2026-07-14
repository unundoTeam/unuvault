import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  createHttpObservabilityEvent,
  NOOP_OBSERVABILITY_SINK,
  type ObservabilitySink,
} from "./lib/observability";
import { activityRoutes } from "./routes/activity";
import { authRoutes } from "./routes/auth";
import { devSecretsRoutes } from "./routes/dev-secrets";
import { deviceRoutes } from "./routes/devices";
import { importRoutes } from "./routes/imports";
import { localCredentialBridgeRoutes } from "./routes/local-credential-bridge";
import { vaultRoutes } from "./routes/vault";

export type BuildAppOptions = {
  observabilitySink?: ObservabilitySink;
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify();
  const observabilitySink =
    options.observabilitySink ?? NOOP_OBSERVABILITY_SINK;
  const requestStartedAt = new WeakMap<object, number>();

  function emitRequestEvent(
    request: {
      id: unknown;
      method: unknown;
      routeOptions: { url?: unknown };
    },
    statusCode: number,
  ) {
    const startedAt = requestStartedAt.get(request) ?? Date.now();
    const event = createHttpObservabilityEvent({
      routeTemplate: request.routeOptions.url,
      method: request.method,
      statusCode,
      latencyMilliseconds: Math.max(0, Date.now() - startedAt),
      requestId: request.id,
    });

    try {
      void Promise.resolve(observabilitySink(event)).catch(() => undefined);
    } catch {
      // Observability is best-effort and must never change API behavior.
    }
  }

  app.addHook("onRequest", async (request) => {
    requestStartedAt.set(request, Date.now());
  });

  app.addHook("onResponse", async (request, reply) => {
    emitRequestEvent(request, reply.statusCode);
  });

  void app.register(cors, {
    origin: ["http://127.0.0.1:3001", "http://localhost:3001"],
    methods: ["DELETE", "GET", "POST", "PUT", "OPTIONS"],
  });

  app.get("/health", async () => ({ ok: true }));
  app.register(authRoutes, { prefix: "/auth" });
  app.register(vaultRoutes, { prefix: "/vault" });
  app.register(deviceRoutes, { prefix: "/devices" });
  app.register(importRoutes, { prefix: "/imports" });
  app.register(activityRoutes, { prefix: "/activity" });
  app.register(localCredentialBridgeRoutes, { prefix: "/v1" });

  if (process.env.UNUVAULT_ENABLE_DEV_SECRETS === "1") {
    app.register(devSecretsRoutes, { prefix: "/dev/secrets" });
  }

  return app;
}

export const app = buildApp();
