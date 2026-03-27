import { randomUUID } from "node:crypto";

export type DevSecretTarget = {
  app_code: string;
  target_env: string;
  secret_kind: "dotenv";
};

type HandoffRecord = {
  owner_account_id: string;
  target: DevSecretTarget;
  expires_at: number;
};

type CliSessionRecord = {
  owner_account_id: string;
  target: DevSecretTarget;
  expires_at: number;
};

type DevSecretSessionStoreOptions = {
  handoffTtlMs?: number;
  cliSessionTtlMs?: number;
  now?: () => number;
};

export function createDevSecretSessionStore(
  options: DevSecretSessionStoreOptions = {},
) {
  const handoffTtlMs = options.handoffTtlMs ?? 60_000;
  const cliSessionTtlMs = options.cliSessionTtlMs ?? 300_000;
  const now = options.now ?? (() => Date.now());
  const handoffs = new Map<string, HandoffRecord>();
  const cliSessions = new Map<string, CliSessionRecord>();

  function purgeExpiredRecords() {
    const currentTime = now();

    for (const [handoffCode, record] of handoffs.entries()) {
      if (record.expires_at <= currentTime) {
        handoffs.delete(handoffCode);
      }
    }

    for (const [sessionToken, record] of cliSessions.entries()) {
      if (record.expires_at <= currentTime) {
        cliSessions.delete(sessionToken);
      }
    }
  }

  return {
    createHandoff(ownerAccountId: string, target: DevSecretTarget) {
      purgeExpiredRecords();

      const handoffCode = randomUUID();

      handoffs.set(handoffCode, {
        owner_account_id: ownerAccountId,
        target,
        expires_at: now() + handoffTtlMs,
      });

      return handoffCode;
    },

    exchangeHandoff(handoffCode: string) {
      purgeExpiredRecords();

      const handoff = handoffs.get(handoffCode) ?? null;

      if (!handoff) {
        return null;
      }

      handoffs.delete(handoffCode);

      const cliSessionToken = randomUUID();

      cliSessions.set(cliSessionToken, {
        owner_account_id: handoff.owner_account_id,
        target: handoff.target,
        expires_at: now() + cliSessionTtlMs,
      });

      return {
        cli_session_token: cliSessionToken,
        owner_account_id: handoff.owner_account_id,
        target: handoff.target,
      };
    },

    getCliSession(cliSessionToken: string) {
      purgeExpiredRecords();

      return cliSessions.get(cliSessionToken) ?? null;
    },
  };
}

export type DevSecretSessionStore = ReturnType<
  typeof createDevSecretSessionStore
>;
