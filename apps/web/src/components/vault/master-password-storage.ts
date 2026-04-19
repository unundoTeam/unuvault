import {
  type LegacyMasterPasswordVerifier,
  type MasterPasswordVerifier,
  type SecureMasterPasswordVerifier,
} from "../../../../../packages/security/src/master-password-verifier";

const MASTER_PASSWORD_VERIFIER_STORAGE_KEY =
  "unuvault.web.master-password-verifier";

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

function isMasterPasswordVerifier(
  value: unknown,
): value is MasterPasswordVerifier {
  return (
    isLegacyMasterPasswordVerifier(value) ||
    isSecureMasterPasswordVerifier(value)
  );
}

export function readMasterPasswordVerifier(): MasterPasswordVerifier | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(
    MASTER_PASSWORD_VERIFIER_STORAGE_KEY,
  );

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    return isMasterPasswordVerifier(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeMasterPasswordVerifier(
  verifier: MasterPasswordVerifier,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    MASTER_PASSWORD_VERIFIER_STORAGE_KEY,
    JSON.stringify(verifier),
  );
}

export function clearMasterPasswordVerifier(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(MASTER_PASSWORD_VERIFIER_STORAGE_KEY);
}
