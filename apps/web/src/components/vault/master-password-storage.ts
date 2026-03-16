import type { MasterPasswordVerifier } from "../../../../../packages/security/src/master-password-verifier";

const MASTER_PASSWORD_VERIFIER_STORAGE_KEY =
  "unuvault.web.master-password-verifier";

function isMasterPasswordVerifier(
  value: unknown,
): value is MasterPasswordVerifier {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Partial<MasterPasswordVerifier>).version === 1 &&
    typeof (value as Partial<MasterPasswordVerifier>).salt === "string" &&
    typeof (value as Partial<MasterPasswordVerifier>).check === "string"
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
