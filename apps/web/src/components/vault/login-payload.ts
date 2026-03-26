import {
  normalizeVaultLoginPayload as normalizeSharedVaultLoginPayload,
  normalizeVaultWebsiteUrl,
} from "../../../../../packages/api-client/src/login-payload";
import type { VaultLoginPayload } from "../../../../../packages/api-client/src/vault";
import {
  openStoredVaultPassword,
  sealVaultPassword,
} from "../../../../../packages/security/src/vault-envelope";

export function normalizeVaultLoginPayload(payload: unknown): VaultLoginPayload {
  return normalizeSharedVaultLoginPayload(payload);
}

export { normalizeVaultWebsiteUrl };

export function hasSavedPassword(payload: unknown): boolean {
  return normalizeVaultLoginPayload(payload).password_ciphertext.trim().length > 0;
}

export function getHiddenPasswordPlaceholder(payload: unknown): string {
  return hasSavedPassword(payload) ? "••••••••" : "No password saved";
}

export function readDraftPassword(payload: unknown, passphrase?: string): string {
  if (!passphrase) {
    return "";
  }

  return openStoredVaultPassword(
    normalizeVaultLoginPayload(payload).password_ciphertext,
    passphrase,
  );
}

export function writeDraftPassword(
  payload: unknown,
  password: string,
  passphrase?: string,
): VaultLoginPayload {
  if (password && !passphrase) {
    throw new Error(
      "writeDraftPassword requires an unlock passphrase before storing a password.",
    );
  }

  return {
    ...normalizeVaultLoginPayload(payload),
    password_ciphertext: password && passphrase ? sealVaultPassword(password, passphrase) : "",
  };
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

  const openedPassword = readDraftPassword(payload, passphrase);

  return openedPassword || "No password saved";
}
