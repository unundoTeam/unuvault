import {
  openWithPassword,
  sealWithPassword,
  type PasswordDerivedCiphertext,
} from "./sodium";

type LegacyDeveloperSecretEnvelope = {
  version: 1;
  cipher: "xor-stream-v1";
  encryptedPayload: string;
  keyDerivation: "master-password-v1";
  salt: string;
  tag: string;
};

type SecureDeveloperSecretEnvelope = PasswordDerivedCiphertext & {
  version: 2;
};

export type DeveloperSecretEnvelope =
  | LegacyDeveloperSecretEnvelope
  | SecureDeveloperSecretEnvelope;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

function createKeystream(length: number, masterPassword: string, salt: string): Uint8Array {
  const output = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    const streamByteHex = hashToHex(`${masterPassword}:${salt}:${index}`);
    output[index] = Number.parseInt(streamByteHex.slice(0, 2), 16);
  }

  return output;
}

function xorWithKeystream(
  bytes: Uint8Array,
  masterPassword: string,
  salt: string,
): Uint8Array {
  const keystream = createKeystream(bytes.length, masterPassword, salt);
  const output = new Uint8Array(bytes.length);

  for (let index = 0; index < bytes.length; index += 1) {
    output[index] = bytes[index] ^ keystream[index];
  }

  return output;
}

function isLegacyDeveloperSecretEnvelope(
  value: unknown,
): value is LegacyDeveloperSecretEnvelope {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Partial<LegacyDeveloperSecretEnvelope>).version === 1 &&
    (value as Partial<LegacyDeveloperSecretEnvelope>).cipher === "xor-stream-v1" &&
    (value as Partial<LegacyDeveloperSecretEnvelope>).keyDerivation ===
      "master-password-v1" &&
    typeof (value as Partial<LegacyDeveloperSecretEnvelope>).encryptedPayload === "string" &&
    typeof (value as Partial<LegacyDeveloperSecretEnvelope>).salt === "string" &&
    typeof (value as Partial<LegacyDeveloperSecretEnvelope>).tag === "string"
  );
}

function isSecureDeveloperSecretEnvelope(
  value: unknown,
): value is SecureDeveloperSecretEnvelope {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Partial<SecureDeveloperSecretEnvelope>).version === 2 &&
    (value as Partial<SecureDeveloperSecretEnvelope>).cipher ===
      "xchacha20poly1305-ietf" &&
    (value as Partial<SecureDeveloperSecretEnvelope>).keyDerivation === "argon2id13" &&
    typeof (value as Partial<SecureDeveloperSecretEnvelope>).purpose === "string" &&
    typeof (value as Partial<SecureDeveloperSecretEnvelope>).encryptedPayload === "string" &&
    typeof (value as Partial<SecureDeveloperSecretEnvelope>).nonce === "string" &&
    typeof (value as Partial<SecureDeveloperSecretEnvelope>).salt === "string" &&
    typeof (value as Partial<SecureDeveloperSecretEnvelope>).opsLimit === "number" &&
    typeof (value as Partial<SecureDeveloperSecretEnvelope>).memLimit === "number"
  );
}

export async function sealDeveloperSecretBlob(
  plaintext: string,
  masterPassword: string,
): Promise<string> {
  const sealed = await sealWithPassword(
    plaintext,
    masterPassword,
    "developer-secret-blob",
  );

  return JSON.stringify({
    version: 2,
    ...sealed,
  } satisfies SecureDeveloperSecretEnvelope);
}

export async function openDeveloperSecretBlob(
  ciphertext: string,
  masterPassword: string,
): Promise<string> {
  if (!ciphertext || !masterPassword) {
    return "";
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(ciphertext) as unknown;
  } catch {
    return "";
  }

  if (isSecureDeveloperSecretEnvelope(parsed)) {
    return openWithPassword(parsed, masterPassword);
  }

  if (!isLegacyDeveloperSecretEnvelope(parsed)) {
    return "";
  }

  try {
    const plaintext = textDecoder.decode(
      xorWithKeystream(
        fromBase64(parsed.encryptedPayload),
        masterPassword,
        parsed.salt,
      ),
    );

    return hashToHex(`${plaintext}:${masterPassword}:${parsed.salt}`) ===
      parsed.tag
      ? plaintext
      : "";
  } catch {
    return "";
  }
}
