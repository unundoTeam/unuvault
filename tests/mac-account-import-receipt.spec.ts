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

describe("Mac account import receipt", () => {
  it("registers the Web/account to Mac local vault proof without overclaiming cloud sync", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const wrapperPath = "scripts/testing/run-mac-account-import-receipt.sh";
    const wrapper = readText(wrapperPath);
    const readme = readText("README.md");
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(existsSync(resolve(repoRoot, wrapperPath))).toBe(true);
    expect(rootPackage.scripts?.["test:macos:account-import-receipt"]).toBe(
      "bash scripts/testing/run-mac-account-import-receipt.sh",
    );
    expect(wrapper).toContain("UNUVAULT_MAC_ACCOUNT_IMPORT_RECEIPT");
    expect(wrapper).toContain("CompanionWebAccountImportReceiptTests");
    expect(wrapper).toContain("claim=web_account_to_mac_local_vault_receipt");
    expect(wrapper).toContain("unclaimed=cloud_sync_daemon");
    expect(readme).toContain("pnpm test:macos:account-import-receipt");
    expect(evidence).toContain("pnpm test:macos:account-import-receipt");
    expect(evidence).toContain("Web/account unlocked vault payload");
    expect(evidence).toContain("cloud sync daemon is not claimed");
  });
});
