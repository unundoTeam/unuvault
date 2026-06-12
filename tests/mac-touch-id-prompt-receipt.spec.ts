import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
};

const repoRoot = resolve(import.meta.dirname, "..");

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

describe("Mac Touch ID prompt receipt", () => {
  it("registers an explicit prompt UX receipt gate without prompting by default", () => {
    const rootPackage = JSON.parse(readText("package.json")) as PackageManifest;
    const scriptPath = "scripts/testing/run-mac-touch-id-prompt-receipt.sh";
    const packageSwift = readText("apps/macos/App/Package.swift");
    const readme = readText("README.md");
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(rootPackage.scripts?.["test:macos:touch-id-prompt-receipt"]).toBe(
      "bash scripts/testing/run-mac-touch-id-prompt-receipt.sh",
    );
    expect(existsSync(resolve(repoRoot, scriptPath))).toBe(true);

    const script = readText(scriptPath);

    expect(packageSwift).toContain("MacLocalAuthenticationPromptReceiptHost");
    expect(script).toContain("prompt_app_name=\"UnuVault\"");
    expect(script).toContain("app_path=\"$receipt_root/UnuVault.app\"");
    expect(script).toContain("<string>UnuVault</string>");
    expect(script).toContain("cp \"$host_binary\" \"$macos_path/UnuVault\"");
    expect(script).toContain("host_binary_for_prompt=\"$macos_path/UnuVault\"");
    expect(script).toContain("prompt_reason=\"${UNUVAULT_TOUCH_ID_PROMPT_REASON:-解锁这台 Mac 上的本地保险库}\"");
    expect(script).toContain("UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT");
    expect(script).toContain("--capture");
    expect(script).toContain("screencapture");
    expect(script).toContain("touch_id_prompt_screenshot");
    expect(script).toContain("unclaimed=notarization,physical_iphone");
    expect(readme).toContain("pnpm test:macos:touch-id-prompt-receipt");
    expect(evidence).toContain("pnpm test:macos:touch-id-prompt-receipt");
    expect(evidence).toContain("Touch ID prompt UX receipt");
    expect(evidence).toContain("product-named `UnuVault.app`");
  });

  it("records the localized product-named local Touch ID prompt screenshot receipt once captured", () => {
    const screenshotPath =
      "docs/design/evidence/2026-06-13-mac-touch-id-prompt-localized/touch-id-prompt.png";
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");
    const receipt = readText(
      "docs/design/evidence/2026-06-13-mac-touch-id-prompt-localized/README.md",
    );

    expect(existsSync(resolve(repoRoot, screenshotPath))).toBe(true);
    expect(evidence).toContain(screenshotPath);
    expect(evidence).toContain("UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT status=prompt_requested");
    expect(evidence).toContain('reason="解锁这台 Mac 上的本地保险库"');
    expect(evidence).toContain("result=denied error_domain=com.apple.LocalAuthentication error_code=-9");
    expect(receipt).toContain("product-named `UnuVault.app`");
    expect(receipt).toContain("result=denied error_domain=com.apple.LocalAuthentication error_code=-9");
  });
});
