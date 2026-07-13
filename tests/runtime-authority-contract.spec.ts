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

    expect(readme).toContain("### Runtime Authority");
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
    expect(runtimeAuthority).toContain("## Current Hosted Identity Status");
    expect(runtimeAuthority).toContain("production-landing-completion.md");
    expect(runtimeAuthority).toContain("consumer-cutover-checklist.md");
    expect(runtimeAuthority).toContain(
      "live-target change must be recorded through the upstream consumer cutover checklist",
    );
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

  it("keeps production operations honest about the next maturity gate", () => {
    const closeout = readText(
      "docs/operations/production-ops-observability-closeout.md",
    );

    expect(closeout).toContain("## Next Maturity Gate");
    expect(closeout).toContain("telemetry provider and retention policy");
    expect(closeout).toContain("alert delivery receipt");
    expect(closeout).toContain("named primary and backup responders");
    expect(closeout).toContain("Incident rehearsal record");
    expect(closeout).toContain("Status: `open`");
  });

  it("records the provider-neutral telemetry foundation without closing operations gates", () => {
    const telemetryContract = readText("docs/operations/telemetry-contract.md");
    const alertingPolicy = readText("docs/operations/alerting-policy.md");
    const rehearsalTemplate = readText(
      "docs/operations/incident-rehearsal-template.md",
    );
    const closeout = readText(
      "docs/operations/production-ops-observability-closeout.md",
    );

    expect(telemetryContract).toContain("provider-neutral");
    expect(telemetryContract).toContain("allowlist-only");
    expect(telemetryContract).toContain("Fastify route template");
    expect(telemetryContract).toContain("raw URL");
    expect(telemetryContract).toContain("default no-op sink");
    expect(telemetryContract).toContain("Provider/export status: `open`");

    expect(alertingPolicy).toContain("Test-alert delivery status: `open`");
    expect(alertingPolicy).toContain("Alert destination status: `open`");
    expect(alertingPolicy).toContain("Named responder status: `open`");

    expect(rehearsalTemplate).toContain("Rehearsal execution status: `open`");
    expect(rehearsalTemplate).toContain("Primary responder: `<open>`");
    expect(rehearsalTemplate).toContain("Backup responder: `<open>`");

    expect(closeout).toContain("telemetry-contract.md");
    expect(closeout).toContain("alerting-policy.md");
    expect(closeout).toContain("incident-rehearsal-template.md");
    expect(closeout).toContain("Status: `open`");
  });
});
