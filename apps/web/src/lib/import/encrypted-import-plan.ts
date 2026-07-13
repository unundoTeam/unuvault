import type { BrowserImportAnalysis } from "../../../../../packages/domain/src/browser-import";
import type { VaultSyncItem } from "../../../../../packages/api-client/src/vault";
import {
  isPassphraseProtectedVaultPassword,
  sealVaultPassword,
} from "../../../../../packages/security/src/vault-envelope";
import { isSupportedPasswordDerivedCiphertext } from "../../../../../packages/security/src/argon2-policy";
import {
  getSodium,
  type PasswordDerivedCiphertext,
} from "../../../../../packages/security/src/sodium";

type BuildEncryptedImportPlanInput = {
  analysis: BrowserImportAnalysis;
  passphrase: string;
  idFactory: () => string;
  now: () => Date;
  sealPassword?: (password: string, passphrase: string) => Promise<string>;
};

const VAULT_ITEM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const VAULT_ITEM_ID_MAX_LENGTH = 200;
const V3_ENVELOPE_KEYS = [
  "cipher",
  "encryptedPayload",
  "keyDerivation",
  "memLimit",
  "nonce",
  "opsLimit",
  "purpose",
  "salt",
  "version",
] as const;

export type EncryptedImportPlanErrorCode =
  | "empty_passphrase"
  | "invalid_timestamp"
  | "invalid_id"
  | "invalid_ciphertext"
  | "encryption_failed";

export class EncryptedImportPlanError extends Error {
  readonly code: EncryptedImportPlanErrorCode;

  constructor(code: EncryptedImportPlanErrorCode) {
    super(code);
    this.name = "EncryptedImportPlanError";
    this.code = code;
  }
}

async function isVersionThreeCiphertext(ciphertext: string): Promise<boolean> {
  if (!isPassphraseProtectedVaultPassword(ciphertext)) {
    return false;
  }

  try {
    const parsed = JSON.parse(ciphertext) as Record<string, unknown>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      parsed.version !== 3 ||
      Object.keys(parsed).length !== V3_ENVELOPE_KEYS.length ||
      !V3_ENVELOPE_KEYS.every((key) => Object.hasOwn(parsed, key))
    ) {
      return false;
    }

    return isSupportedPasswordDerivedCiphertext(
      parsed as PasswordDerivedCiphertext,
      await getSodium(),
    );
  } catch {
    return false;
  }
}

export async function buildEncryptedImportPlan(
  input: BuildEncryptedImportPlanInput,
): Promise<{ items: VaultSyncItem[]; report: BrowserImportAnalysis["report"] }> {
  if (input.passphrase.length === 0) {
    throw new EncryptedImportPlanError("empty_passphrase");
  }
  let timestamp: string;
  try {
    const now = input.now();
    if (!Number.isFinite(now.getTime())) {
      throw new Error("invalid timestamp");
    }
    timestamp = now.toISOString();
  } catch {
    throw new EncryptedImportPlanError("invalid_timestamp");
  }
  const items: VaultSyncItem[] = [];
  const generatedIds = new Set<string>();
  const sealPassword = input.sealPassword ?? sealVaultPassword;

  for (const entry of input.analysis.acceptedEntries) {
    let id: string;
    try {
      id = input.idFactory();
    } catch {
      throw new EncryptedImportPlanError("invalid_id");
    }
    if (
      typeof id !== "string" ||
      id.length === 0 ||
      id.length > VAULT_ITEM_ID_MAX_LENGTH ||
      !VAULT_ITEM_ID_PATTERN.test(id) ||
      generatedIds.has(id)
    ) {
      throw new EncryptedImportPlanError("invalid_id");
    }
    generatedIds.add(id);

    let passwordCiphertext: string;
    try {
      passwordCiphertext = await sealPassword(
        entry.password,
        input.passphrase,
      );
    } catch {
      throw new EncryptedImportPlanError("encryption_failed");
    }
    if (!(await isVersionThreeCiphertext(passwordCiphertext))) {
      throw new EncryptedImportPlanError("invalid_ciphertext");
    }

    items.push({
      id,
      item_type: "login",
      title: entry.name || new URL(entry.websiteOrigin).hostname,
      encrypted_payload: {
        schema_version: 1,
        username: entry.username,
        password_ciphertext: passwordCiphertext,
        notes: "",
        website_url: entry.websiteOrigin,
      },
      favorite: false,
      source: `browser_import_${entry.source}`,
      last_used_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  return {
    items,
    report: input.analysis.report,
  };
}
