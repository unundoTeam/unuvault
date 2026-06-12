import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

type PackageManifest = {
  scripts?: Record<string, string>;
};

describe("Mac companion login item receipt", () => {
  it("records a reversible packaged-app login item receipt entrypoint", () => {
    const rootPackage = JSON.parse(readText("package.json")) as PackageManifest;
    const packageSwift = readText("apps/macos/App/Package.swift");
    const scriptPath = "scripts/testing/run-mac-login-item-receipt.sh";
    const readme = readText("README.md");
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(rootPackage.scripts?.["test:macos:login-item-receipt"]).toBe(
      "bash scripts/testing/run-mac-login-item-receipt.sh",
    );
    expect(existsSync(resolve(repoRoot, scriptPath))).toBe(true);

    const script = readText(scriptPath);

    expect(packageSwift).toContain("MacLoginItemReceiptHost");
    expect(script).toContain("UNUVAULT_MAC_LOGIN_ITEM_RECEIPT");
    expect(script).toContain("--)");
    expect(script).toContain("--mutate");
    expect(script).toContain("CFBundleIdentifier");
    expect(readme).toContain("pnpm test:macos:login-item-receipt");
    expect(evidence).toContain("pnpm test:macos:login-item-receipt");
    expect(evidence).toContain("packaged-app login item receipt");
  });
});
