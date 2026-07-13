import { describe, expect, it } from "vitest";
import {
  ARGON2ID_V3_POLICY,
  isPinnedArgon2idVerifierSyntax,
  isSupportedArgon2idVerifier,
  isSupportedPasswordDerivedCiphertext,
  runtimeMatchesArgon2Policy,
} from "../src/argon2-policy";
import { getSodium } from "../src/sodium";

const validEnvelope = {
  cipher: "xchacha20poly1305-ietf" as const,
  purpose: "vault-password",
  encryptedPayload: "AAAAAAAAAAAAAAAAAAAAAA",
  nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  salt: "AAAAAAAAAAAAAAAAAAAAAA",
  opsLimit: 2,
  memLimit: 67_108_864,
  keyDerivation: "argon2id13" as const,
};

const validVerifier =
  "$argon2id$v=19$m=65536,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("argon2 parameter policy", () => {
  it("matches the pinned libsodium interactive runtime", async () => {
    const ready = await getSodium();
    expect(runtimeMatchesArgon2Policy(ready)).toBe(true);
    expect(ARGON2ID_V3_POLICY).toMatchObject({
      opsLimit: 2,
      memLimit: 67_108_864,
      version: 19,
      memoryKiB: 65_536,
      iterations: 2,
      parallelism: 1,
      saltBytes: 16,
      nonceBytes: 24,
    });
  });

  it("rejects default-algorithm and PHC-prefix runtime drift", async () => {
    const ready = await getSodium();
    expect(runtimeMatchesArgon2Policy({
      ...ready,
      crypto_pwhash_STRPREFIX: "$argon2i$",
    } as typeof ready)).toBe(false);
    expect(runtimeMatchesArgon2Policy({
      ...ready,
      crypto_pwhash_ALG_DEFAULT: ready.crypto_pwhash_ALG_ARGON2I13,
    } as typeof ready)).toBe(false);
  });

  it.each([NaN, Infinity, 1.5, -1, 1, 3, Number.MAX_SAFE_INTEGER + 1])(
    "rejects hostile opsLimit %s",
    async (opsLimit) => {
      const ready = await getSodium();
      expect(
        isSupportedPasswordDerivedCiphertext({ ...validEnvelope, opsLimit }, ready),
      ).toBe(false);
    },
  );

  it.each([NaN, Infinity, 1.5, -1, 67_108_863, 67_108_865])(
    "rejects hostile memLimit %s",
    async (memLimit) => {
      const ready = await getSodium();
      expect(
        isSupportedPasswordDerivedCiphertext({ ...validEnvelope, memLimit }, ready),
      ).toBe(false);
    },
  );

  it("rejects non-canonical or wrong-length salt and nonce fields", async () => {
    const ready = await getSodium();

    for (const candidate of [
      { ...validEnvelope, salt: `${validEnvelope.salt}=` },
      { ...validEnvelope, salt: "AAAAAAAAAAAAAAAAAAAA" },
      { ...validEnvelope, salt: "AAAAAAAAAAAAAAAAAAAAAAA" },
      { ...validEnvelope, nonce: `${validEnvelope.nonce}=` },
      { ...validEnvelope, nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
      { ...validEnvelope, nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
      { ...validEnvelope, salt: "AAAAAAAAAAAAAAAAAAAAAB" },
    ]) {
      expect(isSupportedPasswordDerivedCiphertext(candidate, ready)).toBe(false);
    }
  });

  it("rejects ciphertext below the AEAD tag or above the one MiB policy", async () => {
    const ready = await getSodium();
    const oversized = "A".repeat(ARGON2ID_V3_POLICY.maxCiphertextBase64URLCharacters + 1);

    expect(
      isSupportedPasswordDerivedCiphertext(
        { ...validEnvelope, encryptedPayload: "AA" },
        ready,
      ),
    ).toBe(false);
    expect(
      isSupportedPasswordDerivedCiphertext(
        { ...validEnvelope, encryptedPayload: oversized },
        ready,
      ),
    ).toBe(false);
  });

  it("accepts only the canonical supported Argon2id verifier tuple", async () => {
    const ready = await getSodium();
    const valid = validVerifier;

    expect(isSupportedArgon2idVerifier(valid, ready)).toBe(true);
    expect(isPinnedArgon2idVerifierSyntax(valid)).toBe(true);
    for (const malicious of [
      valid.replace("$argon2id$", "$argon2i$"),
      valid.replace("v=19", "v=16"),
      valid.replace("v=19", "v=019"),
      valid.replace("m=65536", "m=65535"),
      valid.replace("m=65536", "m=065536"),
      valid.replace("m=65536", "m=1048576"),
      valid.replace("t=2", "t=3"),
      valid.replace("p=1", "p=2"),
      valid.replace(
        "$AAAAAAAAAAAAAAAAAAAAAA$",
        "$AAAAAAAAAAAAAAAAAAAAAB$",
      ),
      `${valid.slice(0, -1)}B`,
      `${valid}A`.repeat(2),
    ]) {
      expect(isSupportedArgon2idVerifier(malicious, ready)).toBe(false);
      expect(isPinnedArgon2idVerifierSyntax(malicious)).toBe(false);
    }
  });
});
