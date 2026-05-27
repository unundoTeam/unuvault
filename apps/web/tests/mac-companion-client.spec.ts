import { describe, expect, it, vi } from "vitest";
import {
  getMacCompanionStatus,
  requestMacCompanionCredentialRelease,
} from "../src/lib/mac-companion/client";

describe("mac companion client", () => {
  it("reads status from the local loopback companion", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, state: "locked" }),
    });

    await expect(getMacCompanionStatus({ fetcher })).resolves.toEqual({
      ok: true,
      state: "locked",
    });

    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:17666/status", {
      method: "GET",
    });
  });

  it("reports local companion availability failures", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("connection refused"));

    await expect(getMacCompanionStatus({ fetcher })).resolves.toEqual({
      ok: false,
      error: "mac_companion_unavailable",
    });
  });

  it("requests one active-origin credential release with bearer token", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        error: "approval_required",
        approval: {
          id: "github-login",
          origin: "https://github.com",
          profileId: "personal",
          label: "github.com",
          username: "yuchen",
        },
      }),
    });

    await expect(
      requestMacCompanionCredentialRelease({
        accessToken: "local-dev-bridge-token",
        fetcher,
        id: "github-login",
        origin: "https://github.com/login",
        profileId: "personal",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "approval_required",
      approval: {
        id: "github-login",
        origin: "https://github.com",
        profileId: "personal",
        label: "github.com",
        username: "yuchen",
      },
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:17666/v1/credentials/release",
      {
        body: JSON.stringify({
          id: "github-login",
          origin: "https://github.com/login",
          profileId: "personal",
          reason: "fill-active-page",
        }),
        headers: {
          authorization: "Bearer local-dev-bridge-token",
          "content-type": "application/json",
        },
        method: "POST",
      },
    );
  });
});
