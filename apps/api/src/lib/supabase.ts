import { createDevSecretSessionStore } from "./dev-secret-session-store";
import { createAuthBootstrapService } from "../services/auth-bootstrap-service";
import { createDevSecretsService } from "../services/dev-secrets-service";
import { createVaultSyncService } from "../services/vault-service";
import type { VaultSyncItem } from "../../../../packages/api-client/src/vault";
import type { DevSecretTarget } from "./dev-secret-session-store";

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

type DeveloperSecretRecordRow = {
  owner_account_id: string;
  app_code: string;
  target_env: string;
  secret_kind: string;
  ciphertext: string;
};

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

type ProductAdminSupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function getOptionalProductAdminSupabaseConfig(): ProductAdminSupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url && !serviceRoleKey) {
    return null;
  }

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Product admin Supabase configuration requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return { url, serviceRoleKey };
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

async function createSupabaseClientFromValues(
  url: string,
  key: string,
): Promise<IdentitySupabaseClientLike & ProductDataSupabaseClientLike> {
  const { createClient: importedCreateClient } = await import("@supabase/supabase-js");
  const createClient = importedCreateClient as unknown as (
    url: string,
    key: string,
  ) => IdentitySupabaseClientLike & ProductDataSupabaseClientLike;

  return createClient(url, key);
}

async function createSupabaseClient(
  urlEnv: string,
  keyEnv: string,
): Promise<IdentitySupabaseClientLike & ProductDataSupabaseClientLike> {
  return createSupabaseClientFromValues(
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

export async function createProductAdminClient(): Promise<ProductDataSupabaseClientLike | null> {
  const config = getOptionalProductAdminSupabaseConfig();

  if (!config) {
    return null;
  }

  return createSupabaseClientFromValues(config.url, config.serviceRoleKey);
}

export async function createProductDataSupabaseClient(): Promise<ProductDataSupabaseClientLike> {
  const client = await createProductAdminClient();

  if (!client) {
    throw new Error(
      "Product admin Supabase configuration requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return client;
}

let configuredService:
  | ReturnType<typeof createAuthBootstrapService>
  | undefined;
let configuredVaultSyncService:
  | ReturnType<typeof createVaultSyncService>
  | undefined;
let configuredDevSecretsService:
  | ReturnType<typeof createDevSecretsService>
  | undefined;
const configuredDevSecretSessionStore = createDevSecretSessionStore();

async function ensureConfiguredDevSecretsService() {
  if (!configuredDevSecretsService) {
    const [identityClient, dataClient] = await Promise.all([
      createIdentitySupabaseClient(),
      createProductDataSupabaseClient(),
    ]);
    const authDependencies = createSupabaseAuthBootstrapDependencies({
      identityClient,
      dataClient,
    });

    configuredDevSecretsService = createDevSecretsService({
      sessionStore: configuredDevSecretSessionStore,
      async getBrowserAccountIdFromToken(browserToken: string) {
        const user = await authDependencies.getUserByToken(browserToken);

        return user?.account_id ?? null;
      },
      async getStoredRecord(ownerAccountId, recordTarget) {
        const query = dataClient
          .from("developer_secret_records")
          .select("ciphertext") as {
          eq(column: string, value: string): unknown;
        };
        const scopedQuery = (
          (query
            .eq("owner_account_id", ownerAccountId) as {
            eq(column: string, value: string): unknown;
          })
            .eq("app_code", recordTarget.app_code) as {
            eq(column: string, value: string): unknown;
          }
        )
          .eq("target_env", recordTarget.target_env) as {
          eq(column: string, value: string): {
            single(): SupabaseResult<
              Pick<DeveloperSecretRecordRow, "ciphertext">
            >;
          };
        };
        const result = await scopedQuery
          .eq("secret_kind", recordTarget.secret_kind)
          .single();

        if (result.error) {
          if (isMissingRowError(result.error)) {
            return null;
          }

          throw result.error;
        }

        if (!result.data) {
          return null;
        }

        return {
          ciphertext: result.data.ciphertext,
        };
      },
      async putStoredRecord(ownerAccountId, recordTarget, ciphertext) {
        const result = await (
          dataClient.from("developer_secret_records").upsert(
            {
              owner_account_id: ownerAccountId,
              app_code: recordTarget.app_code,
              target_env: recordTarget.target_env,
              secret_kind: recordTarget.secret_kind,
              ciphertext,
            },
            {
              onConflict: "owner_account_id,app_code,target_env,secret_kind",
            },
          ) as SupabaseResult<null>
        );

        if (result.error) {
          throw result.error;
        }
      },
    });
  }

  return configuredDevSecretsService;
}

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

export function createConfiguredDevSecretsService() {
  return {
    async createBrowserHandoff(token: string, target: DevSecretTarget) {
      const service = await ensureConfiguredDevSecretsService();

      return service.createBrowserHandoff(token, target);
    },

    async exchangeBrowserHandoff(handoffCode: string) {
      const service = await ensureConfiguredDevSecretsService();

      return service.exchangeBrowserHandoff(handoffCode);
    },

    async getPrivateRecord(token: string, target: DevSecretTarget) {
      const service = await ensureConfiguredDevSecretsService();

      return service.getPrivateRecord(token, target);
    },

    async putPrivateRecord(
      token: string,
      target: DevSecretTarget,
      ciphertext: string,
    ) {
      const service = await ensureConfiguredDevSecretsService();

      return service.putPrivateRecord(token, target, ciphertext);
    },
  };
}
