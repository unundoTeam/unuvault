"use client";

import type { VaultSyncItem } from "../../../../../packages/api-client/src/vault";
import {
  normalizeVaultLoginPayload,
  parseVaultWebsiteMetadata,
} from "../../../../../packages/api-client/src/login-payload";
import { openStoredVaultPassword } from "../../../../../packages/security/src/vault-envelope";
import { createBrowserApiFetch } from "../api/browser-fetch";

type BridgeSessionFetcher = typeof fetch;

type PublishBridgeSessionOptions = {
  accessToken: string;
  fetcher?: BridgeSessionFetcher;
  items: VaultSyncItem[];
  unlockPassphrase: string;
};

type ClearBridgeSessionOptions = {
  accessToken: string;
  fetcher?: BridgeSessionFetcher;
};

type BridgeSessionPublishResponse = {
  ok: true;
  credential_count: number;
};

type BridgeSessionClearResponse = {
  ok: true;
};

async function readJsonResponse<T>(
  response: Awaited<ReturnType<BridgeSessionFetcher>>,
  fallbackMessage: string,
): Promise<T> {
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(fallbackMessage);
  }

  return payload as T;
}

export async function publishLocalCredentialBridgeSession(
  options: PublishBridgeSessionOptions,
): Promise<BridgeSessionPublishResponse> {
  const fetcher = createBrowserApiFetch(options.fetcher);
  const credentials = (
    await Promise.all(
      options.items.map(async (item) => {
        if (item.item_type !== "login") {
          return null;
        }

        const payload = normalizeVaultLoginPayload(item.encrypted_payload);
        const websiteMetadata = parseVaultWebsiteMetadata(payload.website_url);

        if (!websiteMetadata.websiteOrigin) {
          return null;
        }

        const password = await openStoredVaultPassword(
          payload.password_ciphertext,
          options.unlockPassphrase,
        );

        if (!password) {
          return null;
        }

        return {
          id: item.id,
          label: item.title,
          password,
          username: payload.username,
          websiteOrigin: websiteMetadata.websiteOrigin,
        };
      }),
    )
  ).filter((credential): credential is NonNullable<typeof credential> =>
    credential !== null,
  );

  const response = await fetcher("/v1/credentials/unlocked-session", {
    body: JSON.stringify({ credentials }),
    headers: {
      authorization: `Bearer ${options.accessToken}`,
      "content-type": "application/json",
    },
    method: "PUT",
  });

  return readJsonResponse<BridgeSessionPublishResponse>(
    response,
    "local_credential_bridge_publish_failed",
  );
}

export async function clearLocalCredentialBridgeSession(
  options: ClearBridgeSessionOptions,
): Promise<BridgeSessionClearResponse> {
  const fetcher = createBrowserApiFetch(options.fetcher);
  const response = await fetcher("/v1/credentials/unlocked-session", {
    headers: {
      authorization: `Bearer ${options.accessToken}`,
    },
    method: "DELETE",
  });

  return readJsonResponse<BridgeSessionClearResponse>(
    response,
    "local_credential_bridge_clear_failed",
  );
}
