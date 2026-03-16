export type MasterPasswordVerifier = {
  version: 1;
  salt: string;
  check: string;
};

const textEncoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";

  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });

  return btoa(binary);
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

function isMasterPasswordVerifier(
  value: unknown,
): value is MasterPasswordVerifier {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Partial<MasterPasswordVerifier>).version === 1 &&
    typeof (value as Partial<MasterPasswordVerifier>).salt === "string" &&
    typeof (value as Partial<MasterPasswordVerifier>).check === "string"
  );
}

export function createMasterPasswordVerifier(
  masterPassword: string,
): MasterPasswordVerifier {
  const salt = createRandomSalt();

  return {
    version: 1,
    salt,
    check: hashToHex(`${masterPassword}:${salt}`),
  };
}

export function verifyMasterPassword(
  verifier: unknown,
  masterPassword: string,
): boolean {
  if (!isMasterPasswordVerifier(verifier) || !masterPassword) {
    return false;
  }

  return hashToHex(`${masterPassword}:${verifier.salt}`) === verifier.check;
}
