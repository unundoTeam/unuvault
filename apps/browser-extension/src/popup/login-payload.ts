import {
  normalizeVaultLoginPayload,
  parseVaultWebsiteMetadata,
} from "../../../../packages/api-client/src/login-payload";
import { openStoredVaultPassword } from "../../../../packages/security/src/vault-envelope";

export function hasSavedPassword(payload: unknown): boolean {
  return normalizeVaultLoginPayload(payload).password_ciphertext.trim().length > 0;
}

export function readStoredPassword(payload: unknown, passphrase?: string): string {
  if (!passphrase) {
    return "";
  }

  return openStoredVaultPassword(
    normalizeVaultLoginPayload(payload).password_ciphertext,
    passphrase,
  );
}

export function getPasswordPlaceholderLabel(
  payload: unknown,
  isRevealed: boolean,
  passphrase?: string,
): string {
  if (!hasSavedPassword(payload)) {
    return "No password saved";
  }

  if (!isRevealed || !passphrase) {
    return "••••••••";
  }

  const openedPassword = readStoredPassword(payload, passphrase);

  return openedPassword || "No password saved";
}
