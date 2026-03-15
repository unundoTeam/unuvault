import { describe, expect, it, vi } from "vitest";
import { createSupabaseAuthBootstrapDependencies } from "../src/lib/supabase";

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
});
