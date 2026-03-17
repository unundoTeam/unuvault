// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "../src/app/register/page";

afterEach(() => {
  cleanup();
  mocks.identitySignUp.mockClear();
});

const mocks = vi.hoisted(() => ({
  identitySignUp: vi.fn().mockResolvedValue({
    data: {
      session: null,
    },
    error: null,
  }),
}));

vi.mock("../src/lib/identity/browser", () => ({
  createIdentityBrowserClient: () => ({
    auth: {
      signUp: mocks.identitySignUp,
    },
  }),
}));

describe("RegisterPage", () => {
  it("shows the MVP auth form fields", () => {
    render(<RegisterPage />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeInTheDocument();
  });

  it("shows a ready state after a successful signup flow", async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse-battery" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    expect(mocks.identitySignUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "correct-horse-battery",
      options: {
        emailRedirectTo: expect.stringContaining("/auth/callback?next=%2Fauth%2Ffinalize"),
      },
    });
    expect(
      await screen.findByText("Check your email to finish setting up unuvault."),
    ).toBeInTheDocument();
  });

  it("blocks empty submissions before hitting unuidentity", async () => {
    render(<RegisterPage />);

    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    expect(await screen.findByText("Email and password are required.")).toBeInTheDocument();
    expect(mocks.identitySignUp).not.toHaveBeenCalled();
  });
});
