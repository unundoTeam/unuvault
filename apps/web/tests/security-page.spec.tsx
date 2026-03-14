// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SecurityPage from "../src/app/security/page";

describe("SecurityPage", () => {
  it("shows the trust center entry points", () => {
    render(<SecurityPage />);

    expect(screen.getByText("Devices")).toBeInTheDocument();
    expect(screen.getByText("Recent activity")).toBeInTheDocument();
  });
});
