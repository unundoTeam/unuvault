import { describe, expect, it } from "vitest";
import {
  createMasterPasswordVerifier,
  parseStoredMasterPasswordVerifier,
  verifyMasterPassword,
} from "../src/master-password-verifier";
import {
  LEGACY_FIXTURE_MASTER_PASSWORD,
  LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1,
  LEGACY_FIXTURE_WRONG_MASTER_PASSWORD,
} from "../../../tests/fixtures/crypto-legacy-fixtures";

describe("master password verifier helpers", () => {
  it("validates the same master password that created the secure verifier", async () => {
    const verifier = await createMasterPasswordVerifier("correct horse");

    await expect(verifyMasterPassword(verifier, "correct horse")).resolves.toEqual({
      success: true,
    });
  });

  it("rejects an incorrect master password for secure verifiers", async () => {
    const verifier = await createMasterPasswordVerifier("correct horse");

    await expect(verifyMasterPassword(verifier, "wrong battery")).resolves.toEqual({
      success: false,
    });
  });

  it("rejects a secure verifier with hostile Argon2 memory parameters", async () => {
    const verifier = await createMasterPasswordVerifier("correct horse");

    await expect(
      verifyMasterPassword(
        {
          ...verifier,
          passwordHash: verifier.passwordHash.replace("m=65536", "m=1048576"),
        },
        "correct horse",
      ),
    ).resolves.toEqual({ success: false });
  });

  it("rejects a 128-character secure verifier", async () => {
    await expect(
      verifyMasterPassword(
        {
          version: 2,
          algorithm: "argon2id13",
          passwordHash: "A".repeat(128),
        },
        "correct horse",
      ),
    ).resolves.toEqual({ success: false });
  });

  it("upgrades a legacy verifier after successful verification", async () => {
    const result = await verifyMasterPassword(
      LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1,
      LEGACY_FIXTURE_MASTER_PASSWORD,
    );

    expect(result.success).toBe(true);
    expect(result).toMatchObject({
      upgradedVerifier: {
        version: 2,
        algorithm: "argon2id13",
      },
    });
  });

  it("rejects an incorrect master password for legacy verifiers", async () => {
    await expect(
      verifyMasterPassword(
        LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1,
        LEGACY_FIXTURE_WRONG_MASTER_PASSWORD,
      ),
    ).resolves.toEqual({ success: false });
  });

  it("accepts only the canonical historical V1 verifier structure", () => {
    expect(
      parseStoredMasterPasswordVerifier(
        LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1,
      ),
    ).toEqual(LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1);

    expect(
      parseStoredMasterPasswordVerifier({
        ...LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1,
        salt: "AQIDBAUGBwgJCgsMA",
      }),
    ).toBeNull();
    expect(
      parseStoredMasterPasswordVerifier({
        ...LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1,
        salt: "AQIDBAUGBwgJCgs=",
      }),
    ).toBeNull();
    expect(
      parseStoredMasterPasswordVerifier({
        ...LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1,
        check: "716BA384",
      }),
    ).toBeNull();
    expect(
      parseStoredMasterPasswordVerifier({
        ...LEGACY_FIXTURE_MASTER_PASSWORD_VERIFIER_V1,
        check: "716ba3840",
      }),
    ).toBeNull();
  });

  it("fails closed for malformed verifier values", async () => {
    await expect(
      verifyMasterPassword(
        {
          version: 1,
          salt: "abc",
        },
        "correct horse",
      ),
    ).resolves.toEqual({ success: false });
  });
});
