import type {
  DevSecretSessionStore,
  DevSecretTarget,
} from "../lib/dev-secret-session-store";

export class DevSecretsUnauthorizedError extends Error {}

export class DevSecretRecordNotFoundError extends Error {}

export class DevSecretInvalidHandoffError extends Error {}

export class DevSecretValidationError extends Error {}

type StoredDeveloperSecretRecord = {
  ciphertext: string;
};

type DevSecretsServiceDependencies = {
  sessionStore: DevSecretSessionStore;
  getBrowserAccountIdFromToken(token: string): Promise<string | null>;
  getStoredRecord(
    ownerAccountId: string,
    target: DevSecretTarget,
  ): Promise<StoredDeveloperSecretRecord | null>;
  putStoredRecord(
    ownerAccountId: string,
    target: DevSecretTarget,
    ciphertext: string,
  ): Promise<void>;
};

const ALLOWED_APP_CODE = "unundo";
const ALLOWED_TARGET_ENV = "local";
const ALLOWED_SECRET_KIND = "dotenv";

function assertSupportedTarget(target: DevSecretTarget) {
  if (
    target.app_code !== ALLOWED_APP_CODE ||
    target.target_env !== ALLOWED_TARGET_ENV ||
    target.secret_kind !== ALLOWED_SECRET_KIND
  ) {
    throw new DevSecretValidationError("unsupported_target");
  }
}

function assertNonEmptyCiphertext(ciphertext: string) {
  if (ciphertext.trim().length === 0) {
    throw new DevSecretValidationError("invalid_ciphertext");
  }
}

export function createDevSecretsService(deps: DevSecretsServiceDependencies) {
  return {
    async createBrowserHandoff(token: string, target: DevSecretTarget) {
      assertSupportedTarget(target);

      const ownerAccountId = await deps.getBrowserAccountIdFromToken(token);

      if (!ownerAccountId) {
        throw new DevSecretsUnauthorizedError("invalid browser token");
      }

      return {
        handoff_code: deps.sessionStore.createHandoff(ownerAccountId, target),
      };
    },

    async exchangeBrowserHandoff(handoffCode: string) {
      if (handoffCode.trim().length === 0) {
        throw new DevSecretInvalidHandoffError("missing handoff code");
      }

      const handoff = deps.sessionStore.exchangeHandoff(handoffCode);

      if (!handoff) {
        throw new DevSecretInvalidHandoffError("invalid handoff code");
      }

      return {
        cli_session_token: handoff.cli_session_token,
      };
    },

    async getPrivateRecord(cliSessionToken: string, target: DevSecretTarget) {
      assertSupportedTarget(target);

      const cliSession = deps.sessionStore.getCliSession(cliSessionToken);

      if (
        !cliSession ||
        cliSession.target.app_code !== target.app_code ||
        cliSession.target.target_env !== target.target_env ||
        cliSession.target.secret_kind !== target.secret_kind
      ) {
        throw new DevSecretsUnauthorizedError("invalid cli session token");
      }

      const record = await deps.getStoredRecord(
        cliSession.owner_account_id,
        target,
      );

      if (!record) {
        throw new DevSecretRecordNotFoundError("secret record not found");
      }

      return record;
    },

    async putPrivateRecord(
      cliSessionToken: string,
      target: DevSecretTarget,
      ciphertext: string,
    ) {
      assertSupportedTarget(target);
      assertNonEmptyCiphertext(ciphertext);

      const cliSession = deps.sessionStore.getCliSession(cliSessionToken);

      if (
        !cliSession ||
        cliSession.target.app_code !== target.app_code ||
        cliSession.target.target_env !== target.target_env ||
        cliSession.target.secret_kind !== target.secret_kind
      ) {
        throw new DevSecretsUnauthorizedError("invalid cli session token");
      }

      await deps.putStoredRecord(cliSession.owner_account_id, target, ciphertext);

      return { ok: true as const };
    },
  };
}
