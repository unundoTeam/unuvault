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
  softDeleteVaultItems(profileId: string, itemIds: string[]): Promise<void>;
  listVaultItemsByProfileId(profileId: string): Promise<VaultItemRow[]>;
  listDeletedVaultItemIdsByProfileId(profileId: string): Promise<string[]>;
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
  deletedItemIds: string[],
): VaultSyncResponse {
  return {
    server_time: new Date().toISOString(),
    updated_items: vaultItems.map(mapVaultItemRowToSyncItem),
    deleted_item_ids: deletedItemIds,
    conflicts: [],
  };
}

function uniqueIds(itemIds: string[]): string[] {
  return [...new Set(itemIds)];
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

      const deletedItemIds = uniqueIds(payload.deleted_item_ids);
      const deletedItemIdSet = new Set(deletedItemIds);
      const changedItems = payload.changed_items.filter(
        (item) => !deletedItemIdSet.has(item.id),
      );
      const referencedItemIds = uniqueIds([
        ...changedItems.map((item) => item.id),
        ...deletedItemIds,
      ]);

      if (referencedItemIds.length > 0) {
        const existingItems = await deps.listVaultItemsByIds(referencedItemIds);
        const foreignOwnedItem = existingItems.find(
          (item) => item.user_profile_id !== profile.id,
        );

        if (foreignOwnedItem) {
          throw new VaultSyncItemConflictError(
            "item id belongs to another profile",
          );
        }
      }

      if (changedItems.length > 0) {
        await deps.upsertVaultItems(profile.id, changedItems);
      }

      if (deletedItemIds.length > 0) {
        await deps.softDeleteVaultItems(profile.id, deletedItemIds);
      }

      const vaultItems = await deps.listVaultItemsByProfileId(profile.id);
      const profileDeletedItemIds =
        await deps.listDeletedVaultItemIdsByProfileId(profile.id);

      return buildVaultSyncPayload(profile, vaultItems, profileDeletedItemIds);
    },
  };
}
