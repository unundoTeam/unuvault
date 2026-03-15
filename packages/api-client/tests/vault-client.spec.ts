import { describe, expect, it, vi } from "vitest";
import { syncVault } from "../src/vault";

describe("syncVault", () => {
  it("posts changed items and returns the sync payload", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        server_time: "2026-03-14T00:00:00.000Z",
        updated_items: [],
        deleted_item_ids: [],
        conflicts: [],
      }),
    });

    const response = await syncVault(fetcher, "jwt-token", {
      changed_items: [],
    });

    expect(fetcher).toHaveBeenCalledWith("/vault/sync", {
      method: "POST",
      headers: {
        authorization: "Bearer jwt-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ changed_items: [] }),
    });
    expect(response.updated_items).toEqual([]);
    expect(response.conflicts).toEqual([]);
  });
});
