import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

describe("launch packet contract", () => {
  it("keeps historical crypto review evidence separate from the current cross-platform gate", () => {
    const request = readText("docs/operations/third-party-crypto-review-request.md");
    const gate = readText("docs/operations/crypto-review-gate.md");
    const exception = readText(
      "docs/operations/crypto-review-launch-exception.md",
    );
    const checklist = readText("docs/launch/phase1-launch-checklist.md");
    const architecture = readText("docs/architecture/0005-secure-password-crypto.md");
    const handoff = readText(
      "docs/operations/secure-crypto-pr-audit-handoff.md",
    );

    expect(request).toContain("dispatch state: `not dispatched`");
    expect(request).toContain("exact merged implementation SHA: `not yet assigned`");
    expect(request).toContain("historical PR `#59` target cannot substitute");
    expect(request).not.toMatch(
      /at or after\s+`46ae0c655deef0ef15cb0cd180b4844a32cac43d`/,
    );

    expect(gate).toContain(
      "Current cross-platform internal review status: `blocked pending remediation and exact-target re-review`",
    );
    expect(gate).toContain("Bounded Argon2 checkpoint: `resolved`");
    expect(gate).toContain("Pairing target-claim authentication: `pending on main`");
    expect(gate).toContain("Fresh Mac owner authorization: `pending on main`");
    expect(gate).toContain(
      "Restart-persistent iOS replay rejection: `pending on main`",
    );
    expect(gate).toContain("Local bridge authorization: `separate open blocker`");

    expect(exception).toContain("## Historical Exception Status (2026-04-25)");
    expect(exception).toContain("46ae0c655deef0ef15cb0cd180b4844a32cac43d");
    expect(exception).toContain(
      "does not authorize the later native/cross-platform boundary",
    );

    expect(checklist).toContain(
      "Current preliminary cross-platform review verdict: `blocked`",
    );
    expect(checklist).toContain(
      "Historical PR `#59` clearance remains scoped to its recorded target",
    );
    expect(checklist).not.toContain(
      "current GA/public-launch crypto gate as an internal",
    );

    expect(architecture).toContain("## Two Crypto Substrates");
    expect(architecture).toContain(
      "Pairing V2 does not resolve local bridge authorization",
    );
    expect(architecture).not.toContain("share one crypto substrate");

    expect(handoff).toContain("Bounded Argon2 checkpoint: `resolved`");
    expect(handoff).toContain("Cross-platform preliminary verdict: `blocked`");
    expect(handoff).toContain(
      "No independent third-party verdict exists for the expanded scope",
    );
  });
});
