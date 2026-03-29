import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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

function resolveUnuforgeRepoRoot(): string | null {
  const explicit = process.env.UNUFORGE_REPO_ROOT;
  if (
    explicit &&
    existsSync(resolve(explicit, "src/unuforge/runtime/command_hosts.py"))
  ) {
    return explicit;
  }

  const sibling = resolve(repoRoot, "../unuforge");
  if (existsSync(resolve(sibling, "src/unuforge/runtime/command_hosts.py"))) {
    return sibling;
  }

  return null;
}

const unuforgeRepoRoot = resolveUnuforgeRepoRoot();
const itWithUnuforge = unuforgeRepoRoot ? it : it.skip;

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
      {
        name: "ios-test-runner",
        type: "profile",
        target: "ios-test-runner",
        domain: "testing",
        visibility: "human-and-machine",
      },
    ]);
    expect(preset.entrypoints).toEqual({
      ios_test_runner: "scripts/testing/run-ios.sh",
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
    expect(
      existsSync(
        resolve(repoRoot, "scripts/ci/tests/test_unuforge_package_consumer_smoke.py"),
      ),
    ).toBe(true);
    expect(existsSync(resolve(repoRoot, "unuforge/__init__.py"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "unuvault_forge_host/__init__.py"))).toBe(true);

    const unuforgeShim = readText("unuforge/__init__.py");
    const hostShim = readText("unuvault_forge_host/__init__.py");
    const hostSource = readText(
      "packages/unuvault-forge-host/src/unuvault_forge_host/host.py",
    );

    expect(unuforgeShim).toContain("UNUFORGE_SRC_ROOT");
    expect(unuforgeShim).toContain("UNUFORGE_REPO_ROOT");
    expect(hostShim).toContain("from .host import HOST");
    expect(hostSource).toContain("PresetDrivenCommandHost");
    expect(hostSource).toContain("unsupported_action_message");
  });

  itWithUnuforge("builds profile execution through the shared preset-driven host base", () => {
    const completed = spawnSync(
      "python3",
      [
        "-c",
        `
import json
from unuvault_forge_host import HOST
print(json.dumps(HOST.build_profile_execution(
    "presets/unuvault/release-preset.json",
    "lint-runner",
)))
`,
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          UNUFORGE_REPO_ROOT: unuforgeRepoRoot!,
        },
      },
    );

    expect(completed.status).toBe(0);

    const payload = JSON.parse(completed.stdout) as {
      runner: string;
      command: string[];
      cwd: string;
    };

    expect(payload.runner).toBe("command");
    expect(payload.command[0]).toBe("bash");
    expect(payload.command[1]).toContain("scripts/testing/lint-runner.sh");
    expect(payload.cwd).toBe(repoRoot);
  });

  itWithUnuforge("propagates the subprocess return code through the shared host base", () => {
    const completed = spawnSync(
      "python3",
      [
        "-c",
        `
from types import SimpleNamespace
from unittest.mock import patch
from unuvault_forge_host import HOST

with patch("unuforge.runtime.command_hosts.subprocess.run", return_value=SimpleNamespace(returncode=13)):
    print(HOST.run_profile(
        "presets/unuvault/release-preset.json",
        "test-runner",
    ))
`,
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          UNUFORGE_REPO_ROOT: unuforgeRepoRoot!,
        },
      },
    );

    expect(completed.status).toBe(0);
    expect(completed.stdout.trim()).toBe("13");
  });

  itWithUnuforge("rejects machine actions through the shared host base", () => {
    const completed = spawnSync(
      "python3",
      [
        "-c",
        `
from unuvault_forge_host import HOST

HOST.build_action_execution(
    "presets/unuvault/release-preset.json",
    "deploy",
)
`,
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          UNUFORGE_REPO_ROOT: unuforgeRepoRoot!,
        },
      },
    );

    expect(completed.status).not.toBe(0);
    expect(completed.stderr).toContain("does not expose machine actions yet");
  });

  it("keeps the existing root wrappers as the public lint and test entrypoints", () => {
    const rootPackage = readJson<PackageManifest>("package.json");

    expect(rootPackage.scripts?.lint).toBe("bash scripts/testing/lint-runner.sh");
    expect(rootPackage.scripts?.test).toBe("bash scripts/testing/test-runner.sh");
  });
});
