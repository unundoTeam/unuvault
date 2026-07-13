import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPassphraseProtectedVaultPassword,
  openVaultPassword,
  openStoredVaultPassword,
  sealVaultPassword,
} from "../src/vault-envelope";
import {
  LEGACY_FIXTURE_MASTER_PASSWORD,
  LEGACY_FIXTURE_VAULT_ENVELOPE_V1,
  LEGACY_FIXTURE_VAULT_ENVELOPE_V2,
  LEGACY_FIXTURE_VAULT_PASSWORD_PLAINTEXT,
} from "../../../tests/fixtures/crypto-legacy-fixtures";
import {
  ARGON2ID_V3_POLICY,
  MAX_PASSWORD_ENVELOPE_JSON_CHARACTERS,
} from "../src/argon2-policy";

const jsonBound =
  ARGON2ID_V3_POLICY.maxCiphertextBase64URLCharacters + 2_048;
const legacyXorPayloadBound = 4 * Math.ceil(ARGON2ID_V3_POLICY.maxPlaintextBytes / 3);
const legacyXorPayloadAtByteBound =
  "A".repeat(legacyXorPayloadBound - 4) + "AA==";

describe("vault envelope helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects oversized envelope JSON before parsing", async () => {
    const parse = vi.spyOn(JSON, "parse").mockImplementation(() => {
      throw new Error("unexpected JSON.parse call");
    });
    const oversized = "A".repeat(jsonBound + 1);

    await expect(openVaultPassword(oversized, "correct horse")).resolves.toBe("");
    expect(isPassphraseProtectedVaultPassword(oversized)).toBe(false);
    expect(parse).not.toHaveBeenCalled();
  });

  it("parses envelope JSON at the size limit", async () => {
    const parse = vi.spyOn(JSON, "parse").mockImplementation(() => {
      throw new Error("unexpected JSON.parse call");
    });

    await expect(
      openVaultPassword("A".repeat(jsonBound), "correct horse"),
    ).resolves.toBe("");
    expect(parse).toHaveBeenCalledOnce();
  });

  it("round-trips a plaintext password through a secure envelope", async () => {
    const sealed = await sealVaultPassword("hunter2", "correct horse");

    expect(sealed).not.toBe("");
    expect(sealed).not.toBe("hunter2");
    await expect(openVaultPassword(sealed, "correct horse")).resolves.toBe("hunter2");
  });

  it("writes secure version 3 envelopes", async () => {
    const sealed = await sealVaultPassword("hunter2", "correct horse");

    expect(JSON.parse(sealed)).toMatchObject({
      version: 3,
      cipher: "xchacha20poly1305-ietf",
      keyDerivation: "argon2id13",
      purpose: "vault-password",
    });
  });

  it("fails closed when the unlock passphrase is wrong", async () => {
    const sealed = await sealVaultPassword("hunter2", "correct horse");

    await expect(openVaultPassword(sealed, "wrong battery")).resolves.toBe("");
  });

  it("rejects sealing new passwords without a non-empty passphrase", async () => {
    const sealWithoutPassphrase = sealVaultPassword as unknown as (
      password: string,
      passphrase?: string,
    ) => Promise<string>;

    await expect(sealWithoutPassphrase("hunter2")).rejects.toThrow(/passphrase/i);
    await expect(sealVaultPassword("hunter2", "")).rejects.toThrow(/passphrase/i);
  });

  it("flags passphrase-protected envelope values", async () => {
    const sealed = await sealVaultPassword("hunter2", "correct horse");

    expect(isPassphraseProtectedVaultPassword(sealed)).toBe(true);
    expect(isPassphraseProtectedVaultPassword("hunter2")).toBe(false);
  });

  it("opens legacy plaintext password values through the storage helper", async () => {
    await expect(
      openStoredVaultPassword(
        LEGACY_FIXTURE_VAULT_PASSWORD_PLAINTEXT,
        LEGACY_FIXTURE_MASTER_PASSWORD,
      ),
    ).resolves.toBe("hunter2");
  });

  it("rejects oversized legacy plaintext before envelope parsing or fallback", async () => {
    const oversizedPlaintext = "A".repeat(
      MAX_PASSWORD_ENVELOPE_JSON_CHARACTERS + 1,
    );

    await expect(
      openStoredVaultPassword(oversizedPlaintext, LEGACY_FIXTURE_MASTER_PASSWORD),
    ).resolves.toBe("");
    await expect(
      openStoredVaultPassword("short legacy plaintext", LEGACY_FIXTURE_MASTER_PASSWORD),
    ).resolves.toBe("short legacy plaintext");
  });

  it("opens legacy version 1 envelope values through the storage helper", async () => {
    await expect(
      openStoredVaultPassword(
        LEGACY_FIXTURE_VAULT_ENVELOPE_V1,
        LEGACY_FIXTURE_MASTER_PASSWORD,
      ),
    ).resolves.toBe("hunter2");
  });

  it("opens legacy version 2 envelope values through the storage helper", async () => {
    await expect(
      openStoredVaultPassword(
        LEGACY_FIXTURE_VAULT_ENVELOPE_V2,
        LEGACY_FIXTURE_MASTER_PASSWORD,
      ),
    ).resolves.toBe("hunter2");
  });

  it("rejects an oversized legacy XOR payload before decoding it", async () => {
    const decode = vi.fn(() => {
      throw new Error("legacy payload must not be decoded");
    });
    vi.stubGlobal("atob", decode);
    const oversizedPayload = "A".repeat(legacyXorPayloadBound + 4);

    await expect(
      openVaultPassword(
        JSON.stringify({
          version: 2,
          cipher: "xor-stream-v1",
          encryptedPayload: oversizedPayload,
          keyDerivation: "unlock-passphrase-v1",
          unlockSalt: "AQIDBAUGBwgJCgsM",
          unlockTag: "00000000",
        }),
        LEGACY_FIXTURE_MASTER_PASSWORD,
      ),
    ).resolves.toBe("");
    expect(decode).not.toHaveBeenCalled();
  });

  it("allows a legacy XOR payload at the supported size boundary to be decoded", async () => {
    const decode = vi.fn(() => {
      throw new Error("boundary payload was decoded");
    });
    vi.stubGlobal("atob", decode);

    await expect(
      openVaultPassword(
        JSON.stringify({
          version: 2,
          cipher: "xor-stream-v1",
          encryptedPayload: legacyXorPayloadAtByteBound,
          keyDerivation: "unlock-passphrase-v1",
          unlockSalt: "AQIDBAUGBwgJCgsM",
          unlockTag: "00000000",
        }),
        LEGACY_FIXTURE_MASTER_PASSWORD,
      ),
    ).resolves.toBe("");
    expect(decode).toHaveBeenCalledOnce();
  });

  it("rejects a legacy XOR payload that exceeds the byte bound at the character limit", async () => {
    const decode = vi.fn(() => {
      throw new Error("legacy payload must not be decoded");
    });
    vi.stubGlobal("atob", decode);

    await expect(
      openVaultPassword(
        JSON.stringify({
          version: 2,
          cipher: "xor-stream-v1",
          encryptedPayload: "A".repeat(legacyXorPayloadBound),
          keyDerivation: "unlock-passphrase-v1",
          unlockSalt: "AQIDBAUGBwgJCgsM",
          unlockTag: "00000000",
        }),
        LEGACY_FIXTURE_MASTER_PASSWORD,
      ),
    ).resolves.toBe("");
    expect(decode).not.toHaveBeenCalled();
  });

  it("rejects an oversized legacy XOR salt before decoding its payload", async () => {
    const decode = vi.fn(() => {
      throw new Error("legacy payload must not be decoded");
    });
    vi.stubGlobal("atob", decode);

    await expect(
      openVaultPassword(
        JSON.stringify({
          version: 2,
          cipher: "xor-stream-v1",
          encryptedPayload: "AAAA",
          keyDerivation: "unlock-passphrase-v1",
          unlockSalt: "AQIDBAUGBwgJCgsMA",
          unlockTag: "00000000",
        }),
        LEGACY_FIXTURE_MASTER_PASSWORD,
      ),
    ).resolves.toBe("");
    expect(decode).not.toHaveBeenCalled();
  });

  it.each([
    ["a payload whose length is not a multiple of four", "AAA", "00000000"],
    ["a payload with invalid Base64 padding", "AA=A", "00000000"],
    ["a payload with non-canonical Base64 pad bits", "AB==", "00000000"],
    ["a tag outside exact lowercase eight-hex syntax", "AAAA", "ABCDEF12"],
  ])("rejects legacy XOR input with %s before decoding", async (_reason, encryptedPayload, unlockTag) => {
    const decode = vi.fn(() => {
      throw new Error("legacy payload must not be decoded");
    });
    vi.stubGlobal("atob", decode);

    await expect(
      openVaultPassword(
        JSON.stringify({
          version: 2,
          cipher: "xor-stream-v1",
          encryptedPayload,
          keyDerivation: "unlock-passphrase-v1",
          unlockSalt: "AQIDBAUGBwgJCgsM",
          unlockTag,
        }),
        LEGACY_FIXTURE_MASTER_PASSWORD,
      ),
    ).resolves.toBe("");
    expect(decode).not.toHaveBeenCalled();
  });

  it("fails closed for broken envelope-like storage values", async () => {
    await expect(openStoredVaultPassword('{"version":1', "correct horse")).resolves.toBe(
      "",
    );
  });
});
