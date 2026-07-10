import type {
  PasswordDerivedCiphertext,
  ReadySodium,
} from "./sodium";

const MAX_PLAINTEXT_BYTES = 1_048_576;
const AEAD_TAG_BYTES = 16;
const MAX_CIPHERTEXT_BYTES = MAX_PLAINTEXT_BYTES + AEAD_TAG_BYTES;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const ARGON2ID_VERIFIER = /^\$argon2id\$v=([0-9]+)\$m=([0-9]+),t=([0-9]+),p=([0-9]+)\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/;

export const ARGON2ID_V3_POLICY = Object.freeze({
  opsLimit: 2,
  memLimit: 67_108_864,
  version: 19,
  memoryKiB: 65_536,
  iterations: 2,
  parallelism: 1,
  saltBytes: 16,
  nonceBytes: 24,
  maxVerifierCharacters: 127,
  maxPlaintextBytes: MAX_PLAINTEXT_BYTES,
  maxCiphertextBytes: MAX_CIPHERTEXT_BYTES,
  maxCiphertextBase64URLCharacters: Math.ceil((MAX_CIPHERTEXT_BYTES * 4) / 3),
});

function isFiniteSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isSafeInteger(value);
}

function decodeCanonicalBase64URL(
  value: string,
  ready: ReadySodium,
): Uint8Array | null {
  if (!value || !BASE64URL.test(value) || value.includes("=")) return null;
  try {
    const decoded = ready.from_base64(
      value,
      ready.base64_variants.URLSAFE_NO_PADDING,
    );
    return ready.to_base64(
      decoded,
      ready.base64_variants.URLSAFE_NO_PADDING,
    ) === value
      ? decoded
      : null;
  } catch {
    return null;
  }
}

function isCanonicalOriginalNoPadding(value: string): boolean {
  try {
    const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
    const decoded = atob(padded);
    return btoa(decoded).replace(/=+$/u, "") === value;
  } catch {
    return false;
  }
}

export function runtimeMatchesArgon2Policy(ready: ReadySodium): boolean {
  return ready.crypto_pwhash_OPSLIMIT_INTERACTIVE === ARGON2ID_V3_POLICY.opsLimit &&
    ready.crypto_pwhash_MEMLIMIT_INTERACTIVE === ARGON2ID_V3_POLICY.memLimit &&
    ready.crypto_pwhash_SALTBYTES === ARGON2ID_V3_POLICY.saltBytes &&
    ready.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES === ARGON2ID_V3_POLICY.nonceBytes &&
    ready.crypto_aead_xchacha20poly1305_ietf_ABYTES === AEAD_TAG_BYTES &&
    ready.crypto_pwhash_STRBYTES - 1 === ARGON2ID_V3_POLICY.maxVerifierCharacters &&
    ready.crypto_pwhash_STRPREFIX === "$argon2id$" &&
    ready.crypto_pwhash_ALG_DEFAULT === ready.crypto_pwhash_ALG_ARGON2ID13;
}

export function isSupportedPasswordDerivedCiphertext(
  value: PasswordDerivedCiphertext,
  ready: ReadySodium,
): boolean {
  if (!runtimeMatchesArgon2Policy(ready) ||
      !isFiniteSafeInteger(value.opsLimit) ||
      !isFiniteSafeInteger(value.memLimit) ||
      value.opsLimit !== ARGON2ID_V3_POLICY.opsLimit ||
      value.memLimit !== ARGON2ID_V3_POLICY.memLimit ||
      value.purpose.length === 0 ||
      new TextEncoder().encode(value.purpose).byteLength > 128 ||
      value.salt.length !== 22 ||
      value.nonce.length !== 32 ||
      value.encryptedPayload.length < 22 ||
      value.encryptedPayload.length > ARGON2ID_V3_POLICY.maxCiphertextBase64URLCharacters) {
    return false;
  }

  const salt = decodeCanonicalBase64URL(value.salt, ready);
  const nonce = decodeCanonicalBase64URL(value.nonce, ready);
  const ciphertext = decodeCanonicalBase64URL(value.encryptedPayload, ready);
  return salt?.byteLength === ARGON2ID_V3_POLICY.saltBytes &&
    nonce?.byteLength === ARGON2ID_V3_POLICY.nonceBytes &&
    !!ciphertext &&
    ciphertext.byteLength >= AEAD_TAG_BYTES &&
    ciphertext.byteLength <= ARGON2ID_V3_POLICY.maxCiphertextBytes;
}

export function isSupportedArgon2idVerifier(
  value: string,
  ready: ReadySodium,
): boolean {
  return runtimeMatchesArgon2Policy(ready) &&
    isPinnedArgon2idVerifierSyntax(value);
}

export function isPinnedArgon2idVerifierSyntax(value: string): boolean {
  if (value.length > ARGON2ID_V3_POLICY.maxVerifierCharacters ||
      !/^[\x20-\x7E]+$/.test(value)) {
    return false;
  }

  const match = ARGON2ID_VERIFIER.exec(value);
  if (!match) return false;
  const [, version, memoryKiB, iterations, parallelism, salt, hash] = match;
  return version === "19" &&
    memoryKiB === "65536" &&
    iterations === "2" &&
    parallelism === "1" &&
    isCanonicalOriginalNoPadding(salt) &&
    isCanonicalOriginalNoPadding(hash);
}
