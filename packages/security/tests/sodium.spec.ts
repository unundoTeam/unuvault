import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPasswordHash,
  getSodium,
  openWithPassword,
  sealWithPassword,
  verifyPasswordHash,
} from "../src/sodium";

const fixedStructurallyValidCiphertext = {
  cipher: "xchacha20poly1305-ietf" as const,
  purpose: "vault-password",
  encryptedPayload: "AAAAAAAAAAAAAAAAAAAAAA",
  nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  salt: "AAAAAAAAAAAAAAAAAAAAAA",
  opsLimit: 2,
  memLimit: 67_108_864,
  keyDerivation: "argon2id13" as const,
};
const fixedStructurallyValidVerifier =
  "$argon2id$v=19$m=65536,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

afterEach(() => vi.restoreAllMocks());

describe("libsodium substrate", () => {
  it("initializes libsodium and exposes argon2id + xchacha20", async () => {
    const sodium = await getSodium();

    expect(sodium.crypto_pwhash_ALG_ARGON2ID13).toBeTypeOf("number");
    expect(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES).toBeGreaterThan(0);
  });

  it("round-trips payloads with argon2id-derived xchacha20poly1305", async () => {
    const sealed = await sealWithPassword(
      "hunter2",
      "correct horse battery staple",
      "vault-password",
    );

    expect(sealed.encryptedPayload).not.toContain("hunter2");
    expect(
      await openWithPassword(sealed, "correct horse battery staple"),
    ).toBe("hunter2");
    expect(await openWithPassword(sealed, "wrong battery staple")).toBe("");
  });

  it("hashes and verifies passwords with libsodium pwhash strings", async () => {
    const passwordHash = await createPasswordHash("correct horse battery staple");

    expect(passwordHash.startsWith("$argon2")).toBe(true);
    expect(
      await verifyPasswordHash(passwordHash, "correct horse battery staple"),
    ).toBe(true);
    expect(await verifyPasswordHash(passwordHash, "wrong battery staple")).toBe(false);
  });

  it("rejects hostile envelope parameters before crypto_pwhash", async () => {
    const ready = await getSodium();
    const pwhash = vi.spyOn(ready, "crypto_pwhash").mockImplementation(() => {
      throw new Error("unexpected KDF call");
    });

    await expect(
      openWithPassword(
        { ...fixedStructurallyValidCiphertext, memLimit: 1_073_741_824 },
        "correct horse",
      ),
    ).resolves.toBe("");
    expect(pwhash).not.toHaveBeenCalled();
  });

  it("rejects hostile verifier parameters before crypto_pwhash_str_verify", async () => {
    const ready = await getSodium();
    const verify = vi.spyOn(ready, "crypto_pwhash_str_verify").mockImplementation(() => {
      throw new Error("unexpected verifier call");
    });

    await expect(
      verifyPasswordHash(
        fixedStructurallyValidVerifier.replace("m=65536", "m=1048576"),
        "correct horse",
      ),
    ).resolves.toBe(false);
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects oversized plaintext before randomness or crypto_pwhash", async () => {
    const ready = await getSodium();
    const random = vi.spyOn(ready, "randombytes_buf").mockImplementation(() => {
      throw new Error("unexpected randomness call");
    });
    const pwhash = vi.spyOn(ready, "crypto_pwhash").mockImplementation(() => {
      throw new Error("unexpected KDF call");
    });

    await expect(
      sealWithPassword("A".repeat(1_048_577), "correct horse", "vault-password"),
    ).rejects.toThrow("exceeds the supported policy");
    expect(random).not.toHaveBeenCalled();
    expect(pwhash).not.toHaveBeenCalled();
  });
});
