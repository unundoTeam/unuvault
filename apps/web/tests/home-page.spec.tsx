// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "../src/app/page";

describe("HomePage", () => {
  it("points local developers to the register flow", () => {
    render(<HomePage />);

    expect(screen.getByText("Run unuvault locally")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open register flow" }),
    ).toHaveAttribute("href", "/register");
  });
});
