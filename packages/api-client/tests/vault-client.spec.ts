import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  normalizeVaultLoginPayload,
  normalizeVaultWebsiteUrl,
  parseVaultWebsiteMetadata,
} from "../src/login-payload";
import type { VaultSyncResponse } from "../src/vault";
import { syncVault } from "../src/vault";

describe("syncVault", () => {
  it("posts changed items and returns the sync payload", async () => {
    const changedItems: Parameters<typeof syncVault>[2]["changed_items"] = [
      {
        id: "item-1",
        item_type: "login",
        title: "GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice",
            password_ciphertext: "",
            notes: "Primary account",
            website_url: "https://github.com/",
          },
        favorite: true,
        source: "manual",
        last_used_at: null,
        created_at: "2026-03-14T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
    ];
    const syncResponse: VaultSyncResponse = {
        server_time: "2026-03-14T00:00:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "alice",
              password_ciphertext: "",
              notes: "Primary account",
              website_url: "https://github.com/",
            },
            favorite: true,
            source: "manual",
            last_used_at: "2026-03-15T00:00:00.000Z",
            created_at: "2026-03-14T00:00:00.000Z",
            updated_at: "2026-03-15T00:00:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      };
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => syncResponse,
    });

    const response = await syncVault(fetcher, "jwt-token", {
      changed_items: changedItems,
      deleted_item_ids: ["item-2"],
    });

    expect(fetcher).toHaveBeenCalledWith("/vault/sync", {
      method: "POST",
      headers: {
        authorization: "Bearer jwt-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        changed_items: changedItems,
        deleted_item_ids: ["item-2"],
      }),
    });
    expect(response.updated_items[0]?.title).toBe("GitHub");
    expect(response.updated_items[0]?.encrypted_payload).toEqual({
      schema_version: 1,
      username: "alice",
      password_ciphertext: "",
      notes: "Primary account",
      website_url: "https://github.com/",
    });
    expectTypeOf<Parameters<typeof syncVault>[2]>().toEqualTypeOf<{
      changed_items: Array<{
        id: string;
        item_type: string;
        title: string;
        encrypted_payload: {
          schema_version: 1;
          username: string;
          password_ciphertext: string;
          notes: string;
          website_url: string;
        };
        favorite: boolean;
        source: string;
        last_used_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      deleted_item_ids: string[];
    }>();
    expectTypeOf(response.updated_items).toEqualTypeOf<
      Array<{
        id: string;
        item_type: string;
        title: string;
        encrypted_payload: {
          schema_version: 1;
          username: string;
          password_ciphertext: string;
          notes: string;
          website_url: string;
        };
        favorite: boolean;
        source: string;
        last_used_at: string | null;
        created_at: string;
        updated_at: string;
      }>
    >();
    expect(response.conflicts).toEqual([]);
  });

  it("round-trips a login payload with username and notes", async () => {
    const syncResponse: VaultSyncResponse = {
        server_time: "2026-03-16T00:00:00.000Z",
        updated_items: [
          {
            id: "item-2",
            item_type: "login",
            title: "Personal GitHub",
            encrypted_payload: {
              schema_version: 1,
              username: "alice",
              password_ciphertext: "",
              notes: "MFA enabled",
              website_url: "https://github.com/settings/security",
            },
            favorite: false,
            source: "manual",
            last_used_at: null,
            created_at: "2026-03-16T00:00:00.000Z",
            updated_at: "2026-03-16T00:00:00.000Z",
          },
        ],
        deleted_item_ids: [],
        conflicts: [],
      };
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => syncResponse,
    });

    const response = await syncVault(fetcher, "jwt-token", {
      changed_items: [
        {
          id: "item-2",
          item_type: "login",
          title: "Personal GitHub",
          encrypted_payload: {
            schema_version: 1,
            username: "alice",
            password_ciphertext: "",
            notes: "MFA enabled",
            website_url: "https://github.com/settings/security",
          },
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-16T00:00:00.000Z",
          updated_at: "2026-03-16T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
    });

    expect(response.updated_items[0]?.encrypted_payload).toEqual({
      schema_version: 1,
      username: "alice",
      password_ciphertext: "",
      notes: "MFA enabled",
      website_url: "https://github.com/settings/security",
    });
    expectTypeOf<Parameters<typeof syncVault>[2]>().toEqualTypeOf<{
      changed_items: Array<{
        id: string;
        item_type: string;
        title: string;
        encrypted_payload: {
          schema_version: 1;
          username: string;
          password_ciphertext: string;
          notes: string;
          website_url: string;
        };
        favorite: boolean;
        source: string;
        last_used_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      deleted_item_ids: string[];
    }>();
    expectTypeOf(response.updated_items).toEqualTypeOf<
      Array<{
        id: string;
        item_type: string;
        title: string;
        encrypted_payload: {
          schema_version: 1;
          username: string;
          password_ciphertext: string;
          notes: string;
          website_url: string;
        };
        favorite: boolean;
        source: string;
        last_used_at: string | null;
        created_at: string;
        updated_at: string;
      }>
    >();
  });
});

describe("login payload helpers", () => {
  it("normalizes missing website_url to an empty string", () => {
    expect(
      normalizeVaultLoginPayload({
        schema_version: 1,
        username: "alice",
        password_ciphertext: "",
        notes: "Primary account",
      }),
    ).toEqual({
      schema_version: 1,
      username: "alice",
      password_ciphertext: "",
      notes: "Primary account",
      website_url: "",
    });
  });

  it("normalizes website input by defaulting missing schemes to https", () => {
    expect(normalizeVaultWebsiteUrl("github.com")).toBe("https://github.com/");
  });

  it("derives origin and hostname from a normalized website URL", () => {
    expect(
      parseVaultWebsiteMetadata("https://github.com/login?utm_source=popup"),
    ).toEqual({
      websiteUrl: "https://github.com/login?utm_source=popup",
      websiteOrigin: "https://github.com",
      websiteHostname: "github.com",
    });
  });
});
