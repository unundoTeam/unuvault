import { describe, expect, it, vi } from "vitest";
import { bootstrapUnuvaultProfile } from "../src/lib/identity/bootstrap-unuvault-profile";

describe("bootstrapUnuvaultProfile", () => {
  it("uses the identity access token to bootstrap the local profile", async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "identity-token",
        },
      },
      error: null,
    });
    const bootstrapProfile = vi.fn().mockResolvedValue({
      profile: {
        id: "profile-1",
        account_id: "account-1",
        email: "user@example.com",
        locale: "zh-CN",
      },
    });

    const response = await bootstrapUnuvaultProfile({
      getSession,
      bootstrapProfile,
    });

    expect(getSession).toHaveBeenCalled();
    expect(bootstrapProfile).toHaveBeenCalledWith("identity-token");
    expect(response.profile.account_id).toBe("account-1");
  });

  it("throws when there is no usable identity session", async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    });

    await expect(
      bootstrapUnuvaultProfile({
        getSession,
        bootstrapProfile: vi.fn(),
      }),
    ).rejects.toThrow("missing_identity_session");
  });
});
