// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SecurityPage from "../src/app/security/page";

function setNavigatorLocale(locale: string) {
  Object.defineProperty(window.navigator, "languages", {
    configurable: true,
    value: [locale],
  });
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: locale,
  });
}

afterEach(() => {
  cleanup();
  setNavigatorLocale("en-US");
});

describe("SecurityPage", () => {
  it("shows the trust center entry points", () => {
    render(<SecurityPage />);

    expect(screen.getByText("Devices")).toBeInTheDocument();
    expect(screen.getByText("Recent activity")).toBeInTheDocument();
  });

  it("uses Simplified Chinese when the browser language is Chinese", () => {
    setNavigatorLocale("zh-CN");

    render(<SecurityPage />);

    expect(screen.getByText("安全")).toBeInTheDocument();
    expect(screen.getByText("设备")).toBeInTheDocument();
    expect(screen.getByText("近期活动")).toBeInTheDocument();
  });
});
