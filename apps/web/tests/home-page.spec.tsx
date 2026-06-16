// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "../src/app/page";

function setNavigatorLocale(locale: string) {
  for (const target of [window.navigator, Object.getPrototypeOf(window.navigator)]) {
    Object.defineProperty(target, "languages", {
      configurable: true,
      get: () => [locale],
    });
    Object.defineProperty(target, "language", {
      configurable: true,
      get: () => locale,
    });
  }
}

afterEach(() => {
  cleanup();
  setNavigatorLocale("en-US");
  window.history.replaceState({}, "", "/");
});

describe("HomePage", () => {
  it("points local developers to the register flow", () => {
    render(<HomePage />);

    expect(screen.getByText("Run unuvault locally")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open register flow" }),
    ).toHaveAttribute("href", "/register");
  });

  it("uses Simplified Chinese when the browser language is Chinese", async () => {
    setNavigatorLocale("zh-CN");

    render(<HomePage />);

    expect(await screen.findByText("本地运行 UnuVault")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "打开注册流程" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("uses Simplified Chinese when the URL requests a Chinese locale", async () => {
    setNavigatorLocale("en-US");
    window.history.replaceState({}, "", "/?lang=zh-Hans");

    render(<HomePage />);

    expect(await screen.findByText("本地运行 UnuVault")).toBeInTheDocument();
  });
});
