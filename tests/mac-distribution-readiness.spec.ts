import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");

type PackageManifest = {
  scripts?: Record<string, string>;
};

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

describe("Mac companion distribution readiness", () => {
  it("registers a distribution-readiness receipt without claiming notarization", () => {
    const rootPackage = JSON.parse(readText("package.json")) as PackageManifest;
    const scriptPath = "scripts/testing/run-mac-distribution-readiness.sh";
    const readme = readText("README.md");
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(rootPackage.scripts?.["test:macos:distribution-readiness"]).toBe(
      "bash scripts/testing/run-mac-distribution-readiness.sh",
    );
    expect(existsSync(resolve(repoRoot, scriptPath))).toBe(true);

    const script = readText(scriptPath);

    expect(script).toContain("UNUVAULT_MAC_DISTRIBUTION_READINESS");
    expect(script).toContain("CFBundleIdentifier");
    expect(script).toContain("codesign");
    expect(script).toContain("notarytool");
    expect(script).toContain("--)");
    expect(script).toContain("--require-notarization");
    expect(readme).toContain("pnpm test:macos:distribution-readiness");
    expect(evidence).toContain("pnpm test:macos:distribution-readiness");
    expect(evidence).toContain("distribution-readiness receipt");
    expect(evidence).toContain("does not claim notarization");
  });
});
