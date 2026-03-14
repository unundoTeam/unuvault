# iOS Build Artifact Ignore Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ignore and clean the `apps/ios/App/.build/` artifact so local iOS runs no longer leave the repository visibly dirty.

**Architecture:** Keep the change scoped to repository hygiene. The root `.gitignore` gains a path-specific rule, then the existing generated `.build/` directory is removed from the main workspace and verified with git status and ignore checks.

**Tech Stack:** Git, `.gitignore`, shell cleanup

---

### Task 1: Ignore And Remove The Local Swift Build Artifact

**Files:**
- Create: `docs/superpowers/specs/2026-03-15-ios-build-artifact-ignore-design.md`
- Create: `docs/superpowers/plans/2026-03-15-ios-build-artifact-ignore.md`
- Modify: `.gitignore`

- [ ] **Step 1: Add the path-specific ignore rule**

Update `[.gitignore](/Users/yuchen/Desktop/blackbox/.gitignore)` to include `apps/ios/App/.build/`.

- [ ] **Step 2: Remove the current local artifact**

Run: `rm -rf /Users/yuchen/Desktop/blackbox/apps/ios/App/.build`

Expected: the generated build directory is deleted from the main workspace.

- [ ] **Step 3: Verify ignore behavior and repository cleanliness**

Run:
- `git check-ignore -v apps/ios/App/.build` from the main workspace
- `git status --short --branch` from the main workspace

Expected:
- the ignore check points at the new `.gitignore` rule
- the main workspace reports `## master...origin/master` with no extra paths

- [ ] **Step 4: Commit**

```bash
git add .gitignore docs/superpowers/specs/2026-03-15-ios-build-artifact-ignore-design.md docs/superpowers/plans/2026-03-15-ios-build-artifact-ignore.md
git commit -m "chore: ignore ios build artifacts"
```
