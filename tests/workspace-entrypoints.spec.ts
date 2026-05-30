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

  it("adds a simulator host for iOS visual proof", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const hostSpecPath = "apps/ios/HostApp/project.yml";
    const hostAppPath = "apps/ios/HostApp/Sources/UnuVaultIOSHostApp.swift";
    const hostWrapperPath = "scripts/testing/run-ios-ui-host.sh";

    expect(existsSync(resolve(repoRoot, hostSpecPath))).toBe(true);
    expect(existsSync(resolve(repoRoot, hostAppPath))).toBe(true);
    expect(existsSync(resolve(repoRoot, hostWrapperPath))).toBe(true);
    expect(rootPackage.scripts?.["test:ios:ui-host"]).toBe(
      "bash scripts/testing/run-ios-ui-host.sh",
    );

    const hostSpec = readText(hostSpecPath);
    const hostApp = readText(hostAppPath);
    const wrapper = readText(hostWrapperPath);

    expect(hostSpec).toContain("name: UnuVaultIOSHost");
    expect(hostSpec).toContain(
      "../App/Sources/Features/Pairing/PairingInviteReceiveView.swift",
    );
    expect(hostSpec).toContain("../App/Sources/Pairing/PairingPayload.swift");
    expect(hostApp).toContain("PairingInviteReceiveView");
    expect(wrapper).toContain("xcodegen");
    expect(wrapper).toContain("ios-pairing-invite-host.png");
  });

  it("adds a stable macOS companion test wrapper", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const macosWrapperPath = "scripts/testing/run-macos.sh";

    expect(existsSync(resolve(repoRoot, "apps/macos/App/Package.swift"))).toBe(
      true,
    );
    expect(existsSync(resolve(repoRoot, macosWrapperPath))).toBe(true);
    expect(rootPackage.scripts?.["test:macos"]).toBe(
      "bash scripts/testing/run-macos.sh",
    );

    const wrapper = readText(macosWrapperPath);

    expect(wrapper).toContain("swift test --package-path");
    expect(wrapper).toContain("apps/macos/App");
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

  it("keeps agent design entrypoints aligned with portfolio routing", () => {
    const readme = readText("README.md");
    const agents = readText("AGENTS.md");

    for (const entrypoint of [readme, agents]) {
      expect(entrypoint).toContain(
        "/Users/yuchen/Code/unu/unuOS/docs/portfolio/design-operating-index.md",
      );
      expect(entrypoint).toContain("it is the only first-read design authority");
      expect(entrypoint).toContain(
        "/Users/yuchen/Design/unu/unuvault/unuvault.current.pen",
      );
      expect(entrypoint).toContain(
        "/Users/yuchen/Design/unu/unuvault/unuvault.draft.pen",
      );
      expect(entrypoint).toContain("current/unuvault/design-system-v1");
      expect(entrypoint).toContain("current/unuvault/web-vault-management-v1");
      expect(entrypoint).toContain("Lightweight UI Path");
      expect(entrypoint).toContain("Historical design specs are planning context only");
      expect(entrypoint).toContain("design-specs-inventory.md");
      expect(entrypoint).toContain(
        "`current-routed` product scope and trust posture context",
      );
      expect(entrypoint).toMatch(/not broad\s+Pencil or current UI authority/);
    }
  });

  it("records the current iOS mobile adapter evidence boundary", () => {
    const evidencePath = "docs/design/mobile-native-adapter-evidence.md";

    expect(existsSync(resolve(repoRoot, evidencePath))).toBe(true);

    const evidence = readText(evidencePath);

    expect(evidence).toContain("Adapter lane: mobile/non-SwiftUI native adapter");
    expect(evidence).toContain("Status: `partial-native-proof`");
    expect(evidence).toContain("apps/ios/App/Sources/Features/Auth/LoginView.swift");
    expect(evidence).toContain("apps/ios/App/Sources/Features/Vault/VaultListView.swift");
    expect(evidence).toContain(
      "apps/ios/App/Sources/Features/Autofill/AutofillOnboardingView.swift",
    );
    expect(evidence).toContain("apps/ios/App/Sources/Features/Pairing/PairingInviteReceiveView.swift");
    expect(evidence).toContain("current/unuvault/ios-pairing-invite-receive-v2");
    expect(evidence).toContain("hides raw invite session details after recognition");
    expect(evidence).toContain("shows invite expiry instead of a raw endpoint URL");
    expect(evidence).toContain("bash scripts/testing/run-ios.sh");
    expect(evidence).toContain("bash scripts/testing/run-ios-ui-host.sh");
    expect(evidence).toContain("No `adapter-mapped` or `adopted` claim");
    expect(evidence).toContain("Dynamic Type");
    expect(evidence).toContain("VoiceOver");
    expect(evidence).toContain("44pt");
  });

  it("records the Mac companion security-boundary smoke entrypoint", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const readme = readText("README.md");
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");
    const smokePath = "scripts/smoke/menu-app-security-boundaries-mac-companion.mjs";

    expect(existsSync(resolve(repoRoot, smokePath))).toBe(true);
    expect(rootPackage.scripts?.["smoke:menu-app-security-boundaries-mac-companion"]).toBe(
      `node ${smokePath}`,
    );
    expect(readme).toContain("pnpm smoke:menu-app-security-boundaries-mac-companion");
    expect(evidence).toContain("pnpm smoke:menu-app-security-boundaries-mac-companion");
  });

  it("records the Mac companion recovery-boundary proof entrypoint", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const readme = readText("README.md");
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(rootPackage.scripts?.["test:macos:recovery-boundary"]).toBe(
      "swift test --package-path apps/macos/App --filter RecoveryBoundaryTests",
    );
    expect(readme).toContain("pnpm test:macos:recovery-boundary");
    expect(evidence).toContain("pnpm test:macos:recovery-boundary");
  });

  it("records the Mac companion pairing-boundary proof entrypoint", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const readme = readText("README.md");
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(rootPackage.scripts?.["test:macos:pairing-boundary"]).toBe(
      "swift test --package-path apps/macos/App --filter Pairing",
    );
    expect(readme).toContain("pnpm test:macos:pairing-boundary");
    expect(evidence).toContain("pnpm test:macos:pairing-boundary");
  });

  it("records the cross-surface iOS and Mac pairing-boundary proof entrypoint", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const wrapperPath = "scripts/testing/run-pairing-boundary.sh";
    const readme = readText("README.md");
    const mobileEvidence = readText("docs/design/mobile-native-adapter-evidence.md");
    const macEvidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(existsSync(resolve(repoRoot, wrapperPath))).toBe(true);
    expect(rootPackage.scripts?.["test:pairing-boundary"]).toBe(
      "bash scripts/testing/run-pairing-boundary.sh",
    );

    const wrapper = readText(wrapperPath);

    expect(wrapper).toContain("bash scripts/testing/run-ios.sh");
    expect(wrapper).toContain("swift test --package-path apps/macos/App --filter Pairing");
    expect(readme).toContain("pnpm test:pairing-boundary");
    expect(mobileEvidence).toContain("pnpm test:pairing-boundary");
    expect(macEvidence).toContain("pnpm test:pairing-boundary");
  });

  it("records the LAN-address pairing smoke proof entrypoint", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const wrapperPath = "scripts/testing/run-pairing-lan-smoke.sh";
    const readme = readText("README.md");
    const mobileEvidence = readText("docs/design/mobile-native-adapter-evidence.md");
    const macEvidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(existsSync(resolve(repoRoot, wrapperPath))).toBe(true);
    expect(rootPackage.scripts?.["test:pairing-lan-smoke"]).toBe(
      "bash scripts/testing/run-pairing-lan-smoke.sh",
    );

    const wrapper = readText(wrapperPath);

    expect(wrapper).toContain("UNUVAULT_PAIRING_LAN_HOST");
    expect(wrapper).toContain("RuntimeLANPairingSmokeTests");
    expect(readme).toContain("pnpm test:pairing-lan-smoke");
    expect(mobileEvidence).toContain("pnpm test:pairing-lan-smoke");
    expect(macEvidence).toContain("pnpm test:pairing-lan-smoke");
  });

  it("records the physical iPhone pairing receipt proof harness", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const wrapperPath = "scripts/testing/run-pairing-physical-receipt.sh";
    const hostSpecPath = "apps/ios/HostApp/project.yml";
    const hostAppPath = "apps/ios/HostApp/Sources/UnuVaultIOSHostApp.swift";
    const macPackagePath = "apps/macos/App/Package.swift";
    const macHostPath = "apps/macos/App/Sources/MacPairingReceiptHost/main.swift";
    const readme = readText("README.md");
    const iosReadme = readText("apps/ios/README.md");
    const mobileEvidence = readText("docs/design/mobile-native-adapter-evidence.md");
    const macEvidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(existsSync(resolve(repoRoot, wrapperPath))).toBe(true);
    expect(existsSync(resolve(repoRoot, macHostPath))).toBe(true);
    expect(rootPackage.scripts?.["test:pairing-physical-receipt"]).toBe(
      "bash scripts/testing/run-pairing-physical-receipt.sh",
    );

    const wrapper = readText(wrapperPath);
    const hostSpec = readText(hostSpecPath);
    const hostApp = readText(hostAppPath);
    const macPackage = readText(macPackagePath);
    const macHost = readText(macHostPath);

    expect(wrapper).toContain("xcrun devicectl");
    expect(wrapper).toContain("MacPairingReceiptHost");
    expect(wrapper).toContain("UNUVAULT_IOS_PAIRING_RECEIPT");
    expect(wrapper).toContain("--payload-url");
    expect(hostSpec).toContain("NSLocalNetworkUsageDescription");
    expect(hostSpec).toContain("NSAllowsLocalNetworking");
    expect(hostSpec).toContain("unuvault-ioshost");
    expect(hostApp).toContain(".onOpenURL");
    expect(hostApp).toContain("UNUVAULT_IOS_PAIRING_RECEIPT");
    expect(hostApp).toContain("base64URL");
    expect(macPackage).toContain("MacPairingReceiptHost");
    expect(macHost).toContain("UNUVAULT_PAIRING_RECEIPT_DEEPLINK");
    expect(macHost).toContain("UNUVAULT_PAIRING_RECEIPT_INVITE_BASE64URL");
    expect(readme).toContain("pnpm test:pairing-physical-receipt");
    expect(iosReadme).toContain("pnpm test:pairing-physical-receipt");
    expect(mobileEvidence).toContain("pnpm test:pairing-physical-receipt");
    expect(macEvidence).toContain("pnpm test:pairing-physical-receipt");
  });
});
