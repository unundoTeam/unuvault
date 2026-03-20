# UnuVault README And Review Contract Alignment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-align the `unuvault` root README and PR template with the shared portfolio contract without absorbing unrelated browser-extension test work.

**Architecture:** Keep the change documentation-only. Normalize the README into the shared active-repo template, check in the repo-local PR template using the shared review-summary shell, and record the rollout in a minimal design note and implementation plan while explicitly excluding `apps/browser-extension/tests/packaging-build.spec.ts`.

**Tech Stack:** Markdown docs

---

## Chunk 1: Normalize Repo Entry Docs

### Task 1: Align the root README

**Files:**
- Modify: `/Users/yuchen/Code/unu/unuvault/README.md`

- [ ] **Step 1: Use the shared README template**

Keep the `unuvault`-specific product, auth-bridge, and verification guidance,
but present it through the shared active-repo README sections and the shared
two-axis migration-status wording.

### Task 2: Check in the PR template

**Files:**
- Create: `/Users/yuchen/Code/unu/unuvault/.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Use the shared review-summary shell**

Track the repo-local PR template in git and keep the shared review-summary
sections plus the existing `Design / Requirement Link` block.

## Chunk 2: Record And Verify

### Task 3: Add repo-local design and plan notes

**Files:**
- Create: `/Users/yuchen/Code/unu/unuvault/docs/superpowers/specs/2026-03-20-readme-review-contract-alignment-design.md`
- Create: `/Users/yuchen/Code/unu/unuvault/docs/superpowers/plans/2026-03-20-readme-review-contract-alignment.md`

- [ ] **Step 1: Record the docs-only rollout slice**

Add the minimal design and implementation plan that explains the README and PR
template alignment scope and explicitly excludes the unrelated packaging test
file.

### Task 4: Run verification

**Files:**
- Verify: `/Users/yuchen/Code/unu/unuvault/README.md`
- Verify: `/Users/yuchen/Code/unu/unuvault/.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Run repo-local patch validation**

Run:

```bash
git -C /Users/yuchen/Code/unu/unuvault diff --check
```

Expected: no output.

- [ ] **Step 2: Run the portfolio docs smoke path from `unuOS`**

Run:

```bash
cd /Users/yuchen/Code/unu/unuOS
PYTHONPATH=src .venv/bin/python -m pytest tests/test_docs_smoke.py -q
```

Expected: the active-repo README and PR-template smoke checks continue to pass.

- [ ] **Step 3: Keep the unrelated browser-extension test file out of scope**

Do not stage or commit:

```text
/Users/yuchen/Code/unu/unuvault/apps/browser-extension/tests/packaging-build.spec.ts
```

Plan complete and saved to `docs/superpowers/plans/2026-03-20-readme-review-contract-alignment.md`. Ready to execute?
