import type { VaultLoginPayload } from "../../../../../packages/api-client/src/vault";
import {
  openStoredVaultPassword,
  sealVaultPassword,
} from "../../../../../packages/security/src/vault-envelope";

export function normalizeVaultLoginPayload(payload: unknown): VaultLoginPayload {
  const value =
    payload && typeof payload === "object"
      ? (payload as Partial<VaultLoginPayload>)
      : {};

  return {
    schema_version: value.schema_version === 1 ? 1 : 1,
    username: typeof value.username === "string" ? value.username : "",
    password_ciphertext:
      typeof value.password_ciphertext === "string" ? value.password_ciphertext : "",
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}

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
  return {
    ...normalizeVaultLoginPayload(payload),
    password_ciphertext: password ? sealVaultPassword(password, passphrase) : "",
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
