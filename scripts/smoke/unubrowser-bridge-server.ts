import Fastify from "fastify";
import { createUnubrowserBridgeRoutes } from "../../apps/api/src/routes/unubrowser-bridge";
import {
  createInMemoryUnubrowserBridgeCredentialStore,
  createUnubrowserBridgeService,
} from "../../apps/api/src/services/unubrowser-bridge-service";

const host = "127.0.0.1";
const bridgeToken = process.env.UNUVAULT_BRIDGE_TOKEN ?? "local-smoke-bridge-token";
const browserToken = process.env.UNUVAULT_BROWSER_TOKEN ?? "local-smoke-browser-token";
const origin = process.env.UNUBROWSER_SMOKE_ORIGIN;

if (!origin) {
  throw new Error("UNUBROWSER_SMOKE_ORIGIN is required");
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
const store = createInMemoryUnubrowserBridgeCredentialStore();
const service = createUnubrowserBridgeService({
  clearUnlockedCredentials: store.clearUnlockedCredentials,
  getBrowserAccountIdFromToken: async (token) =>
    token === browserToken ? "local-smoke-account" : null,
  readUnlockedCredentials: store.readUnlockedCredentials,
  recordBridgeAuditEvent: async () => undefined,
  replaceUnlockedCredentials: store.replaceUnlockedCredentials,
});

let keepAlive: ReturnType<typeof setInterval> | undefined;

async function main() {
  app.register(
    createUnubrowserBridgeRoutes({
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
        authorization: `Bearer ${browserToken}`,
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
      browserToken,
      credentialId: credential.id,
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
