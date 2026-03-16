import { describe, expect, it, vi } from "vitest";
import { createSupabaseAuthBootstrapDependencies } from "../src/lib/supabase";
import { loginPayload } from "./login-payload-fixture";

describe("createSupabaseAuthBootstrapDependencies", () => {
  it("maps auth.getUser into the service dependency contract", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          email: "user@example.com",
        },
      },
      error: null,
    });

    const deps = createSupabaseAuthBootstrapDependencies({
      auth: { getUser },
      from: vi.fn(),
    } as never);

    const user = await deps.getUserByToken("jwt-token");

    expect(getUser).toHaveBeenCalledWith("jwt-token");
    expect(user).toEqual({
      id: "auth-user-1",
      email: "user@example.com",
    });
  });

  it("normalizes missing provider email to null", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "auth-user-2",
          email: undefined,
        },
      },
      error: null,
    });

    const deps = createSupabaseAuthBootstrapDependencies({
      auth: { getUser },
      from: vi.fn(),
    } as never);

    const user = await deps.getUserByToken("jwt-token");

    expect(user).toEqual({
      id: "auth-user-2",
      email: null,
    });
  });

  it("upserts users_profile on auth_user_id and returns the profile shape", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "profile-1",
        email: "user@example.com",
        locale: "zh-CN",
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ upsert });

    const deps = createSupabaseAuthBootstrapDependencies({
      auth: { getUser: vi.fn() },
      from,
    } as never);

    const profile = await deps.upsertUserProfile({
      auth_user_id: "auth-user-1",
      email: "user@example.com",
      locale: "zh-CN",
    });

    expect(from).toHaveBeenCalledWith("users_profile");
    expect(upsert).toHaveBeenCalledWith(
      {
        auth_user_id: "auth-user-1",
        email: "user@example.com",
        locale: "zh-CN",
      },
      {
        onConflict: "auth_user_id",
      },
    );
    expect(profile).toEqual({
      id: "profile-1",
      email: "user@example.com",
      locale: "zh-CN",
    });
  });

  it("finds users_profile by authenticated auth_user_id", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "profile-1",
        auth_user_id: "auth-user-1",
        email: "user@example.com",
        locale: "zh-CN",
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const deps = createSupabaseAuthBootstrapDependencies({
      auth: { getUser: vi.fn() },
      from,
    } as never);

    const profile = await deps.getUserProfileByAuthUserId("auth-user-1");

    expect(from).toHaveBeenCalledWith("users_profile");
    expect(select).toHaveBeenCalledWith("id, auth_user_id, email, locale");
    expect(eq).toHaveBeenCalledWith("auth_user_id", "auth-user-1");
    expect(profile).toEqual({
      id: "profile-1",
      auth_user_id: "auth-user-1",
      email: "user@example.com",
      locale: "zh-CN",
    });
  });

  it("lists vault_items for a user profile", async () => {
    const is = vi.fn().mockResolvedValue({
      data: [
        {
          id: "item-1",
          user_profile_id: "profile-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: loginPayload(),
          favorite: false,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-14T00:00:00.000Z",
          updated_at: "2026-03-15T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ is });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const deps = createSupabaseAuthBootstrapDependencies({
      auth: { getUser: vi.fn() },
      from,
    } as never);

    const items = await deps.listVaultItemsByProfileId("profile-1");

    expect(from).toHaveBeenCalledWith("vault_items");
    expect(select).toHaveBeenCalledWith(
      "id, user_profile_id, item_type, title, encrypted_payload, favorite, source, last_used_at, created_at, updated_at",
    );
    expect(eq).toHaveBeenCalledWith("user_profile_id", "profile-1");
    expect(is).toHaveBeenCalledWith("deleted_at", null);
    expect(items).toEqual([
      {
        id: "item-1",
        user_profile_id: "profile-1",
        item_type: "login",
        title: "GitHub",
        encrypted_payload: loginPayload(),
        favorite: false,
        source: "manual",
        last_used_at: null,
        created_at: "2026-03-14T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
    ]);
  });

  it("lists deleted vault item ids for a user profile", async () => {
    const not = vi.fn().mockResolvedValue({
      data: [{ id: "item-2" }],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ not });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const deps = createSupabaseAuthBootstrapDependencies({
      auth: { getUser: vi.fn() },
      from,
    } as never);

    const ids = await deps.listDeletedVaultItemIdsByProfileId("profile-1");

    expect(from).toHaveBeenCalledWith("vault_items");
    expect(select).toHaveBeenCalledWith("id");
    expect(eq).toHaveBeenCalledWith("user_profile_id", "profile-1");
    expect(not).toHaveBeenCalledWith("deleted_at", "is", null);
    expect(ids).toEqual(["item-2"]);
  });

  it("upserts vault_items for a user profile", async () => {
    const upsert = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const from = vi.fn().mockReturnValue({ upsert });

    const deps = createSupabaseAuthBootstrapDependencies({
      auth: { getUser: vi.fn() },
      from,
    } as never);

    await deps.upsertVaultItems("profile-1", [
      {
        id: "item-1",
        item_type: "login",
        title: "GitHub",
        encrypted_payload: loginPayload(),
        favorite: true,
        source: "manual",
        last_used_at: null,
        created_at: "2026-03-14T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
    ]);

    expect(from).toHaveBeenCalledWith("vault_items");
    expect(upsert).toHaveBeenCalledWith(
      [
        {
          id: "item-1",
          user_profile_id: "profile-1",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: loginPayload(),
          favorite: true,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-14T00:00:00.000Z",
          updated_at: "2026-03-15T00:00:00.000Z",
        },
      ],
      {
        onConflict: "id",
      },
    );
  });

  it("lists vault_items by id", async () => {
    const inQuery = vi.fn().mockResolvedValue({
      data: [
        {
          id: "item-1",
          user_profile_id: "profile-foreign",
          item_type: "login",
          title: "GitHub",
          encrypted_payload: loginPayload(),
          favorite: true,
          source: "manual",
          last_used_at: null,
          created_at: "2026-03-14T00:00:00.000Z",
          updated_at: "2026-03-15T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ in: inQuery });
    const from = vi.fn().mockReturnValue({ select });

    const deps = createSupabaseAuthBootstrapDependencies({
      auth: { getUser: vi.fn() },
      from,
    } as never);

    const items = await deps.listVaultItemsByIds(["item-1"]);

    expect(from).toHaveBeenCalledWith("vault_items");
    expect(select).toHaveBeenCalledWith(
      "id, user_profile_id, item_type, title, encrypted_payload, favorite, source, last_used_at, created_at, updated_at",
    );
    expect(inQuery).toHaveBeenCalledWith("id", ["item-1"]);
    expect(items).toEqual([
      {
        id: "item-1",
        user_profile_id: "profile-foreign",
        item_type: "login",
        title: "GitHub",
        encrypted_payload: loginPayload(),
        favorite: true,
        source: "manual",
        last_used_at: null,
        created_at: "2026-03-14T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
    ]);
  });

  it("soft deletes vault_items for a user profile", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const inQuery = vi.fn().mockReturnValue({ eq });
    const update = vi.fn().mockReturnValue({ in: inQuery });
    const from = vi.fn().mockReturnValue({ update });

    const deps = createSupabaseAuthBootstrapDependencies({
      auth: { getUser: vi.fn() },
      from,
    } as never);

    await deps.softDeleteVaultItems("profile-1", ["item-2"]);

    expect(from).toHaveBeenCalledWith("vault_items");
    expect(update).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
    });
    expect(inQuery).toHaveBeenCalledWith("id", ["item-2"]);
    expect(eq).toHaveBeenCalledWith("user_profile_id", "profile-1");
  });
});
