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
    expect(script).toContain("UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT");
    expect(script).toContain("--capture");
    expect(script).toContain("screencapture");
    expect(script).toContain("touch_id_prompt_screenshot");
    expect(script).toContain("unclaimed=notarization,physical_iphone");
    expect(readme).toContain("pnpm test:macos:touch-id-prompt-receipt");
    expect(evidence).toContain("pnpm test:macos:touch-id-prompt-receipt");
    expect(evidence).toContain("Touch ID prompt UX receipt");
  });

  it("records the local Touch ID prompt screenshot receipt once captured", () => {
    const screenshotPath =
      "docs/design/evidence/2026-06-12-mac-touch-id-prompt/touch-id-prompt.png";
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(existsSync(resolve(repoRoot, screenshotPath))).toBe(true);
    expect(evidence).toContain(screenshotPath);
    expect(evidence).toContain("UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT status=prompt_requested");
    expect(evidence).toContain("result=denied error_domain=com.apple.LocalAuthentication error_code=-9");
  });
});
