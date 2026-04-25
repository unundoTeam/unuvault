import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

describe("launch packet contract", () => {
  it("keeps the deferred third-party crypto request reopen-ready", () => {
    const request = readText("docs/operations/third-party-crypto-review-request.md");
    const checklist = readText("docs/launch/phase1-launch-checklist.md");
    const architecture = readText("docs/architecture/0005-secure-password-crypto.md");

    expect(request).toContain("# Third-Party Crypto Review Request");
    expect(request).toContain(
      "Use this only when a real external reviewer or vendor path is reopened",
    );
    expect(request).toContain("current launch path defers third-party crypto review");
    expect(request).toContain("iterative review gate");
    expect(request).toContain("## Forwardable Reviewer Brief");
    expect(request).toContain("## Operator Dispatch Checklist");
    expect(request).toContain("external review path has been");
    expect(request).toContain("Please return the review result in this exact shape:");
    expect(request).toContain("docs/operations/secure-crypto-pr-audit-handoff.md");
    expect(request).toContain("docs/operations/crypto-review-gate.md");
    expect(request).toContain("docs/operations/crypto-review-launch-exception.md");
    expect(request).toContain("docs/launch/phase1-launch-checklist.md");
    expect(request).toContain("46ae0c655deef0ef15cb0cd180b4844a32cac43d");
    expect(checklist).toContain("## Carry-Forward Before GA/Public Launch");
    expect(checklist).toContain("Internal iterative crypto review loop");
    expect(checklist).toContain("Third-party crypto review is deferred");
    expect(checklist).toContain("docs/operations/crypto-review-launch-exception.md");
    expect(checklist).toContain("production landing routing was rechecked on 2026-04-25");
    expect(checklist).toContain(
      "unuidentity/docs/operations/production-landing-completion.md",
    );
    expect(architecture).toContain("repo-backed internal iterative review gate");
    expect(architecture).toContain("docs/operations/crypto-review-launch-exception.md");
    expect(architecture).not.toContain(
      "Independent review is still required before GA/public launch",
    );
  });
});
