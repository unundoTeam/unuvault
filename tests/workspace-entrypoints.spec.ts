import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJson<T>(pathFromRepoRoot: string): T {
  const absolutePath = resolve(repoRoot, pathFromRepoRoot);
  return JSON.parse(readFileSync(absolutePath, "utf8")) as T;
}

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

describe("workspace entrypoints", () => {
  it("uses stable root test and lint wrappers", () => {
    const rootPackage = readJson<PackageManifest>("package.json");

    expect(rootPackage.scripts?.test).toBe("bash scripts/testing/test-runner.sh");
    expect(rootPackage.scripts?.lint).toBe("bash scripts/testing/lint-runner.sh");
  });

  it("replaces placeholder workspace commands with real scripts", () => {
    const workspacePackages = [
      "apps/api/package.json",
      "apps/web/package.json",
      "apps/browser-extension/package.json",
      "packages/api-client/package.json",
      "packages/domain/package.json",
      "packages/security/package.json",
    ];

    for (const packagePath of workspacePackages) {
      const manifest = readJson<PackageManifest>(packagePath);

      expect(manifest.scripts?.test, packagePath).not.toContain("No tests yet");
      expect(manifest.scripts?.lint, packagePath).not.toContain("No lint yet");
    }
  });

  it("adds a JS CI workflow that runs the real root commands", () => {
    const workflowPath = ".github/workflows/ci.yml";

    expect(existsSync(resolve(repoRoot, workflowPath))).toBe(true);

    const workflow = readText(workflowPath);

    expect(workflow).toContain("pnpm lint");
    expect(workflow).toContain("pnpm test");
  });

  it("adds an iOS workflow that calls the iOS wrapper", () => {
    const workflowPath = ".github/workflows/ios.yml";

    expect(existsSync(resolve(repoRoot, workflowPath))).toBe(true);

    const workflow = readText(workflowPath);

    expect(workflow).toContain("bash scripts/testing/run-ios.sh");
  });

  it("uses the repository-local pnpm binary inside bash wrappers", () => {
    const testRunner = readText("scripts/testing/test-runner.sh");
    const lintRunner = readText("scripts/testing/lint-runner.sh");

    expect(testRunner).toContain('pnpm_bin="$repo_root/node_modules/.bin/pnpm"');
    expect(lintRunner).toContain('pnpm_bin="$repo_root/node_modules/.bin/pnpm"');
  });
});
