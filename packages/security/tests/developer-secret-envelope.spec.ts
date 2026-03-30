import { afterEach, describe, expect, it, vi } from "vitest";
import {
  openDeveloperSecretBlob,
  sealDeveloperSecretBlob,
} from "../src/developer-secret-envelope";

describe("developer secret envelope helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips a dotenv blob with the master password", () => {
    const sealed = sealDeveloperSecretBlob(
      "SUPABASE_URL=https://example.supabase.co\nSUPABASE_ANON_KEY=anon-key\n",
      "correct horse",
    );

    expect(sealed).not.toBe("");
    expect(sealed).not.toContain("SUPABASE_URL=https://example.supabase.co");
    expect(openDeveloperSecretBlob(sealed, "correct horse")).toBe(
      "SUPABASE_URL=https://example.supabase.co\nSUPABASE_ANON_KEY=anon-key\n",
    );
  });

  it("fails closed when the master password is wrong", () => {
    const sealed = sealDeveloperSecretBlob(
      "SUPABASE_URL=https://example.supabase.co\n",
      "correct horse",
    );

    expect(openDeveloperSecretBlob(sealed, "wrong battery")).toBe("");
  });

  it("fails closed for malformed payloads", () => {
    expect(openDeveloperSecretBlob("not-json", "correct horse")).toBe("");
    expect(
      openDeveloperSecretBlob(
        JSON.stringify({
          version: 1,
          cipher: "xor-stream-v1",
        }),
        "correct horse",
      ),
    ).toBe("");
  });

  it("fails closed when secure random values are unavailable", () => {
    vi.stubGlobal("crypto", {});

    expect(() =>
      sealDeveloperSecretBlob(
        "SUPABASE_URL=https://example.supabase.co\n",
        "correct horse",
      ),
    ).toThrow(/secure random|crypto\.getRandomValues/i);
  });
});
