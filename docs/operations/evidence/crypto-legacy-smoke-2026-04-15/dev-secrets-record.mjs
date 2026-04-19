const LEGACY_DEVELOPER_SECRET_BLOB_V1 = JSON.stringify({
  version: 1,
  cipher: "xor-stream-v1",
  encryptedPayload:
    "DwgKGiIgDRoLAKa/y52Mg4qKxtSt5vzk6/fk7FQIfXdnZ214bydjkIzU0dXLycnaOyDNxcHD18zP0LniFBQSUB0SAXM=",
  keyDerivation: "master-password-v1",
  salt: "AQIDBAUGBwgJCgsM",
  tag: "ec184a2a",
});

function readRequiredEnv(name) {
  const value = process.env[name] ?? "";

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function readJsonResponse(response, fallbackCode) {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`${fallbackCode}:${response.status}:${JSON.stringify(payload)}`);
  }

  return payload;
}

async function createCliSessionToken(apiBaseUrl, accessToken, app, env) {
  const handoff = await readJsonResponse(
    await fetch(`${apiBaseUrl}/dev/secrets/handoffs`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ app, env }),
    }),
    "handoff_create_failed",
  );

  const exchange = await readJsonResponse(
    await fetch(`${apiBaseUrl}/dev/secrets/handoffs/exchange`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        handoff_code: handoff.handoff_code,
      }),
    }),
    "handoff_exchange_failed",
  );

  return exchange.cli_session_token;
}

async function readRecord(apiBaseUrl, cliSessionToken, app, env) {
  return readJsonResponse(
    await fetch(`${apiBaseUrl}/dev/secrets/records/${app}/${env}/dotenv`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${cliSessionToken}`,
      },
    }),
    "secret_read_failed",
  );
}

async function writeRecord(apiBaseUrl, cliSessionToken, app, env, ciphertext) {
  return readJsonResponse(
    await fetch(`${apiBaseUrl}/dev/secrets/records/${app}/${env}/dotenv`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${cliSessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ciphertext,
      }),
    }),
    "secret_write_failed",
  );
}

async function main() {
  const mode = process.argv[2] ?? "";

  if (mode !== "seed-legacy" && mode !== "read") {
    throw new Error("Usage: node dev-secrets-record.mjs <seed-legacy|read>");
  }

  const accessToken = readRequiredEnv("ACCESS_TOKEN");
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3000";
  const app = process.env.APP_CODE ?? "unundo";
  const env = process.env.TARGET_ENV ?? "local";
  const cliSessionToken = await createCliSessionToken(
    apiBaseUrl,
    accessToken,
    app,
    env,
  );

  if (mode === "seed-legacy") {
    const writeResponse = await writeRecord(
      apiBaseUrl,
      cliSessionToken,
      app,
      env,
      LEGACY_DEVELOPER_SECRET_BLOB_V1,
    );

    const readResponse = await readRecord(apiBaseUrl, cliSessionToken, app, env);

    console.log(
      JSON.stringify(
        {
          mode,
          target: { app, env },
          write_response: writeResponse,
          record: readResponse,
        },
        null,
        2,
      ),
    );
    return;
  }

  const record = await readRecord(apiBaseUrl, cliSessionToken, app, env);

  console.log(
    JSON.stringify(
      {
        mode,
        target: { app, env },
        record,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Failed to operate on the dev-secrets record.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
