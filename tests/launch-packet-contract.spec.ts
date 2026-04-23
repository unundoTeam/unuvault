import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

describe("launch packet contract", () => {
  it("keeps the third-party crypto request send-ready", () => {
    const request = readText("docs/operations/third-party-crypto-review-request.md");
    const checklist = readText("docs/launch/phase1-launch-checklist.md");

    expect(request).toContain("# Third-Party Crypto Review Request");
    expect(request).toContain("## Forwardable Reviewer Brief");
    expect(request).toContain("## Operator Dispatch Checklist");
    expect(request).toContain("GA/public launch");
    expect(request).toContain("Please return the review result in this exact shape:");
    expect(request).toContain("docs/operations/secure-crypto-pr-audit-handoff.md");
    expect(request).toContain("docs/operations/crypto-review-gate.md");
    expect(request).toContain("docs/launch/phase1-launch-checklist.md");
    expect(request).toContain("46ae0c655deef0ef15cb0cd180b4844a32cac43d");
    expect(checklist).toContain("## Carry-Forward Before GA/Public Launch");
  });
});
