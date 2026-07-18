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

function markdownSection(document: string, heading: string): string {
  const headingMatch = /^(#+) [^\r\n]+$/u.exec(heading);
  if (headingMatch === null) {
    throw new Error(`Invalid Markdown heading: ${heading}`);
  }

  const headingLevel = headingMatch[1].length;
  const normalizedDocument = document.replace(/\r\n?/gu, "\n");
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const matches = [
    ...normalizedDocument.matchAll(new RegExp(`^${escapedHeading}$`, "gmu")),
  ];

  if (matches.length === 0) {
    throw new Error(`Missing Markdown section: ${heading}`);
  }
  if (matches.length > 1) {
    throw new Error(`Duplicate Markdown section: ${heading}`);
  }

  const headingEnd = (matches[0].index ?? 0) + matches[0][0].length;
  const contentStart =
    normalizedDocument[headingEnd] === "\n" ? headingEnd + 1 : headingEnd;
  const nextHeading = new RegExp(`^#{1,${headingLevel}}\\s`, "mu");
  const relativeEnd = normalizedDocument.slice(contentStart).search(nextHeading);

  return relativeEnd === -1
    ? normalizedDocument.slice(contentStart)
    : normalizedDocument.slice(contentStart, contentStart + relativeEnd);
}

describe("workspace entrypoints", () => {
  it("normalizes line endings and enforces exact unique Markdown sections", () => {
    expect(
      markdownSection("## Required\r\nbody\r## Other\r\nnext\r\n", "## Required"),
    ).toBe("body\n");
    expect(markdownSection("## Required", "## Required")).toBe("");
    expect(() => markdownSection("## Other\nbody\n", "## Required")).toThrow(
      "Missing Markdown section: ## Required",
    );
    expect(() =>
      markdownSection(
        "## Required\nfirst\n## Other\nbody\n## Required\nsecond\n",
        "## Required",
      ),
    ).toThrow("Duplicate Markdown section: ## Required");
    expect(() =>
      markdownSection("prefix ## Required\nbody\n", "## Required"),
    ).toThrow("Missing Markdown section: ## Required");
  });

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

  it("keeps JS CI local and runs the real root commands", () => {
    const workflowPath = ".github/workflows/ci.yml";

    expect(existsSync(resolve(repoRoot, workflowPath))).toBe(true);

    const workflow = readText(workflowPath);

    expect(workflow).toMatch(
      /^\s{2}js:\n\s{4}runs-on: ubuntu-latest\n\s{4}timeout-minutes: 15/mu,
    );
    expect(workflow).toContain("actions/checkout@v5");
    expect(workflow).toContain("actions/setup-node@v6");
    expect(workflow).toContain('node-version: "22"');
    expect(workflow).toContain("corepack enable");
    expect(workflow).toContain("pnpm install --no-frozen-lockfile");
    expect(workflow).toContain("pnpm lint");
    expect(workflow).toContain("pnpm test");
    expect(workflow).not.toContain("cache: pnpm");
    expect(workflow).not.toContain(
      "unundoTeam/.github/.github/workflows/node-verify.yml",
    );
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
    expect(hostSpec).toContain(
      "../App/Sources/Features/ProductComposition/IOSProductCompositionView.swift",
    );
    expect(hostSpec).toContain(
      "../App/Sources/Features/Vault/VaultListView.swift",
    );
    expect(hostSpec).toContain("../App/Sources/Pairing/PairingPayload.swift");
    expect(hostApp).toContain("IOSProductCompositionView");
    expect(wrapper).toContain("xcodegen");
    expect(wrapper).toContain("ios-product-composition-empty.png");
    expect(wrapper).toContain("ios-product-composition-vault.png");
    expect(wrapper).toContain("ios-product-composition-reload-failed.png");
    expect(wrapper).toContain("ios-product-composition-accessibility3.png");
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

  it("fails fast when the root Vitest phase fails", () => {
    const testRunner = readText("scripts/testing/test-runner.sh");

    expect(testRunner).toMatch(
      /bash -c "\s*set -euo pipefail\s+\\"\\\$1\\" exec vitest/u,
    );
  });

  it("serializes root, native, and UI test entrypoints through the shared lock", () => {
    const sharedLockRunnerPath =
      "scripts/testing/run-with-shared-test-lock.sh";
    const entrypoints = [
      "scripts/testing/run-ios-ui-host.sh",
      "scripts/testing/run-ios.sh",
      "scripts/testing/run-macos.sh",
      "scripts/testing/run-pairing-boundary.sh",
      "scripts/testing/run-pairing-lan-smoke.sh",
      "scripts/testing/run-pairing-physical-receipt.sh",
    ];

    expect(existsSync(resolve(repoRoot, sharedLockRunnerPath))).toBe(true);
    expect(readText("scripts/testing/test-runner.sh")).toContain(
      "run-with-shared-test-lock.sh",
    );
    expect(readText(sharedLockRunnerPath)).toContain(
      "git -C \"$repo_root\" rev-parse --path-format=absolute --git-common-dir",
    );
    expect(readText(sharedLockRunnerPath)).toContain(
      'test_lock_path="$git_common_dir/.unuvault-test-runner.lock"',
    );

    for (const entrypoint of entrypoints) {
      expect(readText(entrypoint), entrypoint).toContain(
        'exec "$repo_root/scripts/testing/run-with-shared-test-lock.sh" "$0" "$@"',
      );
    }
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
    const readmeDesignAuthority = markdownSection(readme, "## Design Authority");
    const agentDesignAuthority = markdownSection(agents, "## Design Authority");
    const currentRoutes = [readmeDesignAuthority, agentDesignAuthority];

    for (const entrypoint of currentRoutes) {
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
      expect(entrypoint).toContain(
        "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
      );
      expect(entrypoint).toContain(
        "`current-routed` for Pairing V2 protocol/security semantics only",
      );
      expect(entrypoint).toContain("not broad Pencil/current-UI authority");
      expect(entrypoint.match(/^- Current design status: `[^`]+`\.$/gmu)).toEqual([
        "- Current design status: `registered`.",
      ]);
      expect(entrypoint).toMatch(
        /`docs\/superpowers\/specs\/2026-07-10-authenticated-pairing-approval-design\.md`\s+is `current-routed` for Pairing V2 protocol\/security semantics only\. Pairing\s+V2 implementation and exact-target security re-review remain pending\. It is\s+not broad Pencil\/current-UI authority\./u,
      );
      expect(entrypoint).not.toMatch(
        /Pairing V2 (?:implementation|exact-target security re-review) (?:is |are )?(?:complete|cleared|approved)/iu,
      );
      expect(entrypoint).not.toMatch(
        /Pairing V2 (?:is|serves as) (?:the )?(?:broad Pencil|current[- ]UI) authority/iu,
      );
      expect(entrypoint).not.toMatch(
        /(?:at or after|latest main|46ae0c655deef0ef15cb0cd180b4844a32cac43d)/u,
      );
    }

    expect(agents).toContain("current/unuvault/ios-product-composition-v1");
    expect(agents).toContain("current/unuvault/ios-pairing-invite-receive-v3");
    expect(agentDesignAuthority).not.toContain(
      "current/unuvault/ios-vault-home-native-locked-v1",
    );
    expect(agentDesignAuthority).not.toContain(
      "current/unuvault/ios-pairing-invite-receive-v2",
    );
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
    const currentEvidence = evidence.split("## Claim Boundary")[0];
    const screenshotPaths = [
      "docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-empty.png",
      "docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-vault.png",
      "docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-reload-failed.png",
      "docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-accessibility3.png",
    ];

    expect(currentEvidence).toContain("current/unuvault/ios-product-composition-v1");
    expect(currentEvidence).toContain("current/unuvault/ios-pairing-invite-receive-v3");
    expect(currentEvidence).not.toContain("current/unuvault/ios-pairing-invite-receive-v2");
    expect(evidence).toContain("IOSProductCompositionView");
    expect(evidence).toContain("current iOS package gate");
    expect(evidence).toContain("current Swift package gate");
    expect(evidence).not.toMatch(/\b\d+-test\b/);
    expect(evidence).toContain("explicit `.failed` state");
    expect(evidence).toContain("Retry");
    for (const screenshotPath of screenshotPaths) {
      expect(evidence).toContain(screenshotPath);
    }
    expect(evidence).toContain("hides raw invite session details after recognition");
    expect(evidence).toMatch(/shows invite\s+expiry instead of a raw endpoint URL/);
    expect(evidence).toContain("bash scripts/testing/run-ios.sh");
    expect(evidence).toContain("bash scripts/testing/run-ios-ui-host.sh");
    expect(evidence).toContain("No `adapter-mapped` or `adopted` claim");
    expect(evidence).toContain("Dynamic Type");
    expect(evidence).toContain("VoiceOver");
    expect(evidence).toContain("44pt");
    expect(evidence).not.toContain("docs/design/evidence/2026-05-29-ios-ui-host");
    expect(evidence).not.toContain(
      "fails closed to an empty list when the received-vault store is missing or unreadable",
    );
    expect(evidence).not.toContain(
      "launches `PairingInviteReceiveView` with deterministic sample invite data",
    );
    expect(evidence).toContain(
      "Superseded current frame `retained/unuvault/ios-pairing-invite-receive-v1-superseded-by-v2`",
    );
  });

  it("records current iOS composition proof in the Mac companion evidence", () => {
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");
    const screenshotPaths = [
      "docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-empty.png",
      "docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-vault.png",
      "docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-reload-failed.png",
      "docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-accessibility3.png",
    ];

    expect(evidence).toContain("current/unuvault/ios-product-composition-v1");
    expect(evidence).toContain("current/unuvault/ios-pairing-invite-receive-v3");
    expect(evidence).toContain("fresh successful reload");
    expect(evidence).toContain("explicit `.failed` state");
    expect(evidence).toContain("Retry");
    expect(evidence).toContain("current iOS package gate");
    expect(evidence).not.toMatch(/\b\d+-test\b/);
    for (const screenshotPath of screenshotPaths) {
      expect(evidence).toContain(screenshotPath);
    }
    expect(evidence).not.toContain(
      "approved `current/unuvault/ios-pairing-invite-receive-v2` SwiftUI receive",
    );
    expect(evidence).toMatch(
      /This historical\s+`paired` record predates the import receipt and must not be cited as physical\s+decrypt\/import proof\./u,
    );
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

  it("records the Mac companion security preflight entrypoint", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const readme = readText("README.md");
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");
    const wrapperPath = "scripts/testing/run-mac-security-preflight.sh";
    const wrapper = readText(wrapperPath);

    expect(existsSync(resolve(repoRoot, wrapperPath))).toBe(true);
    expect(rootPackage.scripts?.["test:macos:security-preflight"]).toBe(
      "bash scripts/testing/run-mac-security-preflight.sh",
    );
    expect(wrapper).toContain("UNUVAULT_MAC_SECURITY_PREFLIGHT");
    expect(wrapper).toContain("KeychainCompanionVaultKeyProvider");
    expect(wrapper).toContain("kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly");
    expect(wrapper).toContain("AES-GCM-256");
    expect(wrapper).toContain("LocalAuthentication");
    expect(readme).toContain("pnpm test:macos:security-preflight");
    expect(evidence).toContain("pnpm test:macos:security-preflight");
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

  it("records the Mac companion install-readiness proof entrypoint", () => {
    const rootPackage = readJson<PackageManifest>("package.json");
    const wrapperPath = "scripts/testing/run-mac-install-readiness.sh";
    const readme = readText("README.md");
    const evidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(existsSync(resolve(repoRoot, wrapperPath))).toBe(true);
    expect(rootPackage.scripts?.["test:macos:install-readiness"]).toBe(
      "bash scripts/testing/run-mac-install-readiness.sh",
    );

    const wrapper = readText(wrapperPath);

    expect(wrapper).toContain("UNUVAULT_MAC_INSTALL_READINESS");
    expect(wrapper).toContain("CompanionLaunchAtLoginTests");
    expect(wrapper).toContain("ServiceManagement");
    expect(readme).toContain("pnpm test:macos:install-readiness");
    expect(evidence).toContain("pnpm test:macos:install-readiness");
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
    const agentNotes = readText("AGENTS.md");
    const iosReadme = readText("apps/ios/README.md");
    const mobileEvidence = readText("docs/design/mobile-native-adapter-evidence.md");
    const macEvidence = readText("docs/design/mac-companion-mvp-evidence.md");
    const readmeRoute = markdownSection(readme, "## Design Authority");
    const agentRoute = markdownSection(agentNotes, "## Design Authority");

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
    expect(readme).toMatch(
      /claimant-key-bound handoff\s+open, AES-GCM encrypted local persistence, fresh reload, and read-only/,
    );
    expect(iosReadme).toContain(
      "The current V1 claim does not authenticate that claimant as the intended iPhone.",
    );
    for (const entrypoint of [readmeRoute, agentRoute, iosReadme]) {
      expect(entrypoint).toContain(
        "docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md",
      );
    }
    expect(readme).toContain("Pairing V1 remains the implemented proof boundary");
    expect(readme).toContain(
      "Pairing V2 implementation and exact-target security re-review remain pending",
    );
    expect(agentNotes).not.toContain(
      "current/unuvault/mac-companion-pairing-approval-v2",
    );
    expect(agentNotes).toContain("current/unuvault/ios-product-composition-v1");
    expect(agentNotes).toContain("current/unuvault/ios-pairing-invite-receive-v3");
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
    expect(rootPackage.scripts?.["test:pairing-physical-preflight"]).toBe(
      "bash scripts/testing/run-pairing-physical-receipt.sh --preflight",
    );

    const wrapper = readText(wrapperPath);
    const hostSpec = readText(hostSpecPath);
    const hostApp = readText(hostAppPath);
    const macPackage = readText(macPackagePath);
    const macHost = readText(macHostPath);

    expect(wrapper).toContain("xcrun devicectl");
    expect(wrapper).toContain("MacPairingReceiptHost");
    expect(wrapper).toContain("UNUVAULT_IOS_PAIRING_RECEIPT");
    expect(wrapper).toContain("UNUVAULT_PHYSICAL_RECEIPT_PREFLIGHT");
    expect(wrapper).toContain("--payload-url");
    expect(wrapper).toContain("--preflight");
    expect(hostSpec).toContain("NSLocalNetworkUsageDescription");
    expect(hostSpec).toContain("NSAllowsLocalNetworking");
    expect(hostSpec).toContain("unuvault-ioshost");
    expect(hostApp).toContain(".onOpenURL");
    expect(hostApp).toContain("UNUVAULT_IOS_PAIRING_RECEIPT");
    expect(hostApp).toContain("IOSPairingDeepLink.inviteText");
    expect(macPackage).toContain("MacPairingReceiptHost");
    expect(macHost).toContain("UNUVAULT_PAIRING_RECEIPT_DEEPLINK");
    expect(macHost).toContain("UNUVAULT_PAIRING_RECEIPT_INVITE_BASE64URL");
    expect(readme).toContain("pnpm test:pairing-physical-receipt");
    expect(readme).toContain("pnpm test:pairing-physical-preflight");
    expect(readme).toContain("`UNUVAULT_IOS_PAIRING_RECEIPT imported`");
    expect(readme).toContain("on 2026-07-08");
    expect(readme).toContain(
      "`UNUVAULT_IOS_PAIRING_RECEIPT paired ... material=AES-GCM-256`",
    );
    expect(readme).toContain("physical pairing-transport receipt only");
    expect(iosReadme).toContain("pnpm test:pairing-physical-receipt");
    expect(iosReadme).toContain("pnpm test:pairing-physical-preflight");
    expect(iosReadme).toContain("`UNUVAULT_IOS_PAIRING_RECEIPT imported`");
    expect(iosReadme).toContain(
      "The latest recorded hardware run on 2026-07-08 passed",
    );
    expect(iosReadme).toContain("physical pairing transport only");
    expect(mobileEvidence).toContain("pnpm test:pairing-physical-receipt");
    expect(mobileEvidence).toContain("pnpm test:pairing-physical-preflight");
    expect(macEvidence).toContain("pnpm test:pairing-physical-receipt");
    expect(macEvidence).toContain("pnpm test:pairing-physical-preflight");
  });
});
