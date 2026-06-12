import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

describe("Mac companion install-readiness UI", () => {
  it("surfaces Open at login as a native toggle in the menu overview", () => {
    const menuView = readText(
      "apps/macos/App/Sources/UnuVaultMacCompanion/CompanionMenuView.swift",
    );
    const englishStrings = readText(
      "apps/macos/App/Sources/UnuVaultMacCompanion/Resources/en.lproj/Localizable.strings",
    );
    const chineseStrings = readText(
      "apps/macos/App/Sources/UnuVaultMacCompanion/Resources/zh-Hans.lproj/Localizable.strings",
    );
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(menuView).toContain("launchAtLoginSetting");
    expect(menuView).toContain("Toggle(");
    expect(menuView).toContain("isOn: launchAtLoginBinding");
    expect(menuView).toContain('.accessibilityIdentifier("launch-at-login-toggle")');
    expect(menuView).toContain("viewModel.launchAtLoginStatusText");
    expect(englishStrings).toContain('"install.login_item.title" = "Open at login";');
    expect(chineseStrings).toContain('"install.login_item.title" = "登录时打开";');
    expect(evidence).toContain(
      "current/unuvault/mac-companion-core-flows-v1.3",
    );
    expect(evidence).toContain("native SwiftUI `Toggle`");
  });
});
