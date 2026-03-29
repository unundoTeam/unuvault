// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RegisterPage from "../src/app/register/page";

afterEach(() => {
  cleanup();
});

describe("Register foundation shell", () => {
  it("renders a page shell and form shell that consume the foundation contract", async () => {
    render(await RegisterPage({ searchParams: Promise.resolve({}) }));

    const pageShell = screen.getByTestId("register-page-shell");
    const pageCard = screen.getByTestId("register-page-card");
    const formShell = screen.getByTestId("register-form-shell");
    const submitButton = screen.getByRole("button", { name: "Create account" });

    expect(pageShell).toHaveStyle({
      padding: "var(--space-page-padding)",
      minHeight: "100vh",
    });
    expect(pageCard).toHaveStyle({
      borderRadius: "var(--radius-surface)",
      boxShadow: "var(--shadow-elevated)",
      padding: "var(--space-surface-padding)",
    });
    expect(formShell).toHaveStyle({
      gap: "var(--space-card-padding)",
    });
    expect(submitButton).toHaveStyle({
      borderRadius: "var(--radius-button)",
      transitionDuration: "var(--motion-duration-standard)",
    });
  });
});
