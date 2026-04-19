import {
  normalizeVaultLoginPayload,
  parseVaultWebsiteMetadata,
} from "../../../../packages/api-client/src/login-payload";
import { openStoredVaultPassword } from "../../../../packages/security/src/vault-envelope";

export { normalizeVaultLoginPayload, parseVaultWebsiteMetadata };

export function hasSavedPassword(payload: unknown): boolean {
  return normalizeVaultLoginPayload(payload).password_ciphertext.trim().length > 0;
}

export async function readStoredPassword(
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

  const openedPassword = await readStoredPassword(payload, passphrase);

  return openedPassword || "No password saved";
}
