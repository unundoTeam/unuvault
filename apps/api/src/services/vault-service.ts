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

type VaultSyncServiceDependencies = {
  getUserByToken(token: string): Promise<AuthUser | null>;
  getUserProfileByAuthUserId(authUserId: string): Promise<VaultSyncProfile | null>;
};

export class VaultSyncUnauthorizedError extends Error {}

export class VaultSyncProfileNotFoundError extends Error {}

export function buildVaultSyncPayload(_profile: VaultSyncProfile) {
  return {
    server_time: new Date().toISOString(),
    updated_items: [],
    deleted_item_ids: [],
    conflicts: [],
  };
}

export function createVaultSyncService(deps: VaultSyncServiceDependencies) {
  return {
    async syncVaultFromToken(token: string) {
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

      return buildVaultSyncPayload(profile);
    },
  };
}
