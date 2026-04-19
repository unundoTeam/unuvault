// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { createMasterPasswordVerifier } from "../../../packages/security/src/master-password-verifier";
import {
  clearMasterPasswordVerifier,
  readMasterPasswordVerifier,
  writeMasterPasswordVerifier,
} from "../src/components/vault/master-password-storage";

describe("master password storage helper", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a stored master password verifier", async () => {
    const verifier = await createMasterPasswordVerifier("correct horse");

    writeMasterPasswordVerifier(verifier);

    expect(readMasterPasswordVerifier()).toEqual(verifier);
  });

  it("returns null when no verifier is stored", () => {
    expect(readMasterPasswordVerifier()).toBeNull();
  });

  it("fails closed for malformed stored verifier values", () => {
    window.localStorage.setItem("unuvault.web.master-password-verifier", "{bad json");

    expect(readMasterPasswordVerifier()).toBeNull();
  });

  it("clears the stored verifier", async () => {
    writeMasterPasswordVerifier(
      await createMasterPasswordVerifier("correct horse"),
    );

    clearMasterPasswordVerifier();

    expect(readMasterPasswordVerifier()).toBeNull();
  });
});
