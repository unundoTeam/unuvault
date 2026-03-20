export type VaultLoginPayload = {
  schema_version: 1;
  username: string;
  password_ciphertext: string;
  notes: string;
  website_url: string;
};

export type VaultSyncRequest = {
  changed_items: VaultSyncItem[];
  deleted_item_ids: string[];
};

export type VaultSyncItem = {
  id: string;
  item_type: string;
  title: string;
  encrypted_payload: VaultLoginPayload;
  favorite: boolean;
  source: string;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VaultSyncResponse = {
  server_time: string;
  updated_items: VaultSyncItem[];
  deleted_item_ids: string[];
  conflicts: unknown[];
};

type VaultSyncErrorResponse = {
  error?: string;
  ok?: boolean;
};

type Fetcher = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok?: boolean;
  status?: number;
  json(): Promise<VaultSyncResponse | VaultSyncErrorResponse>;
}>;

function readVaultSyncErrorMessage(
  payload: VaultSyncResponse | VaultSyncErrorResponse,
): string | null {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string" &&
    payload.error
  ) {
    return payload.error;
  }

  return null;
}

export async function syncVault(
  fetcher: Fetcher,
  token: string,
  payload: VaultSyncRequest,
): Promise<VaultSyncResponse> {
  const response = await fetcher("/vault/sync", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as
    | VaultSyncResponse
    | VaultSyncErrorResponse;

  if (response.ok === false) {
    const message =
      readVaultSyncErrorMessage(result) ??
      `sync_failed:${response.status ?? "unknown"}`;
    throw new Error(message);
  }

  return result as VaultSyncResponse;
}
