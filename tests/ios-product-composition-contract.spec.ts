import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readText = (path: string) => readFileSync(path, "utf8");

const oldFrame =
  "(?:current/unuvault/ios-product-composition-v1|current/unuvault/ios-pairing-invite-receive-v3)";

const expectNoUnregisteredFrameAuthorityClaim = (text: string) => {
  expect(text).not.toMatch(
    new RegExp(`\\b(?:current|approved|promoted)\\s+(?:\\x60)?${oldFrame}`, "iu"),
  );
  expect(text).not.toMatch(
    new RegExp(
      `${oldFrame}[^\\n]{0,220}\\b(?:are|is)\\s+(?:current|approved|promoted)\\b`,
      "iu",
    ),
  );
};

describe("iOS product composition contract", () => {
  it("routes current runtime semantics through architecture 0009", () => {
    const contract = readText("docs/architecture/0009-ios-product-composition-contract.md");
    const readme = readText("README.md");
    const agents = readText("AGENTS.md");
    const iosReadme = readText("apps/ios/README.md");
    const mobileEvidence = readText("docs/design/mobile-native-adapter-evidence.md");
    const macEvidence = readText("docs/design/mac-companion-mvp-evidence.md");

    expect(readme).toContain("`docs/architecture/0009-ios-product-composition-contract.md`");
    expect(contract).toContain("## Implemented invariants");
    expect(contract).toContain("## Current unimplemented requirements");
    expect(contract).toContain("## Proof gaps");
    expect(contract).toContain(
      "late startup load must not override a user-selected destination",
    );
    expect(contract).toContain("invalid deep link must select Pairing");
    expect(contract).toContain("second deep link");
    expect(contract).toContain("typed safe-load failure");
    expect(contract).toContain("stale-result generation or cancellation ownership");
    expect(contract).toContain("post-import reload progress");
    expect(contract).toContain("VoiceOver route focus");
    expect(contract).toContain("valid deep-link product route");
    expect(contract).toContain("accepts one valid invite");
    expect(contract).toContain("startup loading is settled");
    expect(contract).toContain("selects Pairing");
    expect(contract).toContain("forwards the invite");
    expect(contract).toContain("starts one pairing attempt");
    expect(contract).toMatch(/second or concurrent attempt\s+remains single-flight/iu);
    expect(contract).toContain("current/unuvault/ios-vault-home-native-locked-v1");
    expect(contract).toContain("current/unuvault/ios-vault-list-readonly-v1");
    expect(contract).toContain("8fea5985ed0cfbc0dec32da7b9642f6d27bf178f");
    expect(contract).toContain("salvage provenance only");
    expect(contract).toContain("Pencil sync: not proven by this contract");

    for (const text of [readme, agents, iosReadme]) {
      expect(text).toContain("current/unuvault/ios-vault-home-native-locked-v1");
      expect(text).toContain("current/unuvault/ios-vault-list-readonly-v1");
    }
    expect(iosReadme).toContain(
      "docs/architecture/0009-ios-product-composition-contract.md",
    );
    expect(iosReadme).not.toContain("promoted product composition");
    expect(iosReadme).toContain("historical simulator runtime evidence");

    expect(readme).toContain("historical implementation/visual evidence");
    for (const text of [mobileEvidence, macEvidence]) {
      expect(text).toMatch(/historical\s+implementation\/visual evidence/u);
    }
    expect(mobileEvidence).toContain("Pencil sync: blocked");
    expect(mobileEvidence).not.toContain("current matches implementation");
    for (const text of [readme, agents, iosReadme, mobileEvidence, macEvidence]) {
      expectNoUnregisteredFrameAuthorityClaim(text);
    }
  });
});
