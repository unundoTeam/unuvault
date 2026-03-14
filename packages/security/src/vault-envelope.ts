export type VaultEnvelope = {
  version: 1;
  cipher: "xchacha20-poly1305";
  encryptedPayload: string;
  keyDerivation: "argon2id";
};

export function isSupportedVaultEnvelopeVersion(version: number) {
  return version === 1;
}
