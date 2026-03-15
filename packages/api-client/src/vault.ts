export type VaultSyncRequest = {
  changed_items: VaultSyncItem[];
};

export type VaultSyncItem = {
  id: string;
  item_type: string;
  title: string;
  encrypted_payload: Record<string, unknown>;
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

type Fetcher = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  json(): Promise<VaultSyncResponse>;
}>;

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

  return response.json();
}
