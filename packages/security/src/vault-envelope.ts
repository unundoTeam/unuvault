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
  const bytes = new Uint8Array(12);

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

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

export function sealVaultPassword(password: string, passphrase?: string): string {
  const envelope = passphrase
    ? createPassphraseEnvelope(password, passphrase)
    : createLegacyEnvelope(password);

  return JSON.stringify(envelope);
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
