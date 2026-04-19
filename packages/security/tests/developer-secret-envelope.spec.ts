import { afterEach, describe, expect, it, vi } from "vitest";
import {
  openDeveloperSecretBlob,
  sealDeveloperSecretBlob,
} from "../src/developer-secret-envelope";
import {
  LEGACY_FIXTURE_DEVELOPER_SECRET_BLOB_V1,
  LEGACY_FIXTURE_DEV_SECRET_DOTENV,
  LEGACY_FIXTURE_MASTER_PASSWORD,
} from "../../../tests/fixtures/crypto-legacy-fixtures";

describe("developer secret envelope helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips a dotenv blob with the master password", async () => {
    const sealed = await sealDeveloperSecretBlob(
      "SUPABASE_URL=https://example.supabase.co\nSUPABASE_ANON_KEY=anon-key\n",
      "correct horse",
    );

    expect(sealed).not.toBe("");
    expect(sealed).not.toContain("SUPABASE_URL=https://example.supabase.co");
    await expect(openDeveloperSecretBlob(sealed, "correct horse")).resolves.toBe(
      "SUPABASE_URL=https://example.supabase.co\nSUPABASE_ANON_KEY=anon-key\n",
    );
  });

  it("writes secure version 2 envelopes", async () => {
    const sealed = await sealDeveloperSecretBlob(
      "SUPABASE_URL=https://example.supabase.co\n",
      "correct horse",
    );

    expect(JSON.parse(sealed)).toMatchObject({
      version: 2,
      cipher: "xchacha20poly1305-ietf",
      keyDerivation: "argon2id13",
      purpose: "developer-secret-blob",
    });
  });

  it("opens legacy version 1 envelopes", async () => {
    await expect(
      openDeveloperSecretBlob(
        LEGACY_FIXTURE_DEVELOPER_SECRET_BLOB_V1,
        LEGACY_FIXTURE_MASTER_PASSWORD,
      ),
    ).resolves.toBe(LEGACY_FIXTURE_DEV_SECRET_DOTENV);
  });

  it("fails closed when the master password is wrong", async () => {
    const sealed = await sealDeveloperSecretBlob(
      "SUPABASE_URL=https://example.supabase.co\n",
      "correct horse",
    );

    await expect(openDeveloperSecretBlob(sealed, "wrong battery")).resolves.toBe("");
  });

  it("fails closed for malformed payloads", async () => {
    await expect(openDeveloperSecretBlob("not-json", "correct horse")).resolves.toBe("");
    await expect(
      openDeveloperSecretBlob(
        JSON.stringify({
          version: 2,
          cipher: "xchacha20poly1305-ietf",
        }),
        "correct horse",
      ),
    ).resolves.toBe("");
  });
});
