import { createAuthBootstrapService } from "../services/auth-bootstrap-service";

type AuthUser = {
  id: string;
  email: string | null;
};

type ProviderAuthUser = {
  id: string;
  email?: string | null;
};

type UserProfileRecord = {
  auth_user_id: string;
  email: string;
  locale: string;
};

type AuthBootstrapProfile = {
  id: string;
  email: string;
  locale: string;
};

type SupabaseResult<T> = PromiseLike<{
  data: T | null;
  error: unknown | null;
}>;

type SupabaseClientLike = {
  auth: {
    getUser(token: string): SupabaseResult<{ user: ProviderAuthUser | null }>;
  };
  from(table: string): {
    upsert(
      values: UserProfileRecord,
      options: { onConflict: string },
    ): {
      select(columns: string): {
        single(): SupabaseResult<AuthBootstrapProfile>;
      };
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

export function createSupabaseAuthBootstrapDependencies(
  client: SupabaseClientLike,
) {
  return {
    async getUserByToken(token: string): Promise<AuthUser | null> {
      const result = await client.auth.getUser(token);
      const user = result.data?.user ?? null;

      if (result.error) {
        throw result.error;
      }

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email ?? null,
      };
    },

    async upsertUserProfile(
      profile: UserProfileRecord,
    ): Promise<AuthBootstrapProfile> {
      const result = await client
        .from("users_profile")
        .upsert(profile, { onConflict: "auth_user_id" })
        .select("id, email, locale")
        .single();

      if (result.error || !result.data) {
        throw result.error ?? new Error("failed to upsert users_profile");
      }

      return result.data;
    },
  };
}

async function createServerSupabaseClient() {
  const { createClient } = await import("@supabase/supabase-js");

  return createClient(
    readRequiredEnv("SUPABASE_URL"),
    readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

let configuredService:
  | ReturnType<typeof createAuthBootstrapService>
  | undefined;

export function createConfiguredAuthBootstrapService() {
  return {
    async bootstrapProfileFromToken(token: string) {
      if (!configuredService) {
        const client = await createServerSupabaseClient();
        configuredService = createAuthBootstrapService(
          createSupabaseAuthBootstrapDependencies(client),
        );
      }

      return configuredService.bootstrapProfileFromToken(token);
    },
  };
}
