import type { BootstrapProfileResponse } from "../../../../packages/api-client/src/auth";
import { bootstrapProfile } from "../../../../packages/api-client/src/auth";
import { clearStoredAuthState, readStoredAuthState, type StoredAuthState, writeStoredAuthState } from "./auth-storage";
import { createExtensionSupabaseClient } from "./extension-supabase";

export type ExtensionAuthState =
  | {
      status: "signed_out";
    }
  | ({
      status: "signed_in";
    } & StoredAuthState);

type Fetcher = Parameters<typeof bootstrapProfile>[0];

type ExtensionAuthDeps = {
  bootstrapProfile(
    fetcher: Fetcher,
    token: string,
  ): Promise<BootstrapProfileResponse>;
  clearStoredAuthState(): Promise<void>;
  createApiFetch(): Fetcher;
  createSupabaseClient(): {
    auth: {
      signInWithPassword(input: {
        email: string;
        password: string;
      }): Promise<{
        data: {
          session: {
            access_token?: string | null;
          } | null;
          user: {
            email?: string | null;
          } | null;
        };
        error: unknown;
      }>;
    };
  };
  now(): string;
  readStoredAuthState(): Promise<StoredAuthState | null>;
  writeStoredAuthState(state: StoredAuthState): Promise<void>;
};

type SignInInput = {
  email: string;
  password: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function createApiFetch(): Fetcher {
  return (input, init) => fetch(`${API_BASE_URL}${input}`, init) as ReturnType<Fetcher>;
}

function createDefaultDeps(): ExtensionAuthDeps {
  return {
    bootstrapProfile,
    clearStoredAuthState,
    createApiFetch,
    createSupabaseClient: createExtensionSupabaseClient,
    now: () => new Date().toISOString(),
    readStoredAuthState,
    writeStoredAuthState,
  };
}

function toSignedInState(state: StoredAuthState | null): ExtensionAuthState {
  if (!state) {
    return {
      status: "signed_out",
    };
  }

  return {
    status: "signed_in",
    ...state,
  };
}

function createBootstrappedAuthState(input: {
  accessToken: string;
  email: string;
  profile: BootstrapProfileResponse["profile"];
  signedInAt: string;
}): StoredAuthState {
  return {
    accessToken: input.accessToken,
    email: input.email,
    profileId: input.profile.id,
    signedInAt: input.signedInAt,
  };
}

export function createExtensionAuthRuntime(
  deps: ExtensionAuthDeps = createDefaultDeps(),
) {
  return {
    async readExtensionAuthState(): Promise<ExtensionAuthState> {
      return toSignedInState(await deps.readStoredAuthState());
    },
    async signInWithPassword(input: SignInInput): Promise<ExtensionAuthState> {
      const result = await deps.createSupabaseClient().auth.signInWithPassword(input);

      if (result.error) {
        throw result.error;
      }

      const accessToken = result.data.session?.access_token;

      if (!accessToken) {
        throw new Error("missing access token");
      }

      const profile = await deps.bootstrapProfile(deps.createApiFetch(), accessToken);
      const nextState = createBootstrappedAuthState({
        accessToken,
        email: result.data.user?.email ?? input.email,
        profile: profile.profile,
        signedInAt: deps.now(),
      });

      await deps.writeStoredAuthState(nextState);

      return toSignedInState(nextState);
    },
    async signOut(): Promise<void> {
      await deps.clearStoredAuthState();
    },
  };
}

export async function readExtensionAuthState(): Promise<ExtensionAuthState> {
  return createExtensionAuthRuntime().readExtensionAuthState();
}

export async function signInWithPassword(
  input: SignInInput,
): Promise<ExtensionAuthState> {
  return createExtensionAuthRuntime().signInWithPassword(input);
}

export async function signOut(): Promise<void> {
  await createExtensionAuthRuntime().signOut();
}
