import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
};

const repoRoot = resolve(import.meta.dirname, "..");
const scriptPath = resolve(repoRoot, "scripts/testing/run-mac-local-vault-receipt.sh");

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

function readJson<T>(pathFromRepoRoot: string): T {
  return JSON.parse(readText(pathFromRepoRoot)) as T;
}

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content, { mode: 0o755 });
}

function makeSwiftMock(): { directory: string; argsFile: string } {
  const directory = mkdtempSync(join(tmpdir(), "unuvault-mac-local-receipt-"));
  const argsFile = join(directory, "swift-args.txt");

  writeExecutable(
    join(directory, "swift"),
    `#!/usr/bin/env bash
echo "$*" >> "$UNUVAULT_TEST_SWIFT_ARGS_FILE"
if [[ -n "$UNUVAULT_TEST_FAIL_FILTER" && "$*" == *"$UNUVAULT_TEST_FAIL_FILTER"* ]]; then
  exit 1
fi
exit 0
`,
  );

  return { directory, argsFile };
}

function runReceipt(options: { failFilter?: string } = {}) {
  const mock = makeSwiftMock();

  try {
    const result = spawnSync("bash", [scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${mock.directory}:${process.env.PATH ?? ""}`,
        UNUVAULT_TEST_SWIFT_ARGS_FILE: mock.argsFile,
        UNUVAULT_TEST_FAIL_FILTER: options.failFilter ?? "",
      },
    });

    return {
      ...result,
      swiftArgs: readFileSync(mock.argsFile, "utf8"),
    };
  } finally {
    rmSync(mock.directory, { recursive: true, force: true });
  }
}

describe("Mac local vault receipt", () => {
  it("records the local vault receipt entrypoint in package and evidence docs", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const readme = readText("README.md");
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(rootPackage.scripts?.["test:macos:local-vault-receipt"]).toBe(
      "bash scripts/testing/run-mac-local-vault-receipt.sh",
    );
    expect(readme).toContain("pnpm test:macos:local-vault-receipt");
    expect(evidence).toContain("pnpm test:macos:local-vault-receipt");
  });

  it("runs the focused Swift proofs for encrypted save, unlock, recovery, and one-time release", () => {
    const result = runReceipt();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("UNUVAULT_MAC_LOCAL_VAULT_RECEIPT");
    expect(result.stdout).toContain("status=ready");
    expect(result.stdout).toContain("check=LocalCompanionVaultStoreTests");
    expect(result.stdout).toContain("check=CompanionVaultSessionTests");
    expect(result.stdout).toContain("check=RecoveryBoundaryTests");
    expect(result.stdout).toContain(
      "check=LoopbackHTTPServerTests/testLoopbackReleaseRequiresNativeApprovalBeforeOneTimeClaim",
    );
    expect(result.stdout).not.toContain("Touch ID claimed");
    expect(result.stdout).not.toContain("physical iPhone");

    expect(result.swiftArgs).toContain("--package-path");
    expect(result.swiftArgs).toContain("apps/macos/App");
    expect(result.swiftArgs).toContain("--filter LocalCompanionVaultStoreTests");
    expect(result.swiftArgs).toContain("--filter CompanionVaultSessionTests");
    expect(result.swiftArgs).toContain("--filter RecoveryBoundaryTests");
    expect(result.swiftArgs).toContain(
      "--filter LoopbackHTTPServerTests/testLoopbackReleaseRequiresNativeApprovalBeforeOneTimeClaim",
    );
  });

  it("reports the exact blocked Swift proof when one receipt segment fails", () => {
    const result = runReceipt({ failFilter: "RecoveryBoundaryTests" });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("UNUVAULT_MAC_LOCAL_VAULT_RECEIPT");
    expect(result.stdout).toContain("status=blocked");
    expect(result.stdout).toContain("check=RecoveryBoundaryTests");
    expect(result.stdout).not.toContain("status=ready");
  });
});
