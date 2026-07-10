/**
 * WARNING: these helpers provide local compatibility for current unuvault storage shapes.
 * Version 1 stores plaintext. Version 2 uses a custom XOR stream and non-cryptographic
 * hashing. Version 3 is the current libsodium-backed format for new writes.
 */

import {
  openWithPassword,
  sealWithPassword,
  type PasswordDerivedCiphertext,
} from "./sodium";
import { MAX_PASSWORD_ENVELOPE_JSON_CHARACTERS } from "./argon2-policy";

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

type SecureVaultEnvelope = PasswordDerivedCiphertext & {
  version: 3;
};

export type VaultEnvelope =
  | LegacyVaultEnvelope
  | PassphraseVaultEnvelope
  | SecureVaultEnvelope;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function isSupportedVaultEnvelopeVersion(version: number) {
  return version === 1 || version === 2 || version === 3;
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
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

function isSecureEnvelope(
  value: Partial<VaultEnvelope>,
): value is SecureVaultEnvelope {
  return (
    value.version === 3 &&
    value.cipher === "xchacha20poly1305-ietf" &&
    value.keyDerivation === "argon2id13" &&
    value.purpose === "vault-password" &&
    typeof value.encryptedPayload === "string" &&
    typeof value.nonce === "string" &&
    typeof value.salt === "string" &&
    typeof value.opsLimit === "number" &&
    typeof value.memLimit === "number"
  );
}

function parseVaultEnvelope(ciphertext: string): Partial<VaultEnvelope> | null {
  if (ciphertext.length > MAX_PASSWORD_ENVELOPE_JSON_CHARACTERS) return null;

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

  return !!parsed && (isPassphraseEnvelope(parsed) || isSecureEnvelope(parsed));
}

export async function sealVaultPassword(password: string, passphrase: string): Promise<string> {
  if (!passphrase) {
    throw new Error(
      "sealVaultPassword requires a non-empty passphrase.",
    );
  }

  const sealed = await sealWithPassword(password, passphrase, "vault-password");

  return JSON.stringify({
    version: 3,
    ...sealed,
  } satisfies SecureVaultEnvelope);
}

export async function openVaultPassword(
  ciphertext: string,
  passphrase?: string,
): Promise<string> {
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

  if (isSecureEnvelope(parsed)) {
    return passphrase ? openWithPassword(parsed, passphrase) : "";
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

export async function openStoredVaultPassword(
  ciphertext: string,
  passphrase?: string,
): Promise<string> {
  if (!ciphertext) {
    return "";
  }

  const openedEnvelope = await openVaultPassword(ciphertext, passphrase);

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
