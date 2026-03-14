export type VaultSyncRequest = {
  changed_items: unknown[];
};

export type VaultSyncResponse = {
  server_time: string;
  updated_items: unknown[];
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
  payload: VaultSyncRequest,
): Promise<VaultSyncResponse> {
  const response = await fetcher("/vault/sync", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}
