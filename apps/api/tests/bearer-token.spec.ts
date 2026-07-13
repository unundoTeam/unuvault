import { describe, expect, it } from "vitest";
import { readStrictBearerToken } from "../src/lib/bearer-token";

describe("readStrictBearerToken", () => {
  it("accepts one exact Bearer token", () => {
    expect(readStrictBearerToken("Bearer jwt-token")).toBe("jwt-token");
  });

  it.each([
    undefined,
    null,
    "",
    "Bearer",
    "Bearer ",
    "bearer jwt-token",
    "Bearer  jwt-token",
    " Bearer jwt-token",
    "Bearer jwt-token ",
    "Bearer jwt token",
    "Bearer jwt-token\n",
    "Bearer jwt\u0000token",
    "Bearer jwt\u0001token",
    "Bearer jwt\u001ftoken",
    "Bearer jwt\u007ftoken",
    "Bearer jwt\u0080token",
    ["Bearer jwt-token"],
  ])("rejects malformed authorization %j", (value) => {
    expect(readStrictBearerToken(value)).toBeNull();
  });
});
