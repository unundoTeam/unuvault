import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVaultSyncService } from "../src/services/vault-service";

describe("createVaultSyncService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns updated_items for the authenticated profile when changed_items is empty", async () => {
    const listVaultItemsByIds = vi.fn().mockResolvedValue([]);
    const upsertVaultItems = vi.fn().mockResolvedValue(undefined);
    const listVaultItemsByProfileId = vi.fn().mockResolvedValue([
      {
        id: "item-1",
        user_profile_id: "profile-1",
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
    ]);

    const service = createVaultSyncService({
      getUserByToken: async () => ({
        id: "auth-user-1",
        email: "user@example.com",
      }),
      getUserProfileByAuthUserId: async () => ({
        id: "profile-1",
        auth_user_id: "auth-user-1",
        email: "user@example.com",
        locale: "zh-CN",
      }),
      listVaultItemsByIds,
      upsertVaultItems,
      listVaultItemsByProfileId,
    });

    const payload = await service.syncVaultFromToken("jwt-token", {
      changed_items: [],
    });

    expect(listVaultItemsByIds).not.toHaveBeenCalled();
    expect(upsertVaultItems).not.toHaveBeenCalled();
    expect(listVaultItemsByProfileId).toHaveBeenCalledWith("profile-1");
    expect(payload).toEqual({
      server_time: "2026-03-15T12:00:00.000Z",
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
          last_used_at: null,
          created_at: "2026-03-14T00:00:00.000Z",
          updated_at: "2026-03-15T00:00:00.000Z",
        },
      ],
      deleted_item_ids: [],
      conflicts: [],
    });
  });

  it("saves changed_items before reading the current vault", async () => {
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
    const listVaultItemsByIds = vi.fn().mockResolvedValue([]);
    const upsertVaultItems = vi.fn().mockResolvedValue(undefined);
    const listVaultItemsByProfileId = vi.fn().mockResolvedValue([
      {
        id: "item-1",
        user_profile_id: "profile-1",
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
    ]);

    const service = createVaultSyncService({
      getUserByToken: async () => ({
        id: "auth-user-1",
        email: "user@example.com",
      }),
      getUserProfileByAuthUserId: async () => ({
        id: "profile-1",
        auth_user_id: "auth-user-1",
        email: "user@example.com",
        locale: "zh-CN",
      }),
      listVaultItemsByIds,
      upsertVaultItems,
      listVaultItemsByProfileId,
    });

    const payload = await service.syncVaultFromToken("jwt-token", {
      changed_items: changedItems,
    });

    expect(listVaultItemsByIds).toHaveBeenCalledWith(["item-1"]);
    expect(upsertVaultItems).toHaveBeenCalledWith("profile-1", changedItems);
    expect(listVaultItemsByProfileId).toHaveBeenCalledWith("profile-1");
    expect(payload.updated_items).toEqual(changedItems);
  });

  it("rejects changed_items when an id belongs to another profile", async () => {
    const listVaultItemsByIds = vi.fn().mockResolvedValue([
      {
        id: "item-1",
        user_profile_id: "profile-foreign",
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
    ]);
    const upsertVaultItems = vi.fn().mockResolvedValue(undefined);
    const listVaultItemsByProfileId = vi.fn().mockResolvedValue([]);

    const service = createVaultSyncService({
      getUserByToken: async () => ({
        id: "auth-user-1",
        email: "user@example.com",
      }),
      getUserProfileByAuthUserId: async () => ({
        id: "profile-1",
        auth_user_id: "auth-user-1",
        email: "user@example.com",
        locale: "zh-CN",
      }),
      listVaultItemsByIds,
      upsertVaultItems,
      listVaultItemsByProfileId,
    });

    await expect(
      service.syncVaultFromToken("jwt-token", {
        changed_items: [
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
        ],
      }),
    ).rejects.toThrow("item id belongs to another profile");

    expect(upsertVaultItems).not.toHaveBeenCalled();
    expect(listVaultItemsByProfileId).not.toHaveBeenCalled();
  });

  it("returns an empty updated_items list when the profile has no vault items", async () => {
    const listVaultItemsByIds = vi.fn().mockResolvedValue([]);
    const upsertVaultItems = vi.fn().mockResolvedValue(undefined);
    const listVaultItemsByProfileId = vi.fn().mockResolvedValue([]);

    const service = createVaultSyncService({
      getUserByToken: async () => ({
        id: "auth-user-1",
        email: "user@example.com",
      }),
      getUserProfileByAuthUserId: async () => ({
        id: "profile-1",
        auth_user_id: "auth-user-1",
        email: "user@example.com",
        locale: "zh-CN",
      }),
      listVaultItemsByIds,
      upsertVaultItems,
      listVaultItemsByProfileId,
    });

    const payload = await service.syncVaultFromToken("jwt-token", {
      changed_items: [],
    });

    expect(payload).toEqual({
      server_time: "2026-03-15T12:00:00.000Z",
      updated_items: [],
      deleted_item_ids: [],
      conflicts: [],
    });
  });
});
