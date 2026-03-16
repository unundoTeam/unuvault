import type { VaultLoginPayload } from "../../../packages/api-client/src/vault";

export function loginPayload(
  overrides: Partial<VaultLoginPayload> = {},
): VaultLoginPayload {
  return {
    schema_version: 1,
    username: "",
    password_ciphertext: "",
    notes: "",
    ...overrides,
  };
}
