// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../src/app/login/page";

const mocks = vi.hoisted(() => ({
  identitySignInWithPassword: vi.fn().mockResolvedValue({
    data: {
      session: {
        access_token: "session-token",
      },
    },
    error: null,
  }),
  identitySignInWithOAuth: vi.fn().mockResolvedValue({
    data: {
      url: "https://accounts.google.com/o/oauth2/v2/auth",
    },
    error: null,
  }),
  routerPush: vi.fn(),
}));

vi.mock("../src/lib/identity/browser", () => ({
  createIdentityBrowserClient: () => ({
    auth: {
      signInWithPassword: mocks.identitySignInWithPassword,
      signInWithOAuth: mocks.identitySignInWithOAuth,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.routerPush,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LoginPage", () => {
  it("shows sign-in actions for existing users", async () => {
    render(await LoginPage({}));

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
  });

  it("signs in with email and password then routes back to the caller next path", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({
          next: "/dev/secrets/handoff?callback=http%3A%2F%2F127.0.0.1%3A4318%2Fcallback",
        }),
      }),
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse-battery" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);

    await waitFor(() => {
      expect(mocks.identitySignInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "correct-horse-battery",
      });
    });

    expect(mocks.routerPush).toHaveBeenCalledWith(
      "/dev/secrets/handoff?callback=http%3A%2F%2F127.0.0.1%3A4318%2Fcallback",
    );
  });

  it("starts Google sign-in with the callback-preserving redirect", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({
          next: "/dev/secrets/handoff?callback=http%3A%2F%2F127.0.0.1%3A4318%2Fcallback",
          provider: "google",
        }),
      }),
    );

    await waitFor(() => {
      expect(mocks.identitySignInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: expect.stringContaining(
            "/auth/callback?next=%2Fdev%2Fsecrets%2Fhandoff%3Fcallback%3Dhttp%253A%252F%252F127.0.0.1%253A4318%252Fcallback",
          ),
        },
      });
    });
  });
});
