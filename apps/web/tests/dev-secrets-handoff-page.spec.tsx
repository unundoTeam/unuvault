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
      await DevSecretsHandoffPage({
        searchParams: Promise.resolve({
          callback: "http://127.0.0.1:4318/callback",
          state: "state-1",
          app: "unundo",
          env: "local",
        }),
      }),
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

  it("offers login and register paths when no browser session exists", async () => {
    mocks.createIdentityBrowserClient.mockReturnValue({
      auth: {
        getSession: vi.fn(),
      },
    });
    mocks.startBrowserHandoff.mockResolvedValue({
      status: "requires_auth",
    });

    render(
      await DevSecretsHandoffPage({
        searchParams: Promise.resolve({
          callback: "http://127.0.0.1:4318/callback",
          state: "state-1",
          app: "unundo",
          env: "local",
        }),
      }),
    );

    const googleLink = await screen.findByRole("link", {
      name: "Continue with Google",
    });
    const emailLink = screen.getByRole("link", {
      name: "Continue with email",
    });
    const registerLink = screen.getByRole("link", {
      name: "Create account",
    });

    expect(googleLink).toHaveAttribute(
      "href",
      "/login?next=%2Fdev%2Fsecrets%2Fhandoff%3Fcallback%3Dhttp%253A%252F%252F127.0.0.1%253A4318%252Fcallback%26state%3Dstate-1%26app%3Dunundo%26env%3Dlocal&provider=google",
    );
    expect(emailLink).toHaveAttribute(
      "href",
      "/login?next=%2Fdev%2Fsecrets%2Fhandoff%3Fcallback%3Dhttp%253A%252F%252F127.0.0.1%253A4318%252Fcallback%26state%3Dstate-1%26app%3Dunundo%26env%3Dlocal",
    );
    expect(registerLink).toHaveAttribute(
      "href",
      "/register?next=%2Fdev%2Fsecrets%2Fhandoff%3Fcallback%3Dhttp%253A%252F%252F127.0.0.1%253A4318%252Fcallback%26state%3Dstate-1%26app%3Dunundo%26env%3Dlocal",
    );
  });

  it("accepts Promise-based searchParams from Next 16", async () => {
    mocks.createIdentityBrowserClient.mockReturnValue({
      auth: {
        getSession: vi.fn(),
      },
    });
    mocks.startBrowserHandoff.mockResolvedValue({
      status: "requires_auth",
    });

    render(
      await DevSecretsHandoffPage({
        searchParams: Promise.resolve({
          callback: "http://127.0.0.1:4318/callback",
          state: "state-1",
          app: "unundo",
          env: "local",
        }),
      }),
    );

    expect(
      await screen.findByRole("link", {
        name: "Continue with Google",
      }),
    ).toHaveAttribute(
      "href",
      "/login?next=%2Fdev%2Fsecrets%2Fhandoff%3Fcallback%3Dhttp%253A%252F%252F127.0.0.1%253A4318%252Fcallback%26state%3Dstate-1%26app%3Dunundo%26env%3Dlocal&provider=google",
    );
    expect(
      screen.getByRole("link", {
        name: "Continue with email",
      }),
    ).toHaveAttribute(
      "href",
      "/login?next=%2Fdev%2Fsecrets%2Fhandoff%3Fcallback%3Dhttp%253A%252F%252F127.0.0.1%253A4318%252Fcallback%26state%3Dstate-1%26app%3Dunundo%26env%3Dlocal",
    );
    expect(
      screen.getByRole("link", {
        name: "Create account",
      }),
    ).toHaveAttribute(
      "href",
      "/register?next=%2Fdev%2Fsecrets%2Fhandoff%3Fcallback%3Dhttp%253A%252F%252F127.0.0.1%253A4318%252Fcallback%26state%3Dstate-1%26app%3Dunundo%26env%3Dlocal",
    );
  });
});
