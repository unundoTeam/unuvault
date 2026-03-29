import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPassphraseProtectedVaultPassword,
  openVaultPassword,
  openStoredVaultPassword,
  sealLegacyVaultPassword,
  sealVaultPassword,
} from "../src/vault-envelope";

describe("vault envelope helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips a plaintext password through a passphrase-protected envelope", () => {
    const sealed = sealVaultPassword("hunter2", "correct horse");

    expect(sealed).not.toBe("");
    expect(sealed).not.toBe("hunter2");
    expect(openVaultPassword(sealed, "correct horse")).toBe("hunter2");
  });

  it("fails closed when the unlock passphrase is wrong", () => {
    const sealed = sealVaultPassword("hunter2", "correct horse");

    expect(openVaultPassword(sealed, "wrong battery")).toBe("");
  });

  it("rejects sealing new passwords without a non-empty passphrase", () => {
    const sealWithoutPassphrase = sealVaultPassword as unknown as (
      password: string,
      passphrase?: string,
    ) => string;

    expect(() => sealWithoutPassphrase("hunter2")).toThrow(/passphrase/i);
    expect(() => sealVaultPassword("hunter2", "")).toThrow(/passphrase/i);
  });

  it("fails closed when secure random values are unavailable", () => {
    vi.stubGlobal("crypto", {});

    expect(() => sealVaultPassword("hunter2", "correct horse")).toThrow(
      /secure random|crypto\.getRandomValues/i,
    );
  });

  it("flags passphrase-protected envelope values", () => {
    const sealed = sealVaultPassword("hunter2", "correct horse");

    expect(isPassphraseProtectedVaultPassword(sealed)).toBe(true);
    expect(isPassphraseProtectedVaultPassword("hunter2")).toBe(false);
  });

  it("opens legacy plaintext password values through the storage helper", () => {
    expect(openStoredVaultPassword("hunter2", "correct horse")).toBe("hunter2");
  });

  it("opens legacy version 1 envelope values through the storage helper", () => {
    expect(
      openStoredVaultPassword(
        sealLegacyVaultPassword("hunter2"),
        "correct horse",
      ),
    ).toBe("hunter2");
  });

  it("fails closed for broken envelope-like storage values", () => {
    expect(openStoredVaultPassword('{"version":1', "correct horse")).toBe("");
  });
});
