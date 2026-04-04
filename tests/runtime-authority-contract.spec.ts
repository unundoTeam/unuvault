import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

describe("runtime authority contract", () => {
  it("adds a first-layer runtime authority route in the root readme", () => {
    const readme = readText("README.md");

    expect(readme).toContain("## Runtime Authority");
    expect(readme).toContain("docs/operations/runtime-authority.md");
    expect(readme).toContain("incident");
    expect(readme).toContain("observability");
    expect(readme).toContain("production-readiness");
  });

  it("adds an operations runtime authority hub that stays honest about current gaps", () => {
    const runtimeAuthorityPath = resolve(
      repoRoot,
      "docs/operations/runtime-authority.md",
    );

    expect(existsSync(runtimeAuthorityPath)).toBe(true);

    const runtimeAuthority = readText("docs/operations/runtime-authority.md");

    expect(runtimeAuthority).toContain("# Runtime Authority");
    expect(runtimeAuthority).toContain("## Incident Authority");
    expect(runtimeAuthority).toContain("## Observability And Telemetry Status");
    expect(runtimeAuthority).toContain("## Production Readiness");
    expect(runtimeAuthority).toContain("identity-production-cutover-rehearsal.md");
    expect(runtimeAuthority).toContain("supabase-env-mapping.md");
    expect(runtimeAuthority).toContain("phase1-launch-checklist.md");
    expect(runtimeAuthority).toContain("does not yet expose a standalone telemetry or observability authority page");
  });
});
