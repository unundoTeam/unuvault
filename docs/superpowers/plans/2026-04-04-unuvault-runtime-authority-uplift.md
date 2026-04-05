# Unuvault Runtime Authority Uplift Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-layer runtime authority route in `unuvault` so contributors can quickly find incident, observability, and production-readiness authority from the root README.

**Architecture:** Keep the root README lightweight and add one new routing document at `docs/operations/runtime-authority.md`. Pin the routing contract with one focused docs test so this uplift stays narrow and does not turn into review-gate or CI-policy work.

**Tech Stack:** Markdown docs, Vitest docs-contract coverage, existing root README and operations docs

---

## Chunk 1: Contract Test First

### Task 1: Add a failing runtime-authority contract test

**Files:**
- Create: `tests/runtime-authority-contract.spec.ts`
- Reference: `tests/auth-boundary-contract.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/runtime-authority-contract.spec.ts` to assert:

- `README.md` contains `## Runtime Authority`
- `README.md` links to `docs/operations/runtime-authority.md`
- `docs/operations/runtime-authority.md` contains:
  - `## Incident Authority`
  - `## Observability And Telemetry Status`
  - `## Production Readiness`
- the new hub explicitly says observability authority is still limited or incomplete

- [ ] **Step 2: Run the focused test to verify it fails**

Run:
```bash
./node_modules/.bin/vitest --run tests/runtime-authority-contract.spec.ts
```

Expected:
- FAIL because the README section and new operations hub do not exist yet

## Chunk 2: Add The Operations Authority Hub

### Task 2: Create the routing document

**Files:**
- Create: `docs/operations/runtime-authority.md`
- Reference: `docs/operations/identity-production-cutover-rehearsal.md`
- Reference: `docs/operations/supabase-env-mapping.md`
- Reference: `docs/architecture/0002-supabase-boundary.md`
- Reference: `docs/architecture/0003-client-crypto-boundary.md`
- Reference: `docs/launch/phase1-launch-checklist.md`

- [ ] **Step 1: Write the minimal authority hub**

Create `docs/operations/runtime-authority.md` with these sections:

- `# Runtime Authority`
- `## Purpose`
- `## Authority Boundaries`
- `## Incident Authority`
- `## Observability And Telemetry Status`
- `## Production Readiness`
- `## Current Gaps`

Keep it as a routing page. Link to the existing deeper docs instead of copying
their full content.

- [ ] **Step 2: Keep observability wording honest**

Make the observability section explicitly say that `unuvault` does not yet
expose a standalone telemetry or observability authority page, and describe the
current nearest authority route instead.

- [ ] **Step 3: Re-run the focused test**

Run:
```bash
./node_modules/.bin/vitest --run tests/runtime-authority-contract.spec.ts
```

Expected:
- still FAIL because `README.md` has not been updated yet, or PASS if the test only targets the hub and it is complete

## Chunk 3: Add The README First-Layer Route

### Task 3: Update the root README

**Files:**
- Modify: `README.md`
- Reference: `docs/operations/runtime-authority.md`

- [ ] **Step 1: Add a compact `Runtime Authority` section**

Add `## Runtime Authority` after the `Verification` section and before
`Review Model`.

The section should:

- link to `docs/operations/runtime-authority.md`
- summarize the three routing categories in 1-3 bullets:
  - incident and auth-bridge rollback authority
  - observability or telemetry status
  - production-readiness authority

- [ ] **Step 2: Keep README scope tight**

Do not move deep operational details into `README.md`. The README should stay a
first-layer route, not become a full runbook.

- [ ] **Step 3: Re-run the focused contract test**

Run:
```bash
./node_modules/.bin/vitest --run tests/runtime-authority-contract.spec.ts
```

Expected:
- PASS

## Chunk 4: Regression Checks

### Task 4: Verify adjacent README contracts still hold

**Files:**
- Test: `tests/runtime-authority-contract.spec.ts`
- Test: `tests/auth-boundary-contract.spec.ts`
- Test: `tests/workspace-entrypoints.spec.ts`

- [ ] **Step 1: Run the nearby docs and README contract tests**

Run:
```bash
./node_modules/.bin/vitest --run tests/runtime-authority-contract.spec.ts tests/auth-boundary-contract.spec.ts tests/workspace-entrypoints.spec.ts
```

Expected:
- PASS

- [ ] **Step 2: Run the repo-local minimum shell if the focused tests are green**

Run:
```bash
pnpm test
```

Expected:
- PASS

- [ ] **Step 3: Run the repo-local lint shell if the broader test run is green**

Run:
```bash
pnpm lint
```

Expected:
- PASS

- [ ] **Step 4: Commit**

```bash
git add README.md docs/operations/runtime-authority.md tests/runtime-authority-contract.spec.ts docs/superpowers/specs/2026-04-04-unuvault-runtime-authority-uplift-design.md docs/superpowers/plans/2026-04-04-unuvault-runtime-authority-uplift.md
git commit -m "docs: add unuvault runtime authority routing"
```
