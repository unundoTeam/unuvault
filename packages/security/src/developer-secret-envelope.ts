type DeveloperSecretEnvelope = {
  version: 1;
  cipher: "xor-stream-v1";
  encryptedPayload: string;
  keyDerivation: "master-password-v1";
  salt: string;
  tag: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

function createRandomSalt(): string {
  if (
    typeof crypto === "undefined" ||
    typeof crypto.getRandomValues !== "function"
  ) {
    throw new Error(
      "Secure random values are unavailable. Refusing to seal developer secrets without crypto.getRandomValues.",
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

function isDeveloperSecretEnvelope(value: unknown): value is DeveloperSecretEnvelope {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Partial<DeveloperSecretEnvelope>).version === 1 &&
    (value as Partial<DeveloperSecretEnvelope>).cipher === "xor-stream-v1" &&
    (value as Partial<DeveloperSecretEnvelope>).keyDerivation ===
      "master-password-v1" &&
    typeof (value as Partial<DeveloperSecretEnvelope>).encryptedPayload === "string" &&
    typeof (value as Partial<DeveloperSecretEnvelope>).salt === "string" &&
    typeof (value as Partial<DeveloperSecretEnvelope>).tag === "string"
  );
}

export function sealDeveloperSecretBlob(
  plaintext: string,
  masterPassword: string,
): string {
  const salt = createRandomSalt();
  const encryptedPayload = toBase64(
    xorWithKeystream(textEncoder.encode(plaintext), masterPassword, salt),
  );

  return JSON.stringify({
    version: 1,
    cipher: "xor-stream-v1",
    encryptedPayload,
    keyDerivation: "master-password-v1",
    salt,
    tag: hashToHex(`${plaintext}:${masterPassword}:${salt}`),
  } satisfies DeveloperSecretEnvelope);
}

export function openDeveloperSecretBlob(
  ciphertext: string,
  masterPassword: string,
): string {
  if (!ciphertext || !masterPassword) {
    return "";
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(ciphertext) as unknown;
  } catch {
    return "";
  }

  if (!isDeveloperSecretEnvelope(parsed)) {
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
