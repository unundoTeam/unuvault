import {
  type MasterPasswordVerifier,
  parseStoredMasterPasswordVerifier,
} from "../../../../../packages/security/src/master-password-verifier";

const MASTER_PASSWORD_VERIFIER_STORAGE_KEY =
  "unuvault.web.master-password-verifier";

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

  if (rawValue.length > 512) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    return parseStoredMasterPasswordVerifier(parsed);
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
