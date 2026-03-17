import type { VaultLoginPayload } from "../../../../packages/api-client/src/vault";

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
