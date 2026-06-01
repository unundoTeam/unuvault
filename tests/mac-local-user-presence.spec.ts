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

describe("Mac local user presence proof", () => {
  it("registers a focused code-boundary proof without claiming full Touch ID UX", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const wrapperPath = "scripts/testing/run-mac-local-user-presence.sh";
    const wrapper = readText(wrapperPath);
    const readme = readText("README.md");
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(existsSync(resolve(repoRoot, wrapperPath))).toBe(true);
    expect(rootPackage.scripts?.["test:macos:local-user-presence"]).toBe(
      "bash scripts/testing/run-mac-local-user-presence.sh",
    );
    expect(wrapper).toContain("UNUVAULT_MAC_LOCAL_USER_PRESENCE");
    expect(wrapper).toContain("CompanionViewModelLocalUserPresenceTests");
    expect(wrapper).toContain("claim=save_and_unlock_code_boundary");
    expect(wrapper).toContain("unclaimed=touch_id_prompt_screenshot");
    expect(readme).toContain("pnpm test:macos:local-user-presence");
    expect(evidence).toContain("pnpm test:macos:local-user-presence");
    expect(evidence).toContain("code-boundary proof");
    expect(evidence).toContain("local save and unlock paths");
  });
});
