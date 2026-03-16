import { beforeEach, describe, expect, it, vi } from "vitest";

const { createIdentityServerClient, bootstrapUnuvaultProfile, redirect } =
  vi.hoisted(() => ({
    createIdentityServerClient: vi.fn(),
    bootstrapUnuvaultProfile: vi.fn(),
    redirect: vi.fn((path: string) => {
      throw new Error(`redirect:${path}`);
    }),
  }));

vi.mock("../src/lib/identity/server", () => ({
  createIdentityServerClient,
}));

vi.mock("../src/lib/identity/bootstrap-unuvault-profile", () => ({
  bootstrapUnuvaultProfile,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

import FinalizePage from "../src/app/auth/finalize/page";

describe("FinalizePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to the vault after successful bootstrap", async () => {
    createIdentityServerClient.mockResolvedValue({
      auth: {
        getSession: vi.fn(),
      },
    });
    bootstrapUnuvaultProfile.mockResolvedValue({
      profile: {
        id: "profile-1",
        account_id: "account-1",
        email: "user@example.com",
        locale: "zh-CN",
      },
    });

    await expect(FinalizePage()).rejects.toThrow("redirect:/vault");

    expect(bootstrapUnuvaultProfile).toHaveBeenCalledWith({
      getSession: expect.any(Function),
      bootstrapProfile: expect.any(Function),
    });
  });

  it("redirects back to register when bootstrap fails", async () => {
    createIdentityServerClient.mockResolvedValue({
      auth: {
        getSession: vi.fn(),
      },
    });
    bootstrapUnuvaultProfile.mockRejectedValue(new Error("missing_identity_session"));

    await expect(FinalizePage()).rejects.toThrow(
      "redirect:/register?authError=bootstrap_failed",
    );
  });
});
