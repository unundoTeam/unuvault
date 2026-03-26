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
    expect(workflow).not.toContain("cache: pnpm");
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

  it("keeps the root test runner scoped to the current checkout", () => {
    const testRunner = readText("scripts/testing/test-runner.sh");

    expect(testRunner).toContain("--exclude='.worktrees/**'");
  });

  it("adds a stable local dev-secrets provider wrapper", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const providerWrapper = readText("scripts/secrets/provider.sh");

    expect(rootPackage.scripts?.["secrets:provider"]).toBe(
      "tsx scripts/secrets/provider.ts",
    );
    expect(providerWrapper).toContain('tsx_bin="$repo_root/node_modules/.bin/tsx"');
    expect(providerWrapper).toContain('exec "$tsx_bin" "$repo_root/scripts/secrets/provider.ts" "$@"');
  });

  it("keeps the iOS onboarding test in a main-actor-safe context", () => {
    const onboardingTest = readText(
      "apps/ios/App/Tests/AutofillOnboardingViewTests.swift",
    );

    expect(onboardingTest).toContain("@MainActor");
    expect(onboardingTest).not.toContain("XCTAssertTrue(String(describing: view.body)");
  });

  it("keeps the iOS login test in a main-actor-safe context", () => {
    const loginTest = readText("apps/ios/App/Tests/LoginViewTests.swift");

    expect(loginTest).toContain("@MainActor");
    expect(loginTest).not.toContain("XCTAssertTrue(String(describing: view.body)");
  });
});
