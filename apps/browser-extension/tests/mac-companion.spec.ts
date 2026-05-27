import { describe, expect, it, vi } from "vitest";
import { createMacCompanionClient } from "../src/background/mac-companion";

describe("extension mac companion client", () => {
  it("reads origin-scoped metadata with bearer token", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        credentials: [
          {
            id: "github-login",
            label: "GitHub",
            username: "alice@example.com",
          },
        ],
      }),
    });
    const client = createMacCompanionClient({
      baseUrl: "http://127.0.0.1:17666",
      fetcher,
    });

    await expect(
      client.readCredentialMetadata({
        accessToken: "jwt-token",
        origin: "https://github.com",
        profileId: "profile-1",
      }),
    ).resolves.toEqual({
      status: "ready",
      credentials: [
        {
          id: "github-login",
          label: "GitHub",
          username: "alice@example.com",
        },
      ],
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:17666/v1/credentials?origin=https%3A%2F%2Fgithub.com&profileId=profile-1",
      {
        headers: {
          authorization: "Bearer jwt-token",
        },
        method: "GET",
      },
    );
  });

  it("requests and claims a native-approved release", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          ok: false,
          error: "approval_required",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          credential: {
            username: "alice@example.com",
            password: "native-approved-secret",
          },
        }),
      });
    const client = createMacCompanionClient({
      baseUrl: "http://127.0.0.1:17666",
      fetcher,
    });

    await expect(
      client.requestCredentialRelease({
        accessToken: "jwt-token",
        id: "github-login",
        origin: "https://github.com",
        profileId: "profile-1",
        reason: "fill-active-page",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "approval_required",
    });

    await expect(
      client.claimCredentialRelease({
        accessToken: "jwt-token",
        id: "github-login",
        origin: "https://github.com",
        profileId: "profile-1",
      }),
    ).resolves.toEqual({
      credential: {
        username: "alice@example.com",
        password: "native-approved-secret",
      },
    });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:17666/v1/credentials/release",
      {
        body: JSON.stringify({
          id: "github-login",
          origin: "https://github.com",
          profileId: "profile-1",
          reason: "fill-active-page",
        }),
        headers: {
          authorization: "Bearer jwt-token",
          "content-type": "application/json",
        },
        method: "POST",
      },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:17666/v1/credentials/claim",
      {
        body: JSON.stringify({
          id: "github-login",
          origin: "https://github.com",
          profileId: "profile-1",
        }),
        headers: {
          authorization: "Bearer jwt-token",
          "content-type": "application/json",
        },
        method: "POST",
      },
    );
  });

  it("maps unavailable metadata reads without exposing an exception", async () => {
    const client = createMacCompanionClient({
      fetcher: vi.fn().mockRejectedValue(new Error("connection refused")),
    });

    await expect(
      client.readCredentialMetadata({
        accessToken: "jwt-token",
        origin: "https://github.com",
        profileId: "profile-1",
      }),
    ).resolves.toEqual({
      status: "unavailable",
      credentials: [],
    });
  });
});
