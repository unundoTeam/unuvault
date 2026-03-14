# Blackbox (黑匣子) Phase 1 Implementation Plan

> Status: Reference draft only. Do not use this as the canonical execution plan.
> The active engineering baseline is `docs/architecture/0000-phase1-execution-baseline.md` plus `docs/superpowers/plans/2026-03-14-chinese-password-manager-phase1-roadmap.md`.
> Keep this document only for reusable ideas that are not in conflict with the roadmap.

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build phase 1 of Blackbox, a public cloud password manager for Chinese-speaking technical users with browser extension, web vault, and iPhone support, using a Bitwarden-inspired baseline and shipping the security-first migration loop first.

**Architecture:** Start from a product workspace that keeps web, browser extension, iPhone, and API work in one coordinated root while borrowing the domain model and crypto expectations from Bitwarden. Deliver a thin but complete vertical slice: account creation, browser import, save/autofill, sync, iPhone unlock/autofill, and visible trust surfaces.

**Tech Stack:** TypeScript, Node.js, PostgreSQL, WebExtensions API, Swift, Docker, shared domain packages, end-to-end encryption primitives

---

## Chunk 1: Foundations

### Task 1: Create the workspace skeleton and architectural guardrails

**Files:**
- Create: `README.md`
- Create: `docs/architecture/0001-phase1-scope.md`
- Create: `apps/api/README.md`
- Create: `apps/web/README.md`
- Create: `apps/browser-extension/README.md`
- Create: `apps/ios/README.md`
- Create: `packages/domain/README.md`
- Create: `packages/security/README.md`

- [ ] **Step 1: Write the failing scope test as a checklist**

```md
- launch includes web, browser extension, and iPhone
- launch excludes Android, passkeys, teams, and family sharing
- security and trust surfaces are first-class requirements
- browser-native migration is the primary adoption path
```

- [ ] **Step 2: Save the scope and workspace layout**

```md
# Workspace layout

- apps/api: account, vault, sync, devices, import APIs
- apps/web: onboarding, vault management, trust center
- apps/browser-extension: autofill, save/update, popup
- apps/ios: unlock, search, iOS AutoFill
- packages/domain: shared item schemas and validators
- packages/security: crypto interfaces and trust copy
```

- [ ] **Step 3: Run the docs check**

Run: `test -f README.md && test -f docs/architecture/0001-phase1-scope.md && echo OK`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add README.md docs/architecture/0001-phase1-scope.md apps packages
git commit -m "docs: define phase1 workspace and scope"
```

### Task 2: Define shared vault and security contracts before app work starts

**Files:**
- Create: `packages/domain/src/vault-item.ts`
- Create: `packages/domain/src/device-session.ts`
- Create: `packages/security/src/security-model.ts`
- Create: `packages/domain/tests/vault-item.spec.ts`
- Create: `packages/security/tests/security-model.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { normalizeVaultItem } from "../src/vault-item";

describe("normalizeVaultItem", () => {
  it("accepts website login items and rejects unsupported types", () => {
    expect(
      normalizeVaultItem({
        type: "login",
        title: "GitHub",
        username: "alice",
        password: "secret",
        url: "https://github.com/login",
      }).type,
    ).toBe("login");
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { describeSecurityModel } from "../src/security-model";

describe("describeSecurityModel", () => {
  it("returns user-facing copy for the trust center", () => {
    expect(describeSecurityModel().canServerReadVault).toBe(false);
  });
});
```

- [ ] **Step 2: Write the minimal implementation**

```ts
export type VaultItem = {
  type: "login";
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  favorite?: boolean;
};

export function normalizeVaultItem(input: VaultItem): VaultItem {
  if (input.type !== "login") {
    throw new Error("unsupported vault item type");
  }

  return {
    ...input,
    title: input.title.trim(),
    username: input.username.trim(),
    url: input.url?.trim(),
  };
}
```

```ts
export function describeSecurityModel() {
  return {
    canServerReadVault: false,
    requiresPrimaryCredential: true,
    recoveryIsLimited: true,
  };
}
```

- [ ] **Step 3: Run the shared-package tests**

Run: `pnpm vitest packages/domain/tests/vault-item.spec.ts packages/security/tests/security-model.spec.ts`
Expected: both tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/domain packages/security
git commit -m "feat: define shared vault and security contracts"
```

## Chunk 2: Account, Vault, and Trust Base

### Task 3: Build the account, vault, and device APIs first

**Files:**
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/routes/vault.ts`
- Create: `apps/api/src/routes/devices.ts`
- Create: `apps/api/src/services/import-report.ts`
- Create: `apps/api/tests/auth.spec.ts`
- Create: `apps/api/tests/vault.spec.ts`
- Create: `apps/api/tests/devices.spec.ts`

- [ ] **Step 1: Write the failing API tests**

```ts
import request from "supertest";
import { app } from "../src/app";

it("creates an account", async () => {
  const response = await request(app).post("/auth/register").send({
    email: "alice@example.com",
    passwordHint: "personal",
  });

  expect(response.status).toBe(201);
});
```

```ts
it("lists device sessions for the signed-in user", async () => {
  const response = await request(app).get("/devices").set("authorization", "Bearer token");
  expect(response.status).toBe(200);
});
```

- [ ] **Step 2: Implement the minimal routes**

```ts
router.post("/auth/register", async (req, res) => {
  const account = await authService.register(req.body);
  res.status(201).json(account);
});

router.get("/devices", async (req, res) => {
  const devices = await deviceService.listForUser(req.user.id);
  res.status(200).json(devices);
});
```

- [ ] **Step 3: Run the API test set**

Run: `pnpm vitest apps/api/tests/auth.spec.ts apps/api/tests/vault.spec.ts apps/api/tests/devices.spec.ts`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/api
git commit -m "feat: add phase1 account vault and device APIs"
```

### Task 4: Build the web onboarding and trust shell

**Files:**
- Create: `apps/web/src/routes/register.tsx`
- Create: `apps/web/src/routes/vault.tsx`
- Create: `apps/web/src/routes/security.tsx`
- Create: `apps/web/src/components/import/import-report.tsx`
- Create: `apps/web/src/components/security/device-list.tsx`
- Create: `apps/web/tests/register.spec.tsx`
- Create: `apps/web/tests/security.spec.tsx`

- [ ] **Step 1: Write the failing web tests**

```tsx
import { render, screen } from "@testing-library/react";
import { RegisterPage } from "../src/routes/register";

it("shows the security-first onboarding copy", () => {
  render(<RegisterPage />);
  expect(screen.getByText("A safer home for your passwords")).toBeInTheDocument();
});
```

```tsx
import { render, screen } from "@testing-library/react";
import { SecurityPage } from "../src/routes/security";

it("shows devices and recent sessions", () => {
  render(<SecurityPage />);
  expect(screen.getByText("Devices")).toBeInTheDocument();
});
```

- [ ] **Step 2: Implement the minimal pages**

```tsx
export function RegisterPage() {
  return (
    <main>
      <h1>A safer home for your passwords</h1>
      <p>Move out of browser-native storage without losing momentum.</p>
    </main>
  );
}
```

```tsx
export function SecurityPage() {
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

- [ ] **Step 3: Run the web test set**

Run: `pnpm vitest apps/web/tests/register.spec.tsx apps/web/tests/security.spec.tsx`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat: add onboarding vault and trust shell"
```

## Chunk 3: Migration and Browser Workflow

### Task 5: Implement the browser-import migration funnel

**Files:**
- Create: `apps/api/src/routes/import.ts`
- Create: `apps/web/src/routes/import.tsx`
- Create: `apps/web/src/components/import/browser-import-form.tsx`
- Create: `apps/web/src/components/import/import-summary.tsx`
- Create: `apps/web/tests/import.spec.tsx`
- Create: `apps/api/tests/import.spec.ts`

- [ ] **Step 1: Write the failing import tests**

```tsx
import { render, screen } from "@testing-library/react";
import { ImportPage } from "../src/routes/import";

it("guides the user through browser import", () => {
  render(<ImportPage />);
  expect(screen.getByText("Import from Chrome, Edge, or Safari")).toBeInTheDocument();
});
```

```ts
it("returns an import report with totals and duplicates", async () => {
  const response = await request(app).post("/import/browser").send({ browser: "chrome", rows: [] });
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty("duplicates");
});
```

- [ ] **Step 2: Implement the minimal import path**

```ts
router.post("/import/browser", async (req, res) => {
  const report = await importService.importBrowserDump(req.user.id, req.body);
  res.status(200).json(report);
});
```

```tsx
export function ImportPage() {
  return (
    <main>
      <h1>Import from Chrome, Edge, or Safari</h1>
      <p>Bring your browser passwords in without rebuilding everything by hand.</p>
    </main>
  );
}
```

- [ ] **Step 3: Run import tests**

Run: `pnpm vitest apps/web/tests/import.spec.tsx apps/api/tests/import.spec.ts`
Expected: both tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/import.ts apps/web/src/routes/import.tsx apps/web/src/components/import apps/web/tests/import.spec.tsx apps/api/tests/import.spec.ts
git commit -m "feat: add browser import migration flow"
```

### Task 6: Ship browser save, autofill, and update flows

**Files:**
- Create: `apps/browser-extension/src/content/autofill.ts`
- Create: `apps/browser-extension/src/content/save-prompt.ts`
- Create: `apps/browser-extension/src/popup/popup.tsx`
- Create: `apps/browser-extension/src/background/sync.ts`
- Create: `apps/browser-extension/tests/autofill.spec.ts`
- Create: `apps/browser-extension/tests/save-prompt.spec.ts`

- [ ] **Step 1: Write the failing browser-extension tests**

```ts
import { describe, expect, it } from "vitest";
import { shouldOfferAutofill } from "../src/content/autofill";

describe("shouldOfferAutofill", () => {
  it("offers autofill on detected login forms", () => {
    expect(shouldOfferAutofill({ hasPasswordField: true })).toBe(true);
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { shouldPromptToSave } from "../src/content/save-prompt";

describe("shouldPromptToSave", () => {
  it("prompts when a new credential is submitted", () => {
    expect(shouldPromptToSave({ submitted: true, knownCredential: false })).toBe(true);
  });
});
```

- [ ] **Step 2: Implement the minimal extension logic**

```ts
export function shouldOfferAutofill(input: { hasPasswordField: boolean }) {
  return input.hasPasswordField;
}
```

```ts
export function shouldPromptToSave(input: { submitted: boolean; knownCredential: boolean }) {
  return input.submitted && !input.knownCredential;
}
```

- [ ] **Step 3: Run the browser-extension tests**

Run: `pnpm vitest apps/browser-extension/tests/autofill.spec.ts apps/browser-extension/tests/save-prompt.spec.ts`
Expected: both tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/browser-extension
git commit -m "feat: add browser autofill and save flows"
```

## Chunk 4: iPhone and Launch Trust Loop

### Task 7: Add iPhone sign-in, unlock, search, and AutoFill onboarding

**Files:**
- Create: `apps/ios/App/Sources/Features/Auth/LoginView.swift`
- Create: `apps/ios/App/Sources/Features/Vault/VaultListView.swift`
- Create: `apps/ios/App/Sources/Features/Autofill/AutofillOnboardingView.swift`
- Create: `apps/ios/App/Tests/LoginViewTests.swift`
- Create: `apps/ios/App/Tests/AutofillOnboardingTests.swift`

- [ ] **Step 1: Write the failing iPhone tests**

```swift
func testLoginViewShowsSecurityMessage() {
    let view = LoginView()
    XCTAssertTrue(view.body.debugDescription.contains("securely synced"))
}
```

```swift
func testAutofillOnboardingShowsEnableSteps() {
    let view = AutofillOnboardingView()
    XCTAssertTrue(view.body.debugDescription.contains("Enable AutoFill"))
}
```

- [ ] **Step 2: Implement the minimal iPhone views**

```swift
struct LoginView: View {
    var body: some View {
        VStack {
            Text("Your passwords, securely synced")
        }
    }
}
```

```swift
struct AutofillOnboardingView: View {
    var body: some View {
        VStack {
            Text("Enable AutoFill")
            Text("Turn on AutoFill in iPhone settings to use saved logins in apps and Safari.")
        }
    }
}
```

- [ ] **Step 3: Run the iPhone test set**

Run: `xcodebuild test -scheme App -destination 'platform=iOS Simulator,name=iPhone 16'`
Expected: LoginViewTests and AutofillOnboardingTests pass

- [ ] **Step 4: Commit**

```bash
git add apps/ios
git commit -m "feat: add iphone login vault and autofill onboarding"
```

### Task 8: Add trust-center polish and launch readiness checks

**Files:**
- Create: `apps/web/src/components/security/recent-activity.tsx`
- Create: `apps/web/src/components/security/recovery-guidance.tsx`
- Create: `docs/launch/phase1-qa-matrix.md`
- Create: `docs/launch/phase1-launch-checklist.md`
- Create: `docs/help/account-recovery.md`
- Create: `docs/help/import-troubleshooting.md`

- [ ] **Step 1: Write the launch-readiness checklist**

```md
- browser import works for Chrome, Edge, and Safari exports
- extension autofill works on top 20 target sites
- iPhone login, unlock, and AutoFill onboarding work on a fresh device
- device list and recent activity are visible in web vault
- recovery and import help docs exist in Chinese
```

- [ ] **Step 2: Implement the trust-center supporting content**

```tsx
export function RecoveryGuidance() {
  return (
    <section>
      <h2>Recovery</h2>
      <p>Keep your account recovery details in a place you control. Some recovery actions are intentionally limited.</p>
    </section>
  );
}
```

- [ ] **Step 3: Run the final verification**

Run: `pnpm vitest && pnpm lint && xcodebuild test -scheme App -destination 'platform=iOS Simulator,name=iPhone 16'`
Expected: all automated checks pass

- [ ] **Step 4: Commit**

```bash
git add apps/web docs
git commit -m "docs: prepare phase1 trust center and launch checklist"
```

Plan complete and saved to `docs/superpowers/plans/2026-03-14-chinese-password-manager-phase1.md`. Ready to execute?
