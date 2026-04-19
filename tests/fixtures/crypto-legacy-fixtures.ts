export const LEGACY_FIXTURE_MASTER_PASSWORD = "correct horse";
export const LEGACY_FIXTURE_WRONG_MASTER_PASSWORD = "wrong battery";
export const LEGACY_FIXTURE_VAULT_PASSWORD = "hunter2";
export const LEGACY_FIXTURE_SALT_BASE64 = "AQIDBAUGBwgJCgsM";
export const LEGACY_FIXTURE_DEV_SECRET_DOTENV =
  "SUPABASE_URL=https://example.supabase.co\nSUPABASE_ANON_KEY=anon-key\n";

export const LEGACY_FIXTURE_VAULT_PASSWORD_PLAINTEXT =
  LEGACY_FIXTURE_VAULT_PASSWORD;

export const LEGACY_FIXTURE_VAULT_ENVELOPE_V1 = JSON.stringify({
  version: 1,
  cipher: "xchacha20-poly1305",
  encryptedPayload: LEGACY_FIXTURE_VAULT_PASSWORD,
  keyDerivation: "argon2id",
} as const);

export const LEGACY_FIXTURE_VAULT_ENVELOPE_V2 = JSON.stringify({
  version: 2,
  cipher: "xor-stream-v1",
  encryptedPayload: "NCg0LwUTbA==",
  keyDerivation: "unlock-passphrase-v1",
  unlockSalt: LEGACY_FIXTURE_SALT_BASE64,
  unlockTag: "2d384e02",
} as const);

export const LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1 = {
  version: 1,
  salt: LEGACY_FIXTURE_SALT_BASE64,
  check: "716ba384",
} as const;

export const LEGACY_FIXTURE_DEVELOPER_SECRET_BLOB_V1 = JSON.stringify({
  version: 1,
  cipher: "xor-stream-v1",
  encryptedPayload:
    "DwgKGiIgDRoLAKa/y52Mg4qKxtSt5vzk6/fk7FQIfXdnZ214bydjkIzU0dXLycnaOyDNxcHD18zP0LniFBQSUB0SAXM=",
  keyDerivation: "master-password-v1",
  salt: LEGACY_FIXTURE_SALT_BASE64,
  tag: "ec184a2a",
} as const);
