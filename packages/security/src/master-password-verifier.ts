import {
  createPasswordHash,
  verifyPasswordHash,
} from "./sodium";
import { isPinnedArgon2idVerifierSyntax } from "./argon2-policy";

export type LegacyMasterPasswordVerifier = {
  version: 1;
  salt: string;
  check: string;
};

export type SecureMasterPasswordVerifier = {
  version: 2;
  algorithm: "argon2id13";
  passwordHash: string;
};

export type MasterPasswordVerifier =
  | LegacyMasterPasswordVerifier
  | SecureMasterPasswordVerifier;

export type VerifyMasterPasswordResult =
  | {
      success: false;
    }
  | {
      success: true;
      upgradedVerifier?: SecureMasterPasswordVerifier;
    };

const textEncoder = new TextEncoder();
const LEGACY_SALT_BASE64 = /^[A-Za-z0-9+/]{16}$/;
const LEGACY_CHECK_HEX = /^[0-9a-f]{8}$/;

function isCanonicalLegacySalt(value: string): boolean {
  if (!LEGACY_SALT_BASE64.test(value)) return false;

  try {
    const decoded = atob(value);
    return decoded.length === 12 && btoa(decoded) === value;
  } catch {
    return false;
  }
}

function hashToHex(input: string): string {
  let hash = 0x811c9dc5;
  const bytes = textEncoder.encode(input);

  for (const value of bytes) {
    hash ^= value;
    hash = Math.imul(hash >>> 0, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isLegacyMasterPasswordVerifier(
  value: unknown,
): value is LegacyMasterPasswordVerifier {
  const candidate = value as Partial<LegacyMasterPasswordVerifier> | null;

  return (
    !!candidate &&
    typeof candidate === "object" &&
    candidate.version === 1 &&
    typeof candidate.salt === "string" &&
    isCanonicalLegacySalt(candidate.salt) &&
    typeof candidate.check === "string" &&
    LEGACY_CHECK_HEX.test(candidate.check)
  );
}

function isSecureMasterPasswordVerifier(
  value: unknown,
): value is SecureMasterPasswordVerifier {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Partial<SecureMasterPasswordVerifier>).version === 2 &&
    (value as Partial<SecureMasterPasswordVerifier>).algorithm === "argon2id13" &&
    typeof (value as Partial<SecureMasterPasswordVerifier>).passwordHash === "string"
  );
}

export function parseStoredMasterPasswordVerifier(
  value: unknown,
): MasterPasswordVerifier | null {
  if (isLegacyMasterPasswordVerifier(value)) return value;
  if (
    !isSecureMasterPasswordVerifier(value) ||
    !isPinnedArgon2idVerifierSyntax(value.passwordHash)
  ) {
    return null;
  }
  return value;
}

export async function createMasterPasswordVerifier(
  masterPassword: string,
): Promise<SecureMasterPasswordVerifier> {
  return {
    version: 2,
    algorithm: "argon2id13",
    passwordHash: await createPasswordHash(masterPassword),
  };
}

export async function verifyMasterPassword(
  verifier: unknown,
  masterPassword: string,
): Promise<VerifyMasterPasswordResult> {
  if (!masterPassword) {
    return { success: false };
  }

  const parsedVerifier = parseStoredMasterPasswordVerifier(verifier);

  if (!parsedVerifier) {
    return { success: false };
  }

  if (parsedVerifier.version === 2) {
    return (await verifyPasswordHash(parsedVerifier.passwordHash, masterPassword))
      ? { success: true }
      : { success: false };
  }

  if (
    hashToHex(`${masterPassword}:${parsedVerifier.salt}`) !==
    parsedVerifier.check
  ) {
    return { success: false };
  }

  return {
    success: true,
    upgradedVerifier: await createMasterPasswordVerifier(masterPassword),
  };
}
