import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..");
const scriptPath = resolve(repoRoot, "scripts/testing/run-pairing-physical-receipt.sh");

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content, { mode: 0o755 });
}

function makeMockBin(options: { deviceJson: string }): string {
  const directory = mkdtempSync(join(tmpdir(), "unuvault-physical-preflight-"));

  writeExecutable(
    join(directory, "ipconfig"),
    `#!/usr/bin/env bash
if [[ "$1" == "getifaddr" ]]; then
  echo "10.0.0.5"
  exit 0
fi
exit 1
`,
  );

  writeExecutable(
    join(directory, "xcrun"),
    `#!/usr/bin/env bash
if [[ "$1" == "devicectl" && "$2" == "list" && "$3" == "devices" ]]; then
  output=""
  for ((i = 1; i <= $#; i++)); do
    if [[ "\${!i}" == "--json-output" ]]; then
      next=$((i + 1))
      output="\${!next}"
    fi
  done
  if [[ -n "$output" ]]; then
    cat >"$output" <<'JSON'
${options.deviceJson}
JSON
  fi
  exit 0
fi
echo "unexpected xcrun invocation: $*" >&2
exit 1
`,
  );

  writeExecutable(join(directory, "xcodegen"), "#!/usr/bin/env bash\nexit 0\n");
  writeExecutable(join(directory, "xcodebuild"), "#!/usr/bin/env bash\nexit 0\n");

  return directory;
}

function runPreflight(options: { deviceJson: string }) {
  const mockBin = makeMockBin(options);

  try {
    return spawnSync("bash", [scriptPath, "--preflight"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${mockBin}:${process.env.PATH ?? ""}`,
      },
    });
  } finally {
    rmSync(mockBin, { recursive: true, force: true });
  }
}

describe("physical iPhone receipt preflight", () => {
  it("reports a precise blocked state when no physical iPhone is visible", () => {
    const result = runPreflight({
      deviceJson: JSON.stringify({ result: { devices: [] } }),
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("UNUVAULT_PHYSICAL_RECEIPT_PREFLIGHT");
    expect(result.stdout).toContain("status=blocked");
    expect(result.stdout).toContain("reason=no_physical_iphone");
    expect(result.stdout).toContain("Connect, unlock, and trust an iPhone");
    expect(result.stdout).not.toContain("Building MacPairingReceiptHost");
  });

  it("passes preflight without launching the receipt harness when prerequisites are visible", () => {
    const result = runPreflight({
      deviceJson: JSON.stringify({
        result: {
          devices: [
            {
              identifier: "00008110-0012345600000000",
              name: "Yuchen iPhone",
              platform: "iOS",
            },
          ],
        },
      }),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("UNUVAULT_PHYSICAL_RECEIPT_PREFLIGHT");
    expect(result.stdout).toContain("status=ready");
    expect(result.stdout).toContain("lan_host=10.0.0.5");
    expect(result.stdout).toContain("device_id=00008110-0012345600000000");
    expect(result.stdout).not.toContain("Launching UnuVaultIOSHost");
  });
});
