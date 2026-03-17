type AuthUser = {
  id: string;
  account_id: string | null;
  email: string | null;
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

type AuthBootstrapServiceDependencies = {
  getUserByToken(token: string): Promise<AuthUser | null>;
  upsertUserProfile(profile: UserProfileRecord): Promise<AuthBootstrapProfile>;
};

export class AuthBootstrapUnauthorizedError extends Error {}

export function createAuthBootstrapService(
  deps: AuthBootstrapServiceDependencies,
) {
  return {
    async bootstrapProfileFromToken(token: string) {
      const user = await deps.getUserByToken(token);

      if (!user?.email || !user.account_id) {
        throw new AuthBootstrapUnauthorizedError(
          "token did not resolve to an authenticated user",
        );
      }

      const profile = await deps.upsertUserProfile({
        auth_user_id: user.id,
        account_id: user.account_id,
        email: user.email,
        locale: "zh-CN",
      });

      return { profile };
    },
  };
}
