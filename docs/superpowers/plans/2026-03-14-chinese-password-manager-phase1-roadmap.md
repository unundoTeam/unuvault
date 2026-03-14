# Blackbox (黑匣子) Phase 1 Roadmap

> Status: Canonical engineering execution plan as of 2026-03-14.
> Product intent comes from `docs/superpowers/specs/2026-03-14-chinese-password-manager-phase1-design.md`.
> If this roadmap conflicts with the earlier draft implementation plan, follow `docs/architecture/0000-phase1-execution-baseline.md` and this roadmap.

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver phase 1 of Blackbox, a Chinese-first public cloud password manager with browser extension, web vault, and iPhone support, in a sequence that prioritizes security credibility, migration, and daily usability.

**Architecture:** Build the product as a monorepo with four apps (`api`, `web`, `browser-extension`, `ios`) on top of Supabase for Auth and Postgres, while keeping core vault business logic in a dedicated TypeScript API. Ship vertical milestones that each produce something testable and user-facing instead of completing one platform end to end before the others.

**Tech Stack:** pnpm workspace, Node.js, TypeScript, Fastify, PostgreSQL, Supabase, Drizzle, Next.js, React, Tailwind CSS, WXT, SwiftUI, Vitest, Playwright, XCTest

---

## File Structure Map

- `README.md`
  - workspace overview and quickstart
- `docs/superpowers/specs/2026-03-14-chinese-password-manager-phase1-design.md`
  - approved product design
- `docs/architecture/`
  - technical decisions, milestone notes, API contracts
- `docs/launch/`
  - QA matrix, launch checklist, operational runbook
- `apps/api/`
  - account, vault, devices, imports, activity APIs
- `apps/web/`
  - onboarding, vault management, trust center
- `apps/browser-extension/`
  - autofill, save/update prompts, popup UI
- `apps/ios/`
  - login, unlock, vault list, AutoFill onboarding
- `packages/domain/`
  - shared schemas and validation
- `packages/security/`
  - crypto envelopes, unlock policy, trust model
- `packages/api-client/`
  - typed REST clients for shared use
- `infra/supabase/`
  - migrations, policies, local setup

## Chunk 1: Milestone M1 - Security and Data Foundation

### Task 1: Establish the workspace skeleton and shared package boundaries

**Files:**
- Create: `README.md`
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `apps/api/package.json`
- Create: `apps/web/package.json`
- Create: `apps/browser-extension/package.json`
- Create: `packages/domain/package.json`
- Create: `packages/security/package.json`
- Create: `packages/api-client/package.json`
- Create: `docs/architecture/0001-workspace-layout.md`

- [ ] **Step 1: Write the failing workspace checklist**

```md
- apps directory exists for api, web, browser-extension, and ios
- packages directory exists for domain, security, and api-client
- root workspace tooling is shared instead of duplicated
```

- [ ] **Step 2: Create the root workspace manifests**

```yaml
packages:
  - apps/*
  - packages/*
```

```json
{
  "private": true,
  "scripts": {
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  }
}
```

- [ ] **Step 3: Run the workspace validation**

Run: `test -f pnpm-workspace.yaml && test -f package.json && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add README.md pnpm-workspace.yaml package.json tsconfig.base.json apps packages docs/architecture/0001-workspace-layout.md
git commit -m "chore: bootstrap workspace layout"
```

### Task 2: Define the phase-1 database schema and Supabase boundary

**Files:**
- Create: `infra/supabase/migrations/0001_phase1_core.sql`
- Create: `infra/supabase/README.md`
- Create: `docs/architecture/0002-supabase-boundary.md`
- Create: `packages/domain/src/db-types.ts`
- Create: `packages/domain/tests/db-types.spec.ts`

- [ ] **Step 1: Write the failing schema contract test**

```ts
import { describe, expect, it } from "vitest";
import { phase1Tables } from "../src/db-types";

describe("phase1Tables", () => {
  it("includes the five core phase1 tables", () => {
    expect(phase1Tables).toEqual([
      "users_profile",
      "vault_items",
      "device_sessions",
      "import_jobs",
      "activity_events",
    ]);
  });
});
```

- [ ] **Step 2: Write the migration and contract map**

```sql
create table users_profile (...);
create table vault_items (...);
create table device_sessions (...);
create table import_jobs (...);
create table activity_events (...);
```

```ts
export const phase1Tables = [
  "users_profile",
  "vault_items",
  "device_sessions",
  "import_jobs",
  "activity_events",
] as const;
```

- [ ] **Step 3: Run the schema contract test**

Run: `pnpm vitest packages/domain/tests/db-types.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add infra/supabase docs/architecture/0002-supabase-boundary.md packages/domain
git commit -m "feat: define phase1 schema and supabase boundary"
```

### Task 3: Lock the client-side security model before app implementation

**Files:**
- Create: `packages/security/src/vault-envelope.ts`
- Create: `packages/security/src/unlock-policy.ts`
- Create: `packages/security/src/risk-actions.ts`
- Create: `packages/security/tests/unlock-policy.spec.ts`
- Create: `docs/architecture/0003-client-crypto-boundary.md`

- [ ] **Step 1: Write the failing security tests**

```ts
import { describe, expect, it } from "vitest";
import { isHighRiskAction } from "../src/risk-actions";

describe("isHighRiskAction", () => {
  it("marks export as high risk", () => {
    expect(isHighRiskAction("vault_export")).toBe(true);
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { shouldRequirePrimaryPassword } from "../src/unlock-policy";

describe("shouldRequirePrimaryPassword", () => {
  it("requires primary password for revoke-device", () => {
    expect(shouldRequirePrimaryPassword("revoke_device")).toBe(true);
  });
});
```

- [ ] **Step 2: Implement the minimal security policy**

```ts
export function isHighRiskAction(action: string) {
  return ["vault_export", "revoke_device", "change_primary_password"].includes(action);
}
```

```ts
export function shouldRequirePrimaryPassword(action: string) {
  return isHighRiskAction(action);
}
```

- [ ] **Step 3: Run the security package tests**

Run: `pnpm vitest packages/security/tests/unlock-policy.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/security docs/architecture/0003-client-crypto-boundary.md
git commit -m "feat: define client crypto and unlock policy"
```

## Chunk 2: Milestone M2 - API and Web Trust Shell

### Task 4: Build the phase-1 REST API skeleton by business domain

**Files:**
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/routes/vault.ts`
- Create: `apps/api/src/routes/devices.ts`
- Create: `apps/api/src/routes/imports.ts`
- Create: `apps/api/src/routes/activity.ts`
- Create: `apps/api/tests/routes.spec.ts`
- Create: `docs/architecture/0004-rest-api-map.md`

- [ ] **Step 1: Write the failing route smoke test**

```ts
import request from "supertest";
import { app } from "../src/app";

it("exposes the phase1 route groups", async () => {
  const response = await request(app).get("/health");
  expect(response.status).toBe(200);
});
```

- [ ] **Step 2: Implement the minimal route skeleton**

```ts
app.get("/health", async () => ({ ok: true }));
app.register(authRoutes, { prefix: "/auth" });
app.register(vaultRoutes, { prefix: "/vault" });
app.register(deviceRoutes, { prefix: "/devices" });
app.register(importRoutes, { prefix: "/imports" });
app.register(activityRoutes, { prefix: "/activity" });
```

- [ ] **Step 3: Run the API smoke test**

Run: `pnpm vitest apps/api/tests/routes.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api docs/architecture/0004-rest-api-map.md
git commit -m "feat: scaffold phase1 api route groups"
```

### Task 5: Build the web onboarding and trust-center shell

**Files:**
- Create: `apps/web/src/app/register/page.tsx`
- Create: `apps/web/src/app/vault/page.tsx`
- Create: `apps/web/src/app/security/page.tsx`
- Create: `apps/web/src/components/security/trust-summary.tsx`
- Create: `apps/web/tests/security-page.spec.tsx`
- Create: `packages/ui-copy/README.md`

- [ ] **Step 1: Write the failing web trust test**

```tsx
import { render, screen } from "@testing-library/react";
import SecurityPage from "../src/app/security/page";

it("shows the trust center entry points", () => {
  render(<SecurityPage />);
  expect(screen.getByText("Devices")).toBeInTheDocument();
  expect(screen.getByText("Recent activity")).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement the minimal trust shell**

```tsx
export default function SecurityPage() {
  return (
    <main>
      <h1>Security</h1>
      <section>
        <h2>Devices</h2>
      </section>
      <section>
        <h2>Recent activity</h2>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Run the web test**

Run: `pnpm vitest apps/web/tests/security-page.spec.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web packages/ui-copy
git commit -m "feat: add onboarding and trust-center shell"
```

## Chunk 3: Milestone M3 - Browser Daily-Use Loop

### Task 6: Ship the browser-extension login, popup, and autofill foundations

**Files:**
- Create: `apps/browser-extension/src/background/auth.ts`
- Create: `apps/browser-extension/src/content/autofill.ts`
- Create: `apps/browser-extension/src/content/save-prompt.ts`
- Create: `apps/browser-extension/src/popup/App.tsx`
- Create: `apps/browser-extension/tests/autofill.spec.ts`
- Create: `apps/browser-extension/tests/popup.spec.tsx`

- [ ] **Step 1: Write the failing extension tests**

```ts
import { describe, expect, it } from "vitest";
import { shouldOfferAutofill } from "../src/content/autofill";

describe("shouldOfferAutofill", () => {
  it("returns true when a password field is detected", () => {
    expect(shouldOfferAutofill({ hasPasswordField: true })).toBe(true);
  });
});
```

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "../src/popup/App";

it("shows the vault search field", () => {
  render(<App />);
  expect(screen.getByPlaceholderText("Search vault")).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement the minimal extension loop**

```ts
export function shouldOfferAutofill(input: { hasPasswordField: boolean }) {
  return input.hasPasswordField;
}
```

```tsx
export function App() {
  return <input placeholder="Search vault" />;
}
```

- [ ] **Step 3: Run the extension tests**

Run: `pnpm vitest apps/browser-extension/tests/autofill.spec.ts apps/browser-extension/tests/popup.spec.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/browser-extension
git commit -m "feat: add extension autofill and popup foundation"
```

### Task 7: Add vault CRUD and sync endpoints used by web and extension

**Files:**
- Create: `apps/api/src/services/vault-service.ts`
- Create: `apps/api/src/routes/vault-sync.ts`
- Create: `apps/api/tests/vault-sync.spec.ts`
- Create: `packages/api-client/src/vault.ts`
- Create: `packages/api-client/tests/vault-client.spec.ts`

- [ ] **Step 1: Write the failing sync tests**

```ts
import request from "supertest";
import { app } from "../src/app";

it("returns sync payload with updated_items and conflicts", async () => {
  const response = await request(app).post("/vault/sync").send({ changed_items: [] });
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty("updated_items");
  expect(response.body).toHaveProperty("conflicts");
});
```

- [ ] **Step 2: Implement the minimal sync route and client**

```ts
router.post("/sync", async (_req, reply) => {
  return reply.send({
    server_time: new Date().toISOString(),
    updated_items: [],
    deleted_item_ids: [],
    conflicts: [],
  });
});
```

- [ ] **Step 3: Run the sync tests**

Run: `pnpm vitest apps/api/tests/vault-sync.spec.ts packages/api-client/tests/vault-client.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api packages/api-client
git commit -m "feat: add shared vault sync contract"
```

## Chunk 4: Milestone M4 - Migration and iPhone Credibility

### Task 8: Build browser import and migration reporting

**Files:**
- Create: `apps/api/src/services/import-service.ts`
- Create: `apps/web/src/app/import/page.tsx`
- Create: `apps/web/src/components/import/report.tsx`
- Create: `apps/api/tests/imports.spec.ts`
- Create: `apps/web/tests/import-page.spec.tsx`

- [ ] **Step 1: Write the failing import tests**

```ts
import request from "supertest";
import { app } from "../src/app";

it("creates a browser import job", async () => {
  const response = await request(app).post("/imports/browser").send({ source: "chrome", payload: [] });
  expect(response.status).toBe(202);
});
```

```tsx
import { render, screen } from "@testing-library/react";
import ImportPage from "../src/app/import/page";

it("shows browser import choices", () => {
  render(<ImportPage />);
  expect(screen.getByText("Import from Chrome, Edge, or Safari")).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement the minimal import workflow**

```ts
router.post("/browser", async (_req, reply) => {
  return reply.status(202).send({ job_id: "job_123", status: "pending" });
});
```

```tsx
export default function ImportPage() {
  return (
    <main>
      <h1>Import from Chrome, Edge, or Safari</h1>
    </main>
  );
}
```

- [ ] **Step 3: Run the import tests**

Run: `pnpm vitest apps/api/tests/imports.spec.ts apps/web/tests/import-page.spec.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api apps/web
git commit -m "feat: add browser import workflow"
```

### Task 9: Add iPhone login, unlock, and AutoFill onboarding

**Files:**
- Create: `apps/ios/App/Sources/Features/Auth/LoginView.swift`
- Create: `apps/ios/App/Sources/Features/Vault/VaultListView.swift`
- Create: `apps/ios/App/Sources/Features/Autofill/AutofillOnboardingView.swift`
- Create: `apps/ios/App/Tests/LoginViewTests.swift`
- Create: `apps/ios/App/Tests/AutofillOnboardingViewTests.swift`

- [ ] **Step 1: Write the failing iPhone tests**

```swift
func testLoginViewShowsSecureSyncMessage() {
    let view = LoginView()
    XCTAssertTrue(view.body.debugDescription.contains("securely synced"))
}
```

```swift
func testAutofillOnboardingShowsEnableAutofill() {
    let view = AutofillOnboardingView()
    XCTAssertTrue(view.body.debugDescription.contains("Enable AutoFill"))
}
```

- [ ] **Step 2: Implement the minimal iPhone views**

```swift
struct LoginView: View {
    var body: some View {
        Text("Your passwords, securely synced")
    }
}
```

```swift
struct AutofillOnboardingView: View {
    var body: some View {
        Text("Enable AutoFill")
    }
}
```

- [ ] **Step 3: Run the iPhone tests**

Run: `xcodebuild test -scheme App -destination 'platform=iOS Simulator,name=iPhone 16'`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/ios
git commit -m "feat: add iphone login and autofill onboarding"
```

## Chunk 5: Milestone M5 - Launch Readiness

### Task 10: Add devices, activity, and high-risk trust flows to launch quality

**Files:**
- Create: `apps/api/tests/devices.spec.ts`
- Create: `apps/api/tests/activity.spec.ts`
- Create: `apps/web/src/components/security/device-list.tsx`
- Create: `apps/web/src/components/security/recent-activity.tsx`
- Create: `docs/launch/phase1-qa-matrix.md`
- Create: `docs/launch/phase1-launch-checklist.md`
- Create: `docs/help/account-recovery.md`
- Create: `docs/help/import-troubleshooting.md`

- [ ] **Step 1: Write the failing trust-flow tests**

```ts
import request from "supertest";
import { app } from "../src/app";

it("lists devices for the current user", async () => {
  const response = await request(app).get("/devices");
  expect(response.status).toBe(200);
});
```

```ts
it("lists recent activity for the current user", async () => {
  const response = await request(app).get("/activity/recent");
  expect(response.status).toBe(200);
});
```

- [ ] **Step 2: Implement the trust-surface UI and docs**

```tsx
export function DeviceList() {
  return (
    <section>
      <h2>Devices</h2>
    </section>
  );
}
```

```tsx
export function RecentActivity() {
  return (
    <section>
      <h2>Recent activity</h2>
    </section>
  );
}
```

- [ ] **Step 3: Run the full launch verification**

Run: `pnpm test && pnpm lint && xcodebuild test -scheme App -destination 'platform=iOS Simulator,name=iPhone 16'`
Expected: all automated checks pass

- [ ] **Step 4: Commit**

```bash
git add apps/api apps/web docs/launch docs/help
git commit -m "feat: finalize phase1 trust surfaces and launch checks"
```

Plan complete and saved to `docs/superpowers/plans/2026-03-14-chinese-password-manager-phase1-roadmap.md`. Ready to execute?
