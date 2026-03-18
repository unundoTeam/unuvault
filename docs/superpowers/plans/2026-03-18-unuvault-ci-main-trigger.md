# Unuvault CI Main Trigger Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore push-triggered CI on `unundoTeam/unuvault` by making the workflow listen to the real default branch, `main`.

**Architecture:** Keep the fix narrow. Only update the workflow trigger branch and add a minimal spec/plan record so the migration follow-up has an explicit paper trail. Verify by pushing the change and checking that GitHub Actions records a new `CI` run on `main`.

**Tech Stack:** GitHub Actions workflow YAML, git, GitHub CLI

---

### Task 1: Record the migrated-branch fix

**Files:**
- Create: `docs/superpowers/specs/2026-03-18-unuvault-ci-main-trigger-design.md`
- Create: `docs/superpowers/plans/2026-03-18-unuvault-ci-main-trigger.md`

- [ ] **Step 1: Describe the mismatch**

Write down that the repository default branch is `main` while `.github/workflows/ci.yml` still
listens to `master` pushes.

- [ ] **Step 2: Record the validation target**

State that success means a new `CI` workflow run appears on `main` after the fix is pushed.

### Task 2: Narrow the workflow trigger to the real default branch

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Change the push trigger**

Replace `master` with `main` under `on.push.branches`.

- [ ] **Step 2: Leave the rest of the workflow alone**

Do not modify runner selection, install steps, lint, or test commands.

### Task 3: Verify and publish the fix

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `docs/superpowers/specs/2026-03-18-unuvault-ci-main-trigger-design.md`
- Create: `docs/superpowers/plans/2026-03-18-unuvault-ci-main-trigger.md`

- [ ] **Step 1: Inspect the local diff**

Run: `git -C ~/Code/unu/unuvault diff -- .github/workflows/ci.yml docs/superpowers/specs/2026-03-18-unuvault-ci-main-trigger-design.md docs/superpowers/plans/2026-03-18-unuvault-ci-main-trigger.md`

Expected: only the two new docs and the `master -> main` workflow trigger change appear.

- [ ] **Step 2: Commit only the relevant files**

Run:

```bash
git -C ~/Code/unu/unuvault add .github/workflows/ci.yml \
  docs/superpowers/specs/2026-03-18-unuvault-ci-main-trigger-design.md \
  docs/superpowers/plans/2026-03-18-unuvault-ci-main-trigger.md
git -C ~/Code/unu/unuvault commit -m "ci: trigger unuvault workflow on main"
```

- [ ] **Step 3: Push and observe the migrated workflow**

Run:

```bash
git -C ~/Code/unu/unuvault push origin main
gh run list --repo unundoTeam/unuvault --workflow CI --limit 5
```

Expected: a new `CI` run appears on branch `main` for the just-pushed commit.
