import sodiumModule from "libsodium-wrappers-sumo";

const sodium = sodiumModule as typeof import("libsodium-wrappers-sumo");

const PWHASH_ALGORITHM = "argon2id13" as const;
const AEAD_CIPHER = "xchacha20poly1305-ietf" as const;
const BASE64_VARIANT = sodium.base64_variants.URLSAFE_NO_PADDING;

export type ReadySodium = typeof sodium;

export type PasswordDerivedCiphertext = {
  cipher: typeof AEAD_CIPHER;
  purpose: string;
  encryptedPayload: string;
  nonce: string;
  salt: string;
  opsLimit: number;
  memLimit: number;
  keyDerivation: typeof PWHASH_ALGORITHM;
};

let sodiumReadyPromise: Promise<ReadySodium> | null = null;

export async function getSodium(): Promise<ReadySodium> {
  sodiumReadyPromise ??= sodium.ready.then(() => sodium);
  return sodiumReadyPromise;
}

export async function createPasswordHash(password: string): Promise<string> {
  const ready = await getSodium();
  return ready.crypto_pwhash_str(
    password,
    ready.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    ready.crypto_pwhash_MEMLIMIT_INTERACTIVE,
  );
}

export async function verifyPasswordHash(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  if (!passwordHash || !password) {
    return false;
  }

  const ready = await getSodium();

  try {
    return ready.crypto_pwhash_str_verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function sealWithPassword(
  plaintext: string,
  password: string,
  purpose: string,
): Promise<PasswordDerivedCiphertext> {
  if (!password) {
    throw new Error("sealWithPassword requires a non-empty password.");
  }

  if (!purpose) {
    throw new Error("sealWithPassword requires a non-empty purpose tag.");
  }

  const ready = await getSodium();
  const salt = ready.randombytes_buf(ready.crypto_pwhash_SALTBYTES, "uint8array");
  const nonce = ready.randombytes_buf(
    ready.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES,
    "uint8array",
  );
  const opsLimit = ready.crypto_pwhash_OPSLIMIT_INTERACTIVE;
  const memLimit = ready.crypto_pwhash_MEMLIMIT_INTERACTIVE;
  const key = ready.crypto_pwhash(
    ready.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
    password,
    salt,
    opsLimit,
    memLimit,
    ready.crypto_pwhash_ALG_ARGON2ID13,
    "uint8array",
  );

  try {
    const encryptedPayload = ready.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext,
      purpose,
      null,
      nonce,
      key,
      "uint8array",
    );

    return {
      cipher: AEAD_CIPHER,
      purpose,
      encryptedPayload: ready.to_base64(encryptedPayload, BASE64_VARIANT),
      nonce: ready.to_base64(nonce, BASE64_VARIANT),
      salt: ready.to_base64(salt, BASE64_VARIANT),
      opsLimit,
      memLimit,
      keyDerivation: PWHASH_ALGORITHM,
    };
  } finally {
    ready.memzero(key);
  }
}

export async function openWithPassword(
  ciphertext: PasswordDerivedCiphertext,
  password: string,
): Promise<string> {
  if (!password) {
    return "";
  }

  const ready = await getSodium();

  if (
    ciphertext.cipher !== AEAD_CIPHER ||
    ciphertext.keyDerivation !== PWHASH_ALGORITHM ||
    !ciphertext.purpose ||
    !ciphertext.encryptedPayload ||
    !ciphertext.nonce ||
    !ciphertext.salt
  ) {
    return "";
  }

  let key: Uint8Array | null = null;

  try {
    key = ready.crypto_pwhash(
      ready.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
      password,
      ready.from_base64(ciphertext.salt, BASE64_VARIANT),
      ciphertext.opsLimit,
      ciphertext.memLimit,
      ready.crypto_pwhash_ALG_ARGON2ID13,
      "uint8array",
    );

    const plaintext = ready.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      ready.from_base64(ciphertext.encryptedPayload, BASE64_VARIANT),
      ciphertext.purpose,
      ready.from_base64(ciphertext.nonce, BASE64_VARIANT),
      key,
      "text",
    );

    return plaintext;
  } catch {
    return "";
  } finally {
    if (key) {
      ready.memzero(key);
    }
  }
}
