import Fastify from "fastify";
import { createLocalCredentialBridgeRoutes } from "../../apps/api/src/routes/local-credential-bridge";
import {
  createInMemoryLocalCredentialBridgeCredentialStore,
  createLocalCredentialBridgeService,
} from "../../apps/api/src/services/local-credential-bridge-service";

const host = "127.0.0.1";
const bridgeToken = process.env.UNUVAULT_BRIDGE_TOKEN ?? "local-smoke-bridge-token";
const sessionToken =
  process.env.UNUVAULT_BRIDGE_SESSION_TOKEN ?? "local-smoke-session-token";
const origin = process.env.UNUVAULT_BRIDGE_SMOKE_ORIGIN;

if (!origin) {
  throw new Error("UNUVAULT_BRIDGE_SMOKE_ORIGIN is required");
}

const credential = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  label: "Local smoke credential",
  password: "local-smoke-password",
  profileId: "workspace-personal",
  username: "local-smoke@example.com",
  websiteOrigin: origin,
};

const app = Fastify({ logger: false });
const store = createInMemoryLocalCredentialBridgeCredentialStore();
const service = createLocalCredentialBridgeService({
  clearUnlockedCredentials: store.clearUnlockedCredentials,
  getAccountIdFromSessionToken: async (token) =>
    token === sessionToken ? "local-smoke-account" : null,
  readUnlockedCredentials: store.readUnlockedCredentials,
  recordBridgeAuditEvent: async () => undefined,
  replaceUnlockedCredentials: store.replaceUnlockedCredentials,
});

let keepAlive: ReturnType<typeof setInterval> | undefined;

async function main() {
  app.register(
    createLocalCredentialBridgeRoutes({
      accessToken: bridgeToken,
      service,
    }),
    { prefix: "/v1" },
  );

  const address = await app.listen({ host, port: 0 });
  const publishResponse = await fetch(
    new URL("/v1/credentials/unlocked-session", address),
    {
      body: JSON.stringify({ credentials: [credential] }),
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      method: "PUT",
    },
  );

  if (!publishResponse.ok) {
    throw new Error(
      `Failed to publish unlocked smoke session: ${publishResponse.status} ${await publishResponse.text()}`,
    );
  }

  process.stdout.write(
    `${JSON.stringify({
      bridgeToken,
      credentialId: credential.id,
      sessionToken,
      url: address,
      username: credential.username,
    })}\n`,
  );

  keepAlive = setInterval(() => undefined, 60_000);
}

async function shutdown() {
  if (keepAlive) clearInterval(keepAlive);
  await app.close();
}

process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  void shutdown().finally(() => process.exit(1));
});
