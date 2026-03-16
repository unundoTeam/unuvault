export type VaultEnvelope = {
  version: 1;
  cipher: "xchacha20-poly1305";
  encryptedPayload: string;
  keyDerivation: "argon2id";
};

export function isSupportedVaultEnvelopeVersion(version: number) {
  return version === 1;
}

export function sealVaultPassword(password: string): string {
  const envelope: VaultEnvelope = {
    version: 1,
    cipher: "xchacha20-poly1305",
    encryptedPayload: password,
    keyDerivation: "argon2id",
  };

  return JSON.stringify(envelope);
}

export function openVaultPassword(ciphertext: string): string {
  if (!ciphertext) {
    return "";
  }

  try {
    const parsed = JSON.parse(ciphertext) as Partial<VaultEnvelope>;

    if (
      !isSupportedVaultEnvelopeVersion(parsed.version ?? 0) ||
      parsed.cipher !== "xchacha20-poly1305" ||
      parsed.keyDerivation !== "argon2id" ||
      typeof parsed.encryptedPayload !== "string"
    ) {
      return "";
    }

    return parsed.encryptedPayload;
  } catch {
    return "";
  }
}
