import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");
const scriptPath = resolve(repoRoot, "scripts/testing/run-mac-security-preflight.sh");

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content, { mode: 0o755 });
}

function makeMockBin(options: { securityExitCode?: number }): string {
  const directory = mkdtempSync(join(tmpdir(), "unuvault-mac-security-preflight-"));

  writeExecutable(join(directory, "uname"), "#!/usr/bin/env bash\necho Darwin\n");
  writeExecutable(join(directory, "sw_vers"), "#!/usr/bin/env bash\necho 14.5\n");
  writeExecutable(
    join(directory, "swift"),
    `#!/usr/bin/env bash
if [[ "$1" == "-e" ]]; then
  echo "local_auth=available biometrics=available"
  exit 0
fi
exit 0
`,
  );
  writeExecutable(
    join(directory, "security"),
    `#!/usr/bin/env bash
exit ${options.securityExitCode ?? 0}
`,
  );

  return directory;
}

function runPreflight(options: { securityExitCode?: number } = {}) {
  const mockBin = makeMockBin(options);
  const vaultDirectory = mkdtempSync(join(tmpdir(), "unuvault-mac-vault-"));

  try {
    return spawnSync("bash", [scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${mockBin}:${process.env.PATH ?? ""}`,
        UNUVAULT_MAC_SECURITY_PREFLIGHT_VAULT_DIR: vaultDirectory,
      },
    });
  } finally {
    rmSync(mockBin, { recursive: true, force: true });
    rmSync(vaultDirectory, { recursive: true, force: true });
  }
}

describe("Mac companion security preflight", () => {
  it("reports ready without launching the companion when required Mac checks pass", () => {
    const result = runPreflight();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("UNUVAULT_MAC_SECURITY_PREFLIGHT");
    expect(result.stdout).toContain("status=ready");
    expect(result.stdout).toContain("check=keychain_cli");
    expect(result.stdout).toContain("check=local_auth_framework");
    expect(result.stdout).toContain("check=vault_directory");
    expect(result.stdout).not.toContain("MacCompanionSmokeHost");
    expect(result.stdout).not.toContain("UnuVaultMacCompanion");
  });

  it("reports a precise blocker when the Keychain CLI is unavailable", () => {
    const result = runPreflight({ securityExitCode: 1 });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("UNUVAULT_MAC_SECURITY_PREFLIGHT");
    expect(result.stdout).toContain("status=blocked");
    expect(result.stdout).toContain("reason=keychain_cli_unavailable");
    expect(result.stdout).not.toContain("status=ready");
  });
});
