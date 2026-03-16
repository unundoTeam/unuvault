import { describe, expect, it } from "vitest";
import {
  createMasterPasswordVerifier,
  verifyMasterPassword,
} from "../src/master-password-verifier";

describe("master password verifier helpers", () => {
  it("validates the same master password that created the verifier", () => {
    const verifier = createMasterPasswordVerifier("correct horse");

    expect(verifyMasterPassword(verifier, "correct horse")).toBe(true);
  });

  it("rejects an incorrect master password", () => {
    const verifier = createMasterPasswordVerifier("correct horse");

    expect(verifyMasterPassword(verifier, "wrong battery")).toBe(false);
  });

  it("fails closed for malformed verifier values", () => {
    expect(
      verifyMasterPassword(
        {
          version: 1,
          salt: "abc",
        },
        "correct horse",
      ),
    ).toBe(false);
  });
});
