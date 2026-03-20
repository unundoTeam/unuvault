import { describe, expect, it, vi } from "vitest";
import { completeIdentityCallback } from "../src/lib/identity/complete-identity-callback";

describe("completeIdentityCallback", () => {
  it("exchanges the auth code and preserves a safe next path", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });

    const redirectPath = await completeIdentityCallback(
      "http://localhost:3001/auth/callback?code=test-code&next=/auth/finalize",
      { exchangeCodeForSession },
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    expect(redirectPath).toBe("/auth/finalize");
  });

  it("falls back to register when the callback code is missing", async () => {
    const exchangeCodeForSession = vi.fn();

    const redirectPath = await completeIdentityCallback(
      "http://localhost:3001/auth/callback",
      { exchangeCodeForSession },
    );

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(redirectPath).toBe("/register");
  });

  it("redirects to register with an auth error when session exchange fails", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      error: { message: "bad code" },
    });

    const redirectPath = await completeIdentityCallback(
      "http://localhost:3001/auth/callback?code=test-code",
      { exchangeCodeForSession },
    );

    expect(redirectPath).toBe("/register?authError=callback_failed");
  });

  it("redirects to register with an auth error when session exchange throws", async () => {
    const exchangeCodeForSession = vi
      .fn()
      .mockRejectedValue(new Error("network down"));

    const redirectPath = await completeIdentityCallback(
      "http://localhost:3001/auth/callback?code=test-code",
      { exchangeCodeForSession },
    );

    expect(redirectPath).toBe("/register?authError=callback_failed");
  });
});
