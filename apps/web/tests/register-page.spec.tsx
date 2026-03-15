// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "../src/app/register/page";

afterEach(() => {
  cleanup();
  mocks.signUp.mockClear();
  mocks.bootstrapProfile.mockClear();
});

const mocks = vi.hoisted(() => ({
  signUp: vi.fn().mockResolvedValue({
    data: {
      session: {
        access_token: "jwt-token",
      },
    },
    error: null,
  }),
  bootstrapProfile: vi.fn().mockResolvedValue({
    profile: {
      id: "profile-1",
      email: "user@example.com",
      locale: "zh-CN",
    },
  }),
}));

vi.mock("../src/lib/supabase-browser", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      signUp: mocks.signUp,
    },
  }),
}));

vi.mock("../../../packages/api-client/src/auth", () => ({
  bootstrapProfile: mocks.bootstrapProfile,
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

    expect(await screen.findByText("Account ready")).toBeInTheDocument();
  });

  it("blocks empty submissions before hitting Supabase", async () => {
    render(<RegisterPage />);

    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    expect(await screen.findByText("Email and password are required.")).toBeInTheDocument();
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(mocks.bootstrapProfile).not.toHaveBeenCalled();
  });
});
