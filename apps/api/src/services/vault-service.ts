import type {
  VaultSyncRequest,
  VaultSyncItem,
  VaultSyncResponse,
} from "../../../../packages/api-client/src/vault";

type VaultSyncProfile = {
  id: string;
  auth_user_id: string;
  email: string;
  locale: string;
};

type AuthUser = {
  id: string;
  email: string | null;
};

type VaultItemRow = {
  id: string;
  user_profile_id: string;
  item_type: string;
  title: string;
  encrypted_payload: Record<string, unknown>;
  favorite: boolean;
  source: string;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

type VaultSyncServiceDependencies = {
  getUserByToken(token: string): Promise<AuthUser | null>;
  getUserProfileByAuthUserId(authUserId: string): Promise<VaultSyncProfile | null>;
  listVaultItemsByIds(itemIds: string[]): Promise<VaultItemRow[]>;
  upsertVaultItems(profileId: string, items: VaultSyncItem[]): Promise<void>;
  listVaultItemsByProfileId(profileId: string): Promise<VaultItemRow[]>;
};

export class VaultSyncUnauthorizedError extends Error {}

export class VaultSyncProfileNotFoundError extends Error {}

export class VaultSyncItemConflictError extends Error {}

function mapVaultItemRowToSyncItem(row: VaultItemRow): VaultSyncItem {
  return {
    id: row.id,
    item_type: row.item_type,
    title: row.title,
    encrypted_payload: row.encrypted_payload,
    favorite: row.favorite,
    source: row.source,
    last_used_at: row.last_used_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function buildVaultSyncPayload(
  _profile: VaultSyncProfile,
  vaultItems: VaultItemRow[],
): VaultSyncResponse {
  return {
    server_time: new Date().toISOString(),
    updated_items: vaultItems.map(mapVaultItemRowToSyncItem),
    deleted_item_ids: [],
    conflicts: [],
  };
}

export function createVaultSyncService(deps: VaultSyncServiceDependencies) {
  return {
    async syncVaultFromToken(token: string, payload: VaultSyncRequest) {
      const user = await deps.getUserByToken(token);

      if (!user?.id) {
        throw new VaultSyncUnauthorizedError(
          "token did not resolve to an authenticated user",
        );
      }

      const profile = await deps.getUserProfileByAuthUserId(user.id);

      if (!profile) {
        throw new VaultSyncProfileNotFoundError(
          "authenticated user has no users_profile",
        );
      }

      if (payload.changed_items.length > 0) {
        const existingItems = await deps.listVaultItemsByIds(
          payload.changed_items.map((item) => item.id),
        );
        const foreignOwnedItem = existingItems.find(
          (item) => item.user_profile_id !== profile.id,
        );

        if (foreignOwnedItem) {
          throw new VaultSyncItemConflictError(
            "item id belongs to another profile",
          );
        }

        await deps.upsertVaultItems(profile.id, payload.changed_items);
      }

      const vaultItems = await deps.listVaultItemsByProfileId(profile.id);

      return buildVaultSyncPayload(profile, vaultItems);
    },
  };
}
