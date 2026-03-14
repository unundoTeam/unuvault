// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/popup/App";

describe("App", () => {
  it("shows the vault search field", () => {
    render(<App />);

    expect(screen.getByPlaceholderText("Search vault")).toBeInTheDocument();
  });
});
