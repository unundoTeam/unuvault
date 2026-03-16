import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
};

type ReleasePreset = {
  schema_version: number;
  project: {
    name: string;
    manifest: string;
  };
  surfaces: Array<{
    name: string;
    type: string;
    target?: string;
    domain: string;
    visibility: string;
  }>;
  entrypoints?: Record<string, string>;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJson<T>(pathFromRepoRoot: string): T {
  return JSON.parse(
    readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8"),
  ) as T;
}

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

describe("unuforge entrypoints", () => {
  it("declares a unuvault preset with lint and test profiles", () => {
    const presetPath = "presets/unuvault/release-preset.json";

    expect(existsSync(resolve(repoRoot, presetPath))).toBe(true);

    const preset = readJson<ReleasePreset>(presetPath);

    expect(preset.schema_version).toBe(2);
    expect(preset.project.name).toBe("unuvault");
    expect(preset.surfaces).toEqual([
      {
        name: "lint-runner",
        type: "profile",
        target: "lint-runner",
        domain: "testing",
        visibility: "human-and-machine",
      },
      {
        name: "test-runner",
        type: "profile",
        target: "test-runner",
        domain: "testing",
        visibility: "human-and-machine",
      },
    ]);
    expect(preset.entrypoints).toEqual({
      lint_runner: "scripts/testing/lint-runner.sh",
      test_runner: "scripts/testing/test-runner.sh",
    });
  });

  it("adds repo-local unuforge and unuvault host shims", () => {
    expect(
      existsSync(
        resolve(repoRoot, "packages/unuvault-forge-host/src/unuvault_forge_host/host.py"),
      ),
    ).toBe(true);
    expect(existsSync(resolve(repoRoot, "unuforge/__init__.py"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "unuvault_forge_host/__init__.py"))).toBe(true);

    const unuforgeShim = readText("unuforge/__init__.py");
    const hostShim = readText("unuvault_forge_host/__init__.py");

    expect(unuforgeShim).toContain("UNUFORGE_SRC_ROOT");
    expect(unuforgeShim).toContain("UNUFORGE_REPO_ROOT");
    expect(hostShim).toContain("from .host import HOST");
  });

  it("keeps the existing root wrappers as the public lint and test entrypoints", () => {
    const rootPackage = readJson<PackageManifest>("package.json");

    expect(rootPackage.scripts?.lint).toBe("bash scripts/testing/lint-runner.sh");
    expect(rootPackage.scripts?.test).toBe("bash scripts/testing/test-runner.sh");
  });
});
