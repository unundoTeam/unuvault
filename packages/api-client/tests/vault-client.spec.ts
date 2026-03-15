import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { syncVault } from "../src/vault";

describe("syncVault", () => {
  it("posts changed items and returns the sync payload", async () => {
    const changedItems = [
      {
        id: "item-1",
        item_type: "login",
        title: "GitHub",
        encrypted_payload: {
          ciphertext: "abc",
        },
        favorite: true,
        source: "manual",
        last_used_at: null,
        created_at: "2026-03-14T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
    ];
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        server_time: "2026-03-14T00:00:00.000Z",
        updated_items: [
          {
            id: "item-1",
            item_type: "login",
            title: "GitHub",
            encrypted_payload: {
              ciphertext: "abc",
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
      }),
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
      ciphertext: "abc",
    });
    expectTypeOf<Parameters<typeof syncVault>[2]>().toEqualTypeOf<{
      changed_items: Array<{
        id: string;
        item_type: string;
        title: string;
        encrypted_payload: Record<string, unknown>;
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
        encrypted_payload: Record<string, unknown>;
        favorite: boolean;
        source: string;
        last_used_at: string | null;
        created_at: string;
        updated_at: string;
      }>
    >();
    expect(response.conflicts).toEqual([]);
  });
});
