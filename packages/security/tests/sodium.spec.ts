import { describe, expect, it } from "vitest";
import {
  createPasswordHash,
  getSodium,
  openWithPassword,
  sealWithPassword,
  verifyPasswordHash,
} from "../src/sodium";

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
});
