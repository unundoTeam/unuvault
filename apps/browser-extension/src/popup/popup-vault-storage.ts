import type {
  VaultLoginPayload,
  VaultSyncItem,
} from "../../../../packages/api-client/src/vault";

const POPUP_VAULT_STORAGE_KEY = "unuvault.extension.popup-vault-items";

type ExtensionStorageArea = {
  get(keys: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
};

function getExtensionStorageArea(): ExtensionStorageArea | null {
  return (
    (globalThis as {
      chrome?: {
        storage?: {
          local?: ExtensionStorageArea;
        };
      };
    }).chrome?.storage?.local ?? null
  );
}

function isVaultLoginPayload(value: unknown): value is VaultLoginPayload {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Partial<VaultLoginPayload>).schema_version === 1 &&
    typeof (value as Partial<VaultLoginPayload>).username === "string" &&
    typeof (value as Partial<VaultLoginPayload>).password_ciphertext === "string" &&
    typeof (value as Partial<VaultLoginPayload>).notes === "string"
  );
}

function isVaultSyncItem(value: unknown): value is VaultSyncItem {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Partial<VaultSyncItem>).id === "string" &&
    typeof (value as Partial<VaultSyncItem>).item_type === "string" &&
    typeof (value as Partial<VaultSyncItem>).title === "string" &&
    isVaultLoginPayload((value as Partial<VaultSyncItem>).encrypted_payload) &&
    typeof (value as Partial<VaultSyncItem>).favorite === "boolean" &&
    typeof (value as Partial<VaultSyncItem>).source === "string" &&
    ((value as Partial<VaultSyncItem>).last_used_at === null ||
      typeof (value as Partial<VaultSyncItem>).last_used_at === "string") &&
    typeof (value as Partial<VaultSyncItem>).created_at === "string" &&
    typeof (value as Partial<VaultSyncItem>).updated_at === "string"
  );
}

function parseStoredVaultItems(value: unknown): VaultSyncItem[] {
  const parsed = typeof value === "string" ? (JSON.parse(value) as unknown) : value;

  return Array.isArray(parsed) && parsed.every(isVaultSyncItem) ? parsed : [];
}

export async function readPopupVaultItems(): Promise<VaultSyncItem[]> {
  const storage = getExtensionStorageArea();

  if (!storage) {
    return [];
  }

  try {
    const stored = await storage.get(POPUP_VAULT_STORAGE_KEY);

    return parseStoredVaultItems(stored[POPUP_VAULT_STORAGE_KEY]);
  } catch {
    return [];
  }
}
