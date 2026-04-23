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
    expect(readme).toContain("docs/operations/incident-observability-authority.md");
    expect(readme).toContain("docs/operations/identity-production-cutover-hosted-pass.md");
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
    expect(runtimeAuthority).toContain("incident-observability-authority.md");
    expect(runtimeAuthority).toContain("identity-production-cutover-rehearsal.md");
    expect(runtimeAuthority).toContain(
      "unuidentity/docs/operations/unuvault-cutover-operator-signoff.md",
    );
    expect(runtimeAuthority).toContain("identity-production-cutover-hosted-pass.md");
    expect(runtimeAuthority).toContain("supabase-env-mapping.md");
    expect(runtimeAuthority).toContain("phase1-launch-checklist.md");
    expect(runtimeAuthority).toContain(
      "minimal standalone incident and observability",
    );
  });

  it("records the new hosted-pass and incident-observability authority docs", () => {
    const incidentAuthorityPath = resolve(
      repoRoot,
      "docs/operations/incident-observability-authority.md",
    );
    const hostedPassPath = resolve(
      repoRoot,
      "docs/operations/identity-production-cutover-hosted-pass.md",
    );

    expect(existsSync(incidentAuthorityPath)).toBe(true);
    expect(existsSync(hostedPassPath)).toBe(true);

    const incidentAuthority = readText(
      "docs/operations/incident-observability-authority.md",
    );
    const hostedPass = readText(
      "docs/operations/identity-production-cutover-hosted-pass.md",
    );
    const rehearsal = readText(
      "docs/operations/identity-production-cutover-rehearsal.md",
    );
    const launchChecklist = readText("docs/launch/phase1-launch-checklist.md");

    expect(incidentAuthority).toContain("## Purpose");
    expect(incidentAuthority).toContain("## Authority Boundaries");
    expect(incidentAuthority).toContain("## Current Signal Surfaces");
    expect(incidentAuthority).toContain("## Incident Triggers");
    expect(incidentAuthority).toContain("## First Response Route");
    expect(incidentAuthority).toContain("## Escalation And Ownership");
    expect(incidentAuthority).toContain("## Known Gaps");

    expect(hostedPass).toContain("## Status");
    expect(hostedPass).toContain("## Upstream Authority Inputs");
    expect(hostedPass).toContain("## Hosted Target Set");
    expect(hostedPass).toContain("## Reviewed Env Surfaces");
    expect(hostedPass).toContain("## Hosted Callback And Bootstrap Path");
    expect(hostedPass).toContain("## Operator-Reviewed Verification");
    expect(hostedPass).toContain("## Consumer-First Rollback Path");
    expect(hostedPass).toContain("## Result And Remaining Limits");
    expect(hostedPass).toContain("NEXT_PUBLIC_IDENTITY_SUPABASE_URL");
    expect(hostedPass).toContain("IDENTITY_SUPABASE_SERVICE_ROLE_KEY");
    expect(hostedPass).toContain(
      "`unuidentity signup/login -> /auth/callback -> /auth/finalize -> POST /auth/bootstrap`",
    );

    expect(rehearsal).toContain("identity-production-cutover-hosted-pass.md");
    expect(launchChecklist).toContain(
      "incident-observability-authority.md",
    );
  });
});
