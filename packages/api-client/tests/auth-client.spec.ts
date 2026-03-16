import { describe, expect, it, vi } from "vitest";
import { bootstrapProfile } from "../src/auth";

describe("bootstrapProfile", () => {
  it("posts to /auth/bootstrap with bearer auth", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        profile: {
          id: "profile-1",
          account_id: "account-1",
          email: "user@example.com",
          locale: "zh-CN",
        },
      }),
    });

    const response = await bootstrapProfile(fetcher, "jwt-token");

    expect(fetcher).toHaveBeenCalledWith("/auth/bootstrap", {
      method: "POST",
      headers: {
        authorization: "Bearer jwt-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(response.profile.email).toBe("user@example.com");
    expect(response.profile.account_id).toBe("account-1");
  });
});
