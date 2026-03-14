// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ImportPage from "../src/app/import/page";

describe("ImportPage", () => {
  it("shows browser import choices", () => {
    render(<ImportPage />);

    expect(
      screen.getByText("Import from Chrome, Edge, or Safari"),
    ).toBeInTheDocument();
  });
});
