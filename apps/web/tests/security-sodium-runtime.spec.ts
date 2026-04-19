// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  createPasswordHash,
  openWithPassword,
  sealWithPassword,
  verifyPasswordHash,
} from "../../../packages/security/src/sodium";

describe("security sodium runtime smoke", () => {
  it("runs argon2id and xchacha20poly1305 in jsdom", async () => {
    const sealed = await sealWithPassword(
      "web-password",
      "correct horse battery staple",
      "web-smoke-test",
    );

    expect(
      await openWithPassword(sealed, "correct horse battery staple"),
    ).toBe("web-password");

    const passwordHash = await createPasswordHash("correct horse battery staple");
    expect(
      await verifyPasswordHash(passwordHash, "correct horse battery staple"),
    ).toBe(true);
  });
});
