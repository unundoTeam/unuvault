import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
};

const repoRoot = resolve(import.meta.dirname, "..");

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

function readJson<T>(pathFromRepoRoot: string): T {
  return JSON.parse(readText(pathFromRepoRoot)) as T;
}

describe("Web Save to Mac companion smoke", () => {
  it("registers a real native-process Web import smoke without overclaiming background sync", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const scriptPath = "scripts/smoke/web-save-to-mac-companion.mjs";
    const readme = readText("README.md");
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(existsSync(resolve(repoRoot, scriptPath))).toBe(true);
    expect(rootPackage.scripts?.["smoke:web-save-to-mac-companion"]).toBe(
      "node scripts/smoke/web-save-to-mac-companion.mjs",
    );

    const script = readText(scriptPath);
    expect(script).toContain("MacCompanionSmokeHost");
    expect(script).toContain("Save to this Mac");
    expect(script).toContain("/v1/local-vault/import");
    expect(script).toContain("/v1/credentials/release");
    expect(script).toContain("/v1/credentials/claim");
    expect(script).toContain("credential_not_found");
    expect(script).toContain("vault_locked");
    expect(script).toContain("web-save-to-mac-smoke");

    expect(readme).toContain("pnpm smoke:web-save-to-mac-companion");
    expect(readme).toContain("real native-process Web import");
    expect(evidence).toContain("pnpm smoke:web-save-to-mac-companion");
    expect(evidence).toContain("real native-process Web import");
    expect(evidence).toContain("does not claim automatic background sync");
  });
});
