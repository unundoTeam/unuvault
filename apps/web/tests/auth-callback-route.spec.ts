import { beforeEach, describe, expect, it, vi } from "vitest";

const { createIdentityServerClient, completeIdentityCallback } = vi.hoisted(() => ({
  createIdentityServerClient: vi.fn(),
  completeIdentityCallback: vi.fn(),
}));

vi.mock("../src/lib/identity/server", () => ({
  createIdentityServerClient,
}));

vi.mock("../src/lib/identity/complete-identity-callback", () => ({
  completeIdentityCallback,
}));

import { GET } from "../src/app/auth/callback/route";

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to the resolved post-auth path", async () => {
    createIdentityServerClient.mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn(),
      },
    });
    completeIdentityCallback.mockResolvedValue("/auth/finalize");

    const request = new Request(
      "http://localhost:3001/auth/callback?code=test-code&next=/auth/finalize",
    );

    const response = await GET(request);

    expect(completeIdentityCallback).toHaveBeenCalledWith(request.url, {
      exchangeCodeForSession: expect.any(Function),
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3001/auth/finalize",
    );
  });
});
