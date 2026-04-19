const FIXTURE_PASSWORD_CIPHERTEXT = "hunter2";

function readRequiredEnv(name) {
  const value = process.env[name] ?? "";

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const accessToken = readRequiredEnv("ACCESS_TOKEN");
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3000";
  const timestamp = new Date().toISOString();
  const itemId = process.env.ITEM_ID ?? crypto.randomUUID();
  const itemTitle = process.env.ITEM_TITLE ?? "Legacy Plaintext Smoke";
  const itemUsername = process.env.ITEM_USERNAME ?? "legacy@example.com";
  const itemNotes = process.env.ITEM_NOTES ?? "legacy plaintext smoke";
  const itemWebsiteUrl =
    process.env.ITEM_WEBSITE_URL ?? "https://example.com/login";
  const passwordCiphertext =
    process.env.LEGACY_PASSWORD_CIPHERTEXT ?? FIXTURE_PASSWORD_CIPHERTEXT;

  const changedItem = {
    id: itemId,
    item_type: "login",
    title: itemTitle,
    encrypted_payload: {
      schema_version: 1,
      username: itemUsername,
      password_ciphertext: passwordCiphertext,
      notes: itemNotes,
      website_url: itemWebsiteUrl,
    },
    favorite: false,
    source: "manual",
    last_used_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const response = await fetch(`${apiBaseUrl}/vault/sync`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      changed_items: [changedItem],
      deleted_item_ids: [],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      `vault_sync_failed:${response.status}:${JSON.stringify(payload)}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        seeded_item: changedItem,
        response: payload,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Failed to seed Web legacy vault item.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
