# Unuvault Actions Node24 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the `unuvault` hosted GitHub Actions workflows off the deprecated Node 20 action runtime with the smallest possible workflow-only change.

**Architecture:** Keep the fix narrow and mechanical. Update only the official action versions in the existing `CI` and `iOS` workflows, leave job logic alone, and verify the upgrade by observing a fresh `main`-branch workflow run after push.

**Tech Stack:** GitHub Actions workflow YAML, git, GitHub CLI

---

### Task 1: Record the deprecation-driven workflow upgrade

**Files:**
- Create: `docs/superpowers/specs/2026-03-18-unuvault-actions-node24-upgrade-design.md`
- Create: `docs/superpowers/plans/2026-03-18-unuvault-actions-node24-upgrade.md`

- [ ] **Step 1: Capture the current warning source**

Record that the warning came from `actions/checkout@v4` and `actions/setup-node@v4` in the current
`unuvault` workflows.

- [ ] **Step 2: Capture the narrow validation target**

State that success means a fresh `CI` run on `main` still passes after the action-version upgrade.

### Task 2: Upgrade the workflow action versions

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/ios.yml`

- [ ] **Step 1: Upgrade the CI workflow actions**

Change `.github/workflows/ci.yml` to use:

```yaml
uses: actions/checkout@v5
uses: actions/setup-node@v6
```

- [ ] **Step 2: Upgrade the iOS workflow checkout action**

Change `.github/workflows/ios.yml` to use:

```yaml
uses: actions/checkout@v5
```

- [ ] **Step 3: Keep the rest of the workflows unchanged**

Do not change triggers, runner types, pnpm setup, test commands, or path filters.

### Task 3: Verify and publish the workflow-only upgrade

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/ios.yml`
- Create: `docs/superpowers/specs/2026-03-18-unuvault-actions-node24-upgrade-design.md`
- Create: `docs/superpowers/plans/2026-03-18-unuvault-actions-node24-upgrade.md`

- [ ] **Step 1: Inspect the local diff**

Run:

```bash
git -C ~/Code/unu/unuvault diff -- .github/workflows/ci.yml .github/workflows/ios.yml \
  docs/superpowers/specs/2026-03-18-unuvault-actions-node24-upgrade-design.md \
  docs/superpowers/plans/2026-03-18-unuvault-actions-node24-upgrade.md
```

Expected: only action version bumps and the two new docs appear.

- [ ] **Step 2: Stage and commit only the relevant files**

Run:

```bash
git -C ~/Code/unu/unuvault add .github/workflows/ci.yml .github/workflows/ios.yml \
  docs/superpowers/specs/2026-03-18-unuvault-actions-node24-upgrade-design.md \
  docs/superpowers/plans/2026-03-18-unuvault-actions-node24-upgrade.md
git -C ~/Code/unu/unuvault commit -m "ci: upgrade unuvault actions for node24"
```

- [ ] **Step 3: Push and observe the new run**

Run:

```bash
git -C ~/Code/unu/unuvault push origin main
gh run list --repo unundoTeam/unuvault --workflow CI --limit 5
```

Expected: a new `CI` run appears on branch `main` for the just-pushed commit and completes successfully.
