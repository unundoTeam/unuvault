// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DevSecretsHandoffPage from "../src/app/dev/secrets/handoff/page";

const mocks = vi.hoisted(() => ({
  createIdentityBrowserClient: vi.fn(),
  startBrowserHandoff: vi.fn(),
}));

vi.mock("../src/lib/identity/browser", () => ({
  createIdentityBrowserClient: mocks.createIdentityBrowserClient,
}));

vi.mock("../src/lib/dev-secrets/browser-handoff", () => ({
  startBrowserHandoff: mocks.startBrowserHandoff,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DevSecretsHandoffPage", () => {
  it("mints a handoff code and redirects the browser to the loopback callback", async () => {
    const identityClient = {
      auth: {
        getSession: vi.fn(),
      },
    };

    mocks.createIdentityBrowserClient.mockReturnValue(identityClient);
    mocks.startBrowserHandoff.mockResolvedValue({
      status: "redirecting",
    });

    render(
      <DevSecretsHandoffPage
        searchParams={{
          callback: "http://127.0.0.1:4318/callback",
          state: "state-1",
          app: "unundo",
          env: "local",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Connect your terminal" }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.startBrowserHandoff).toHaveBeenCalledWith({
        identity: identityClient,
        fetcher: expect.any(Function),
        callbackUrl: "http://127.0.0.1:4318/callback",
        state: "state-1",
        app: "unundo",
        env: "local",
        redirect: expect.any(Function),
      });
    });
  });

  it("sends the user through the existing auth flow when no browser session exists", async () => {
    mocks.createIdentityBrowserClient.mockReturnValue({
      auth: {
        getSession: vi.fn(),
      },
    });
    mocks.startBrowserHandoff.mockResolvedValue({
      status: "requires_auth",
    });

    render(
      <DevSecretsHandoffPage
        searchParams={{
          callback: "http://127.0.0.1:4318/callback",
          state: "state-1",
          app: "unundo",
          env: "local",
        }}
      />,
    );

    const registerLink = await screen.findByRole("link", {
      name: "Continue through register",
    });

    expect(registerLink).toHaveAttribute(
      "href",
      "/register?next=%2Fdev%2Fsecrets%2Fhandoff%3Fcallback%3Dhttp%253A%252F%252F127.0.0.1%253A4318%252Fcallback%26state%3Dstate-1%26app%3Dunundo%26env%3Dlocal",
    );
  });
});
