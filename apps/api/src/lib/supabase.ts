import { createAuthBootstrapService } from "../services/auth-bootstrap-service";
import { createVaultSyncService } from "../services/vault-service";
import type { VaultSyncItem } from "../../../../packages/api-client/src/vault";

type AuthUser = {
  id: string;
  account_id: string | null;
  email: string | null;
};

type ProviderAuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: {
    account_id?: string | null;
  };
  user_metadata?: {
    account_id?: string | null;
  };
};

type UserProfileRecord = {
  auth_user_id: string;
  account_id: string;
  email: string;
  locale: string;
};

type AuthBootstrapProfile = {
  id: string;
  account_id: string;
  email: string;
  locale: string;
};

type UserProfile = {
  id: string;
  account_id: string;
  auth_user_id: string;
  email: string;
  locale: string;
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
  deleted_at: string | null;
};

type VaultItemWriteRow = Omit<VaultItemRow, "deleted_at">;

type SupabaseResult<T> = PromiseLike<{
  data: T | null;
  error: unknown | null;
}>;

type IdentityAccountRow = {
  account_id: string;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
};

type IdentitySupabaseClientLike = {
  auth: {
    getUser(token: string): SupabaseResult<{ user: ProviderAuthUser | null }>;
  };
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): SupabaseResult<IdentityAccountRow>;
      };
    };
  };
};

type ProductDataSupabaseClientLike = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): unknown;
      in(column: string, values: string[]): unknown;
    };
    upsert(values: unknown, options: { onConflict: string }): unknown;
    update(values: unknown): {
      in(column: string, values: string[]): unknown;
    };
  };
};

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function isMissingRowError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as SupabaseLikeError;

  return (
    candidate.code === "PGRST116" ||
    candidate.message?.toLowerCase().includes("no rows") === true
  );
}

async function resolveAccountIdForAuthUser(
  client: IdentitySupabaseClientLike,
  authUserId: string,
): Promise<string | null> {
  const result = await (
    client
      .from("account_identities")
      .select("account_id")
      .eq("auth_user_id", authUserId) as {
      single(): SupabaseResult<IdentityAccountRow>;
    }
  ).single();

  if (result.error) {
    if (isMissingRowError(result.error)) {
      return null;
    }

    throw result.error;
  }

  if (!result.data?.account_id) {
    return null;
  }

  return result.data.account_id;
}

export function createSupabaseAuthBootstrapDependencies(
  clients: {
    identityClient: IdentitySupabaseClientLike;
    dataClient: ProductDataSupabaseClientLike;
  },
) {
  return {
    async getUserByToken(token: string): Promise<AuthUser | null> {
      const result = await clients.identityClient.auth.getUser(token);
      const user = result.data?.user ?? null;

      if (result.error) {
        throw result.error;
      }

      if (!user) {
        return null;
      }

      const accountId = await resolveAccountIdForAuthUser(
        clients.identityClient,
        user.id,
      );

      return {
        id: user.id,
        account_id: accountId,
        email: user.email ?? null,
      };
    },

    async upsertUserProfile(
      profile: UserProfileRecord,
    ): Promise<AuthBootstrapProfile> {
      const result = await (
        clients.dataClient
          .from("users_profile")
          .upsert(profile, { onConflict: "account_id" }) as {
          select(columns: string): {
            single(): SupabaseResult<AuthBootstrapProfile>;
          };
        }
      )
        .select("id, account_id, email, locale")
        .single();

      if (result.error || !result.data) {
        throw result.error ?? new Error("failed to upsert users_profile");
      }

      return result.data;
    },

    async getUserProfileByAccountId(
      accountId: string,
    ): Promise<UserProfile | null> {
      const result = await (
        clients.dataClient
          .from("users_profile")
          .select("id, account_id, auth_user_id, email, locale")
          .eq("account_id", accountId) as {
          single(): SupabaseResult<UserProfile>;
        }
      ).single();

      if (result.error) {
        return null;
      }

      return result.data;
    },

    async listVaultItemsByProfileId(profileId: string): Promise<VaultItemRow[]> {
      const result = await (
        clients.dataClient
          .from("vault_items")
          .select(
            "id, user_profile_id, item_type, title, encrypted_payload, favorite, source, last_used_at, created_at, updated_at",
          )
          .eq("user_profile_id", profileId) as {
          is(column: string, value: null): SupabaseResult<VaultItemRow[]>;
        }
      ).is("deleted_at", null);

      if (result.error) {
        throw result.error;
      }

      return result.data ?? [];
    },

    async listDeletedVaultItemIdsByProfileId(
      profileId: string,
    ): Promise<string[]> {
      const result = await (
        clients.dataClient
          .from("vault_items")
          .select("id")
          .eq("user_profile_id", profileId) as {
          not(
            column: string,
            operator: string,
            value: null,
          ): SupabaseResult<Array<{ id: string }>>;
        }
      ).not("deleted_at", "is", null);

      if (result.error) {
        throw result.error;
      }

      return (result.data ?? []).map((row) => row.id);
    },

    async listVaultItemsByIds(itemIds: string[]): Promise<VaultItemRow[]> {
      if (itemIds.length === 0) {
        return [];
      }

      const result = await (
        clients.dataClient
          .from("vault_items")
          .select(
            "id, user_profile_id, item_type, title, encrypted_payload, favorite, source, last_used_at, created_at, updated_at",
          )
          .in("id", itemIds) as SupabaseResult<VaultItemRow[]>
      );

      if (result.error) {
        throw result.error;
      }

      return result.data ?? [];
    },

    async upsertVaultItems(
      profileId: string,
      items: VaultSyncItem[],
    ): Promise<void> {
      if (items.length === 0) {
        return;
      }

      const records: VaultItemWriteRow[] = items.map((item) => ({
        ...item,
        user_profile_id: profileId,
      }));

      const result = await (
        clients.dataClient
          .from("vault_items")
          .upsert(records, { onConflict: "id" }) as SupabaseResult<null>
      );

      if (result.error) {
        throw result.error;
      }
    },

    async softDeleteVaultItems(
      profileId: string,
      itemIds: string[],
    ): Promise<void> {
      if (itemIds.length === 0) {
        return;
      }

      const result = await (
        clients.dataClient
          .from("vault_items")
          .update({
            deleted_at: new Date().toISOString(),
          }) as {
          in(column: string, values: string[]): {
            eq(column: string, value: string): SupabaseResult<null>;
          };
        }
      )
        .in("id", itemIds)
        .eq("user_profile_id", profileId);

      if (result.error) {
        throw result.error;
      }
    },
  };
}

async function createSupabaseClient(
  urlEnv: string,
  keyEnv: string,
): Promise<IdentitySupabaseClientLike & ProductDataSupabaseClientLike> {
  const { createClient: importedCreateClient } = await import("@supabase/supabase-js");
  const createClient = importedCreateClient as unknown as (
    url: string,
    key: string,
  ) => IdentitySupabaseClientLike & ProductDataSupabaseClientLike;

  return createClient(
    readRequiredEnv(urlEnv),
    readRequiredEnv(keyEnv),
  );
}

async function createIdentitySupabaseClient(): Promise<IdentitySupabaseClientLike> {
  return createSupabaseClient(
    "IDENTITY_SUPABASE_URL",
    "IDENTITY_SUPABASE_SERVICE_ROLE_KEY",
  );
}

async function createProductDataSupabaseClient(): Promise<ProductDataSupabaseClientLike> {
  return createSupabaseClient("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
}

let configuredService:
  | ReturnType<typeof createAuthBootstrapService>
  | undefined;
let configuredVaultSyncService:
  | ReturnType<typeof createVaultSyncService>
  | undefined;

export function createConfiguredAuthBootstrapService() {
  return {
    async bootstrapProfileFromToken(token: string) {
      if (!configuredService) {
        const [identityClient, dataClient] = await Promise.all([
          createIdentitySupabaseClient(),
          createProductDataSupabaseClient(),
        ]);
        configuredService = createAuthBootstrapService(
          createSupabaseAuthBootstrapDependencies({
            identityClient,
            dataClient,
          }),
        );
      }

      return configuredService.bootstrapProfileFromToken(token);
    },
  };
}

export function createConfiguredVaultSyncService() {
  return {
    async syncVaultFromToken(
      token: string,
      payload: Parameters<
        ReturnType<typeof createVaultSyncService>["syncVaultFromToken"]
      >[1],
    ) {
      if (!configuredVaultSyncService) {
        const [identityClient, dataClient] = await Promise.all([
          createIdentitySupabaseClient(),
          createProductDataSupabaseClient(),
        ]);
        configuredVaultSyncService = createVaultSyncService(
          createSupabaseAuthBootstrapDependencies({
            identityClient,
            dataClient,
          }),
        );
      }

      return configuredVaultSyncService.syncVaultFromToken(token, payload);
    },
  };
}
