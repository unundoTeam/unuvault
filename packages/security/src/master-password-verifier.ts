import {
  createPasswordHash,
  verifyPasswordHash,
} from "./sodium";

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
  return (
    !!value &&
    typeof value === "object" &&
    (value as Partial<LegacyMasterPasswordVerifier>).version === 1 &&
    typeof (value as Partial<LegacyMasterPasswordVerifier>).salt === "string" &&
    typeof (value as Partial<LegacyMasterPasswordVerifier>).check === "string"
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

  if (isSecureMasterPasswordVerifier(verifier)) {
    return (await verifyPasswordHash(verifier.passwordHash, masterPassword))
      ? { success: true }
      : { success: false };
  }

  if (!isLegacyMasterPasswordVerifier(verifier)) {
    return { success: false };
  }

  if (hashToHex(`${masterPassword}:${verifier.salt}`) !== verifier.check) {
    return { success: false };
  }

  return {
    success: true,
    upgradedVerifier: await createMasterPasswordVerifier(masterPassword),
  };
}
