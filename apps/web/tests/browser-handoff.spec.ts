import { beforeEach, describe, expect, it, vi } from "vitest";

describe("startBrowserHandoff", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://127.0.0.1:3000");
  });

  it("posts the handoff request through the configured API base url", async () => {
    const { startBrowserHandoff } = await import(
      "../src/lib/dev-secrets/browser-handoff"
    );
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        handoff_code: "handoff-code-1",
      }),
    });
    const redirect = vi.fn();

    const result = await startBrowserHandoff({
      identity: {
        auth: {
          getSession: async () => ({
            data: {
              session: {
                access_token: "browser-session-token",
              },
            },
          }),
        },
      },
      fetcher,
      callbackUrl: "http://127.0.0.1:4318/callback",
      state: "state-1",
      app: "unuidentity",
      env: "local",
      redirect,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/dev/secrets/handoffs",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer browser-session-token",
        }),
      }),
    );
    expect(result).toEqual({ status: "redirecting" });
    expect(redirect).toHaveBeenCalledWith(
      "http://127.0.0.1:4318/callback?code=handoff-code-1&state=state-1",
    );
  });
});
