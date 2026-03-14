export function buildVaultSyncPayload() {
  return {
    server_time: new Date().toISOString(),
    updated_items: [],
    deleted_item_ids: [],
    conflicts: [],
  };
}
