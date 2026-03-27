# unuvault README Refresh Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the repository homepage so `unuvault` reads like a credible product landing page and a useful developer entrypoint at the same time.

**Architecture:** Keep the change narrowly scoped to repository metadata and homepage copy. Update the root README and root package description only, using the existing phase-1 docs as the source of truth for product scope and repository structure.

**Tech Stack:** Markdown, JSON, pnpm workspace metadata

---

## Chunk 1: Homepage Refresh

### Task 1: Rewrite the root README structure and copy

**Files:**
- Modify: `README.md`
- Reference: `docs/superpowers/specs/2026-03-14-unuvault-readme-refresh-design.md`
- Reference: `docs/architecture/0000-phase1-execution-baseline.md`

- [ ] **Step 1: Write the failing content checklist**

```md
- README opens with a product-level one-line positioning statement
- README includes a short Chinese support sentence
- README explains why unuvault exists before repo structure details
- README gives contributors a clear path into apps, packages, infra, and docs
```

- [ ] **Step 2: Rewrite the README**

```md
# unuvault

One-line product positioning
Short Chinese support line
Why unuvault
Phase 1 scope
Repository guide
Development
Source of truth
Current status
```

- [ ] **Step 3: Verify the README shape**

Run: `sed -n '1,220p' README.md`
Expected: the new section order and `unuvault` naming are visible

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: refresh unuvault repository homepage"
```

### Task 2: Tighten root package metadata

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Write the failing metadata checklist**

```md
- root package has a descriptive `description`
- package name remains `unuvault`
```

- [ ] **Step 2: Add the root package description**

```json
{
  "name": "unuvault",
  "description": "Chinese-first public cloud password manager workspace"
}
```

- [ ] **Step 3: Verify metadata**

Run: `node -p "const pkg=require('./package.json'); [pkg.name, pkg.description].join(' | ')"`
Expected: `unuvault | ...`

- [ ] **Step 4: Run minimal verification**

Run: `git diff --check && ./node_modules/.bin/pnpm vitest apps/api/tests/routes.spec.ts packages/domain/tests/db-types.spec.ts`
Expected: no diff errors and both tests pass

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore: tighten unuvault root metadata"
```
