/**
 * WARNING: these helpers provide local compatibility for current unuvault storage shapes,
 * not production-grade encryption. Version 1 stores plaintext. Version 2 uses a custom
 * XOR stream and non-cryptographic hashing. Do not treat either version as a real
 * security boundary.
 */

/**
 * @deprecated Version 1 stores the password as plaintext and only exists for explicit
 * legacy fixtures and migration compatibility.
 */
type LegacyVaultEnvelope = {
  version: 1;
  cipher: "xchacha20-poly1305";
  encryptedPayload: string;
  keyDerivation: "argon2id";
};

type PassphraseVaultEnvelope = {
  version: 2;
  cipher: "xor-stream-v1";
  encryptedPayload: string;
  keyDerivation: "unlock-passphrase-v1";
  unlockSalt: string;
  unlockTag: string;
};

export type VaultEnvelope = LegacyVaultEnvelope | PassphraseVaultEnvelope;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function isSupportedVaultEnvelopeVersion(version: number) {
  return version === 1 || version === 2;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";

  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });

  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function createLegacyEnvelope(password: string): LegacyVaultEnvelope {
  return {
    version: 1,
    cipher: "xchacha20-poly1305",
    encryptedPayload: password,
    keyDerivation: "argon2id",
  };
}

function createRandomSalt(): string {
  if (
    typeof crypto === "undefined" ||
    typeof crypto.getRandomValues !== "function"
  ) {
    throw new Error(
      "Secure random values are unavailable. Refusing to seal vault passwords without crypto.getRandomValues.",
    );
  }

  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);

  return toBase64(bytes);
}

function hashToHex(input: string): string {
  let hash = 0x811c9dc5;
  const bytes = textEncoder.encode(input);

  for (const value of bytes) {
    hash ^= value;
    hash = Math.imul(hash >>> 0, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createKeystream(length: number, passphrase: string, salt: string): Uint8Array {
  const output = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    const streamByteHex = hashToHex(`${passphrase}:${salt}:${index}`);
    output[index] = Number.parseInt(streamByteHex.slice(0, 2), 16);
  }

  return output;
}

function xorWithKeystream(
  bytes: Uint8Array,
  passphrase: string,
  salt: string,
): Uint8Array {
  const keystream = createKeystream(bytes.length, passphrase, salt);
  const output = new Uint8Array(bytes.length);

  for (let index = 0; index < bytes.length; index += 1) {
    output[index] = bytes[index] ^ keystream[index];
  }

  return output;
}

function createPassphraseEnvelope(
  password: string,
  passphrase: string,
): PassphraseVaultEnvelope {
  const unlockSalt = createRandomSalt();
  const encryptedPayload = toBase64(
    xorWithKeystream(textEncoder.encode(password), passphrase, unlockSalt),
  );

  return {
    version: 2,
    cipher: "xor-stream-v1",
    encryptedPayload,
    keyDerivation: "unlock-passphrase-v1",
    unlockSalt,
    unlockTag: hashToHex(`${password}:${passphrase}:${unlockSalt}`),
  };
}

function isLegacyEnvelope(value: Partial<VaultEnvelope>): value is LegacyVaultEnvelope {
  return (
    value.version === 1 &&
    value.cipher === "xchacha20-poly1305" &&
    value.keyDerivation === "argon2id" &&
    typeof value.encryptedPayload === "string"
  );
}

function isPassphraseEnvelope(
  value: Partial<VaultEnvelope>,
): value is PassphraseVaultEnvelope {
  return (
    value.version === 2 &&
    value.cipher === "xor-stream-v1" &&
    value.keyDerivation === "unlock-passphrase-v1" &&
    typeof value.encryptedPayload === "string" &&
    typeof value.unlockSalt === "string" &&
    typeof value.unlockTag === "string"
  );
}

function parseVaultEnvelope(ciphertext: string): Partial<VaultEnvelope> | null {
  try {
    return JSON.parse(ciphertext) as Partial<VaultEnvelope>;
  } catch {
    return null;
  }
}

export function isPassphraseProtectedVaultPassword(ciphertext: string): boolean {
  if (!ciphertext) {
    return false;
  }

  const parsed = parseVaultEnvelope(ciphertext);

  return !!parsed && isPassphraseEnvelope(parsed);
}

/**
 * @deprecated Version 1 vault envelopes are plaintext. Use only for explicit legacy
 * fixtures or compatibility tests.
 */
export function sealLegacyVaultPassword(password: string): string {
  return JSON.stringify(createLegacyEnvelope(password));
}

/**
 * WARNING: requires a non-empty passphrase for all new writes. This still does not
 * provide production-grade cryptography, but removing the implicit v1 fallback prevents
 * accidental plaintext storage behind a misleading API.
 */
export function sealVaultPassword(password: string, passphrase: string): string {
  if (!passphrase) {
    throw new Error(
      "sealVaultPassword requires a non-empty passphrase. Use sealLegacyVaultPassword only for explicit legacy compatibility.",
    );
  }

  return JSON.stringify(createPassphraseEnvelope(password, passphrase));
}

export function openVaultPassword(ciphertext: string, passphrase?: string): string {
  if (!ciphertext) {
    return "";
  }

  const parsed = parseVaultEnvelope(ciphertext);

  if (!parsed || !isSupportedVaultEnvelopeVersion(parsed.version ?? 0)) {
    return "";
  }

  if (isLegacyEnvelope(parsed)) {
    return parsed.encryptedPayload;
  }

  if (!isPassphraseEnvelope(parsed) || !passphrase) {
    return "";
  }

  try {
    const opened = textDecoder.decode(
      xorWithKeystream(fromBase64(parsed.encryptedPayload), passphrase, parsed.unlockSalt),
    );

    return hashToHex(`${opened}:${passphrase}:${parsed.unlockSalt}`) ===
      parsed.unlockTag
      ? opened
      : "";
  } catch {
    return "";
  }
}

export function openStoredVaultPassword(ciphertext: string, passphrase?: string): string {
  if (!ciphertext) {
    return "";
  }

  const openedEnvelope = openVaultPassword(ciphertext, passphrase);

  if (openedEnvelope) {
    return openedEnvelope;
  }

  const trimmed = ciphertext.trimStart();

  if (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed.startsWith("\"")
  ) {
    return "";
  }

  return ciphertext;
}
