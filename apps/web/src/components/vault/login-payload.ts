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

export function getHiddenPasswordPlaceholder(
  payload: unknown,
  emptyLabel: string = "No password saved",
): string {
  return hasSavedPassword(payload) ? "••••••••" : emptyLabel;
}

export async function readDraftPassword(
  payload: unknown,
  passphrase?: string,
): Promise<string> {
  if (!passphrase) {
    return "";
  }

  return openStoredVaultPassword(
    normalizeVaultLoginPayload(payload).password_ciphertext,
    passphrase,
  );
}

export async function writeDraftPassword(
  payload: unknown,
  password: string,
  passphrase?: string,
): Promise<VaultLoginPayload> {
  if (password && !passphrase) {
    throw new Error(
      "writeDraftPassword requires an unlock passphrase before storing a password.",
    );
  }

  return {
    ...normalizeVaultLoginPayload(payload),
    password_ciphertext:
      password && passphrase ? await sealVaultPassword(password, passphrase) : "",
  };
}

export async function getPasswordPlaceholderLabel(
  payload: unknown,
  isRevealed: boolean,
  passphrase?: string,
): Promise<string> {
  if (!hasSavedPassword(payload)) {
    return "No password saved";
  }

  if (!isRevealed || !passphrase) {
    return "••••••••";
  }

  const openedPassword = await readDraftPassword(payload, passphrase);

  return openedPassword || "No password saved";
}
