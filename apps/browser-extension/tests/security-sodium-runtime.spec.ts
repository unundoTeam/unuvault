// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  createPasswordHash,
  openWithPassword,
  sealWithPassword,
  verifyPasswordHash,
} from "../../../packages/security/src/sodium";

describe("extension sodium runtime smoke", () => {
  it("runs argon2id and xchacha20poly1305 in browser-like runtime", async () => {
    const sealed = await sealWithPassword(
      "extension-password",
      "correct horse battery staple",
      "extension-smoke-test",
    );

    expect(
      await openWithPassword(sealed, "correct horse battery staple"),
    ).toBe("extension-password");

    const passwordHash = await createPasswordHash("correct horse battery staple");
    expect(
      await verifyPasswordHash(passwordHash, "correct horse battery staple"),
    ).toBe(true);
  });
});
