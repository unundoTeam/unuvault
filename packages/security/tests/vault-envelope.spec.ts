import { describe, expect, it } from "vitest";
import {
  openVaultPassword,
  sealVaultPassword,
} from "../src/vault-envelope";

describe("vault envelope helpers", () => {
  it("round-trips a plaintext password through a vault envelope", () => {
    const sealed = sealVaultPassword("hunter2");

    expect(sealed).not.toBe("");
    expect(sealed).not.toBe("hunter2");
    expect(openVaultPassword(sealed)).toBe("hunter2");
  });

  it("fails closed for invalid envelope input", () => {
    expect(openVaultPassword("not-an-envelope")).toBe("");
  });
});
