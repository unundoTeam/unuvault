import { bootstrapProfile } from "../../../../../packages/api-client/src/auth";

type SessionResult = {
  data: {
    session: {
      access_token: string;
    } | null;
  };
  error: unknown | null;
};

interface BootstrapUnuvaultProfileDependencies {
  getSession(): Promise<SessionResult>;
  bootstrapProfile(token: string): Promise<Awaited<ReturnType<typeof bootstrapProfile>>>;
}

export async function bootstrapUnuvaultProfile(
  deps: BootstrapUnuvaultProfileDependencies,
) {
  const sessionResult = await deps.getSession();
  const accessToken = sessionResult.data.session?.access_token;

  if (sessionResult.error || !accessToken) {
    throw new Error("missing_identity_session");
  }

  return deps.bootstrapProfile(accessToken);
}
