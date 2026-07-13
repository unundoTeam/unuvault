import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJson<T>(pathFromRepoRoot: string): T {
  return JSON.parse(
    readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8"),
  ) as T;
}

function readText(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot, pathFromRepoRoot), "utf8");
}

describe("auth boundary contract", () => {
  it("documents one repo-level identity and local-vault boundary guard", () => {
    const readme = readText("README.md");
    const boundaryDoc = readText("docs/architecture/0002-supabase-boundary.md");

    expect(readme).toContain("### Canonical Identity And Local Vault Boundary");
    expect(readme).toContain("Account identity answers who owns sync");
    expect(readme).toContain("Vault unlock answers whether this local session can release secrets");
    expect(readme).toContain("Device trust answers which clients may sync");
    expect(readme).toContain("`POST /auth/bootstrap` is the product identity bridge");
    expect(readme).toContain(
      "`unuidentity signup/login -> /auth/callback -> /auth/finalize -> POST /auth/bootstrap`",
    );
    expect(readme).toContain("extension identity sign-in -> `POST /auth/bootstrap`");
    expect(readme).toContain("`docs/architecture/0006-local-first-recovery-boundary.md`");
    expect(readme).toContain("`docs/architecture/0007-mac-companion-boundary.md`");
    expect(readme).toContain("`tests/auth-boundary-contract.spec.ts`");

    expect(boundaryDoc).toContain("## Auth Boundary Layers");
    expect(boundaryDoc).toContain("**Shared identity authority**");
    expect(boundaryDoc).toContain("**Product identity bridge**");
    expect(boundaryDoc).toContain("**Product runtime**");
    expect(boundaryDoc).toContain(
      "`POST /auth/bootstrap` before treating background auth state as `signed_in`",
    );
    expect(boundaryDoc).toContain("`tests/auth-boundary-contract.spec.ts`");
  });

  it("keeps the auth-owning workspace packages on stable test entrypoints", () => {
    const authPackages = [
      "apps/api/package.json",
      "apps/web/package.json",
      "apps/browser-extension/package.json",
    ];

    for (const packagePath of authPackages) {
      const manifest = readJson<PackageManifest>(packagePath);
      expect(manifest.scripts?.test, packagePath).toBe("vitest --run tests");
    }
  });

  it("pins the web auth path to callback finalize and bootstrap semantics", () => {
    const callbackRouteTest = readText("apps/web/tests/auth-callback-route.spec.ts");
    const finalizePageTest = readText("apps/web/tests/finalize-page.spec.tsx");
    const bootstrapProfileTest = readText(
      "apps/web/tests/bootstrap-unuvault-profile.spec.ts",
    );

    expect(callbackRouteTest).toContain("/auth/finalize");
    expect(finalizePageTest).toContain("redirect:/vault");
    expect(finalizePageTest).toContain('"/auth/bootstrap"');
    expect(finalizePageTest).toContain('authorization: "Bearer jwt-token"');
    expect(bootstrapProfileTest).toContain('bootstrapProfile).toHaveBeenCalledWith("identity-token")');
    expect(bootstrapProfileTest).toContain("missing_identity_session");
  });

  it("pins the api auth path to bearer bootstrap bridge semantics", () => {
    const defaultRouteTest = readText("apps/api/tests/auth-default-route.spec.ts");
    const bootstrapRouteTest = readText("apps/api/tests/auth-bootstrap.spec.ts");

    expect(defaultRouteTest).toContain('url: "/auth/bootstrap"');
    expect(defaultRouteTest).toContain('authorization: "Bearer test-token"');
    expect(bootstrapRouteTest).toContain("missing_bearer_token");
    expect(bootstrapRouteTest).toContain("invalid_token");
    expect(bootstrapRouteTest).toContain("bootstrap_failed");
  });

  it("pins the extension auth path to bootstrap-backed signed-in semantics", () => {
    const backgroundAuthTest = readText(
      "apps/browser-extension/tests/background-auth.spec.ts",
    );

    expect(backgroundAuthTest).toContain('status: "signed_in"');
    expect(backgroundAuthTest).toContain("bootstrapProfile");
    expect(backgroundAuthTest).toContain("stays signed out when bootstrapProfile fails");
    expect(backgroundAuthTest).toContain(
      "stays signed out when sign-in returns no access token",
    );
  });

  it("records the browser import report receipt without overstating import maturity", () => {
    const readme = readText("README.md");
    const baselineDoc = readText(
      "docs/architecture/0000-phase1-execution-baseline.md",
    );
    const boundaryDoc = readText("docs/architecture/0002-supabase-boundary.md");
    const apiMap = readText("docs/architecture/0004-rest-api-map.md");
    const clientCoreDesign = readText(
      "docs/superpowers/specs/2026-07-11-client-browser-import-core-design.md",
    );
    const compactReadme = readme.replace(/\s+/g, " ");
    const compactBaselineDoc = baselineDoc.replace(/\s+/g, " ");
    const compactBoundaryDoc = boundaryDoc.replace(/\s+/g, " ");
    const compactApiMap = apiMap.replace(/\s+/g, " ");
    const compactClientCoreDesign = clientCoreDesign.replace(/\s+/g, " ");

    expect(readme).toContain("recorded report receipt");
    expect(readme).toContain("does not accept raw CSV");
    expect(readme).toContain("does not prove vault item persistence");
    expect(readme).toContain("at-least-once");
    expect(compactReadme).toContain(
      "Bearer token -> authenticated identity user -> identity `account_id` -> `users_profile.account_id` -> `profile.id` -> `import_jobs.user_profile_id`",
    );

    expect(compactBaselineDoc).toContain(
      "non-UI client core, camelCase-to-wire mapper, API/client primitive, and authenticated recorded report receipt",
    );
    expect(compactBaselineDoc).toContain(
      "Drizzle, Tailwind CSS, WXT, and Playwright as planned framework choices",
    );
    expect(compactBaselineDoc).toContain(
      "They are not declared as direct, active dependencies",
    );
    expect(compactBaselineDoc).toContain(
      "are not requirements for the implemented runtime",
    );

    expect(boundaryDoc).toContain("does not accept raw CSV");
    expect(boundaryDoc).toContain("does not prove vault item persistence");
    expect(boundaryDoc).toContain("at-least-once");
    expect(compactBoundaryDoc).toContain(
      "token -> `account_id` -> `users_profile.account_id` -> `profile.id` -> `import_jobs.user_profile_id`",
    );

    expect(apiMap).toContain("## Current Route Maturity");
    expect(compactApiMap).toContain("authenticated recorded report receipt");
    expect(compactApiMap).toContain("does not accept raw CSV");
    expect(compactApiMap).toContain("does not prove vault item persistence");

    expect(clientCoreDesign).toContain("## Current Implementation Status");
    expect(clientCoreDesign).toContain("camelCase-to-wire mapper");
    expect(clientCoreDesign).toContain("at-least-once");
    expect(clientCoreDesign).toContain("does not accept raw CSV");
    expect(clientCoreDesign).toContain("does not prove vault item persistence");
    expect(compactClientCoreDesign).toContain(
      "UI call site, worker isolation, progress, cancellation, and representative Argon2 performance evidence",
    );
    expect(compactClientCoreDesign).toContain(
      "`/vault/sync` linkage, database `CHECK` constraints and RLS, idempotency, and an end-to-end imported-item receipt",
    );
  });
});
