import { describe, expect, it } from "vitest";
import { analyzeBrowserImport } from "../../../packages/domain/src/browser-import";
import { openStoredVaultPassword } from "../../../packages/security/src/vault-envelope";
import {
  buildEncryptedImportPlan,
  EncryptedImportPlanError,
} from "../src/lib/import/encrypted-import-plan";

const nonCanonicalFakeV3Ciphertext = JSON.stringify({
  version: 3,
  cipher: "xchacha20poly1305-ietf",
  purpose: "vault-password",
  encryptedPayload: "synthetic-ciphertext",
  nonce: "synthetic-nonce",
  salt: "synthetic-salt",
  opsLimit: 2,
  memLimit: 67_108_864,
  keyDerivation: "argon2id13",
});

const canonicalFakeV3Ciphertext = JSON.stringify({
  version: 3,
  cipher: "xchacha20poly1305-ietf",
  purpose: "vault-password",
  encryptedPayload: "AAAAAAAAAAAAAAAAAAAAAA",
  nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  salt: "AAAAAAAAAAAAAAAAAAAAAA",
  opsLimit: 2,
  memLimit: 67_108_864,
  keyDerivation: "argon2id13",
});

describe("buildEncryptedImportPlan", () => {
  it("maps an accepted Chrome entry to an encrypted VaultSyncItem", async () => {
    const analysis = analyzeBrowserImport({
      source: "chrome",
      csv: "url,username,password\nhttps://github.com/login,alice,plain-secret",
    });

    const plan = await buildEncryptedImportPlan({
      analysis,
      passphrase: "vault-passphrase",
      idFactory: () => "imported-item-1",
      now: () => new Date("2026-07-11T00:00:00.000Z"),
      sealPassword: async (password, passphrase) => {
        expect({ password, passphrase }).toEqual({
          password: "plain-secret",
          passphrase: "vault-passphrase",
        });
        return canonicalFakeV3Ciphertext;
      },
    });

    expect(plan).toEqual({
      items: [
        {
          id: "imported-item-1",
          item_type: "login",
          title: "github.com",
          encrypted_payload: {
            schema_version: 1,
            username: "alice",
            password_ciphertext: canonicalFakeV3Ciphertext,
            notes: "",
            website_url: "https://github.com",
          },
          favorite: false,
          source: "browser_import_chrome",
          last_used_at: null,
          created_at: "2026-07-11T00:00:00.000Z",
          updated_at: "2026-07-11T00:00:00.000Z",
        },
      ],
      report: analysis.report,
    });
    expect(JSON.stringify(plan)).not.toContain("plain-secret");
    expect(JSON.stringify(plan)).not.toContain("password\nhttps://github.com");
  });

  it("rejects an empty passphrase before sealing", async () => {
    const analysis = analyzeBrowserImport({
      source: "chrome",
      csv: "url,username,password\nhttps://example.com,alice,plain-secret",
    });

    await expect(
      buildEncryptedImportPlan({
        analysis,
        passphrase: "",
        idFactory: () => "imported-item-1",
        now: () => new Date("2026-07-11T00:00:00.000Z"),
        sealPassword: async () => {
          throw new Error("sealer must not run");
        },
      }),
    ).rejects.toEqual(new EncryptedImportPlanError("empty_passphrase"));
  });

  it("rejects an invalid injected timestamp with a sanitized error", async () => {
    const analysis = analyzeBrowserImport({
      source: "edge",
      csv: "url,username,password\nhttps://example.com,alice,plain-secret",
    });

    await expect(
      buildEncryptedImportPlan({
        analysis,
        passphrase: "vault-passphrase",
        idFactory: () => "imported-item-1",
        now: () => new Date(Number.NaN),
        sealPassword: async () => canonicalFakeV3Ciphertext,
      }),
    ).rejects.toEqual(new EncryptedImportPlanError("invalid_timestamp"));
  });

  it.each([
    " ",
    "-starts-with-dash",
    "contains/path",
    "contains\nnewline",
    "a".repeat(201),
  ])("rejects an invalid generated item id before sealing", async (id) => {
    const analysis = analyzeBrowserImport({
      source: "chrome",
      csv: "url,username,password\nhttps://example.com,alice,plain-secret",
    });

    await expect(
      buildEncryptedImportPlan({
        analysis,
        passphrase: "vault-passphrase",
        idFactory: () => id,
        now: () => new Date("2026-07-11T00:00:00.000Z"),
        sealPassword: async () => {
          throw new Error("sealer must not run");
        },
      }),
    ).rejects.toEqual(new EncryptedImportPlanError("invalid_id"));
  });

  it.each([null, undefined, 123, new String("boxed-id"), Symbol("item-id")])(
    "rejects a non-string generated item id with the stable error",
    async (id) => {
      const analysis = analyzeBrowserImport({
        source: "chrome",
        csv: "url,username,password\nhttps://example.com,alice,plain-secret",
      });

      await expect(
        buildEncryptedImportPlan({
          analysis,
          passphrase: "vault-passphrase",
          idFactory: () => id as unknown as string,
          now: () => new Date("2026-07-11T00:00:00.000Z"),
          sealPassword: async () => {
            throw new Error("sealer must not run");
          },
        }),
      ).rejects.toEqual(new EncryptedImportPlanError("invalid_id"));
    },
  );

  it("rejects duplicate generated ids within one plan", async () => {
    const analysis = analyzeBrowserImport({
      source: "chrome",
      csv: [
        "url,username,password",
        "https://one.example,alice,secret-one",
        "https://two.example,bob,secret-two",
      ].join("\n"),
    });

    await expect(
      buildEncryptedImportPlan({
        analysis,
        passphrase: "vault-passphrase",
        idFactory: () => "duplicate-id",
        now: () => new Date("2026-07-11T00:00:00.000Z"),
        sealPassword: async () => canonicalFakeV3Ciphertext,
      }),
    ).rejects.toEqual(new EncryptedImportPlanError("invalid_id"));
  });

  it.each([
    "plain-secret",
    JSON.stringify({
      version: 2,
      cipher: "xor-stream-v1",
      keyDerivation: "unlock-passphrase-v1",
      encryptedPayload: "legacy",
      unlockSalt: "salt",
      unlockTag: "tag",
    }),
    nonCanonicalFakeV3Ciphertext,
    JSON.stringify({
      ...JSON.parse(canonicalFakeV3Ciphertext),
      rawPassword: "plain-secret",
    }),
  ])("rejects a non-v3 sealer result", async (ciphertext) => {
    const analysis = analyzeBrowserImport({
      source: "edge",
      csv: "url,username,password\nhttps://example.com,alice,plain-secret",
    });

    await expect(
      buildEncryptedImportPlan({
        analysis,
        passphrase: "vault-passphrase",
        idFactory: () => "imported-item-1",
        now: () => new Date("2026-07-11T00:00:00.000Z"),
        sealPassword: async () => ciphertext,
      }),
    ).rejects.toEqual(new EncryptedImportPlanError("invalid_ciphertext"));
  });

  it("sanitizes sealing failures and returns no partial plan", async () => {
    const firstPassword = "first-plain-secret";
    const secondPassword = "second-plain-secret";
    const analysis = analyzeBrowserImport({
      source: "chrome",
      csv: [
        "url,username,password",
        `https://one.example,alice,${firstPassword}`,
        `https://two.example,bob,${secondPassword}`,
      ].join("\n"),
    });
    let sealCount = 0;

    try {
      await buildEncryptedImportPlan({
        analysis,
        passphrase: "vault-passphrase",
        idFactory: () => `imported-item-${sealCount + 1}`,
        now: () => new Date("2026-07-11T00:00:00.000Z"),
        sealPassword: async () => {
          sealCount += 1;
          if (sealCount === 2) {
            throw new Error(`failed to seal ${secondPassword}`);
          }
          return canonicalFakeV3Ciphertext;
        },
      });
      throw new Error("expected buildEncryptedImportPlan to fail");
    } catch (error) {
      expect(error).toEqual(new EncryptedImportPlanError("encryption_failed"));
      expect(error).not.toHaveProperty("items");
      expect(String(error)).not.toContain(firstPassword);
      expect(String(error)).not.toContain(secondPassword);
    }
  });

  it("sanitizes a synchronous sealer throw", async () => {
    const password = "sync-throw-secret";
    const analysis = analyzeBrowserImport({
      source: "edge",
      csv: `url,username,password\nhttps://example.com,alice,${password}`,
    });

    await expect(
      buildEncryptedImportPlan({
        analysis,
        passphrase: "vault-passphrase",
        idFactory: () => "imported-item-1",
        now: () => new Date("2026-07-11T00:00:00.000Z"),
        sealPassword: () => {
          throw new Error(`failed to seal ${password}`);
        },
      }),
    ).rejects.toEqual(new EncryptedImportPlanError("encryption_failed"));
  });

  it("uses the real v3 sealer by default and round-trips with the passphrase", async () => {
    const password = "real-round-trip-secret";
    const passphrase = "correct horse battery staple";
    const csv = [
      "name,url,username,password",
      `Edge Account,https://edge.example/login,alice,${password}`,
    ].join("\n");
    const analysis = analyzeBrowserImport({ source: "edge", csv });

    const plan = await buildEncryptedImportPlan({
      analysis,
      passphrase,
      idFactory: () => "edge-import-1",
      now: () => new Date("2026-07-11T01:02:03.000Z"),
    });
    const ciphertext = plan.items[0]?.encrypted_payload.password_ciphertext ?? "";

    expect(plan.items[0]?.source).toBe("browser_import_edge");
    expect(plan.items[0]?.encrypted_payload.notes).toBe("");
    expect(ciphertext).not.toBe(password);
    expect(JSON.parse(ciphertext)).toMatchObject({
      version: 3,
      cipher: "xchacha20poly1305-ietf",
      keyDerivation: "argon2id13",
      purpose: "vault-password",
    });
    await expect(openStoredVaultPassword(ciphertext, passphrase)).resolves.toBe(
      password,
    );
    expect(JSON.stringify(plan)).not.toContain(password);
    expect(JSON.stringify(plan)).not.toContain(csv);
  });
});
