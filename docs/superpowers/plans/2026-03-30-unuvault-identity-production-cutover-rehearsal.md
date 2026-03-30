# Unuvault Identity Production Cutover Rehearsal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dry-run-only rehearsal record for `unuvault` that documents how the repo would execute consumer cutover and rollback against the formal shared-identity landing authority.

**Architecture:** Keep this slice documentation-only. Add one canonical rehearsal evidence document under `docs/operations`, wire it from the repo `README`, and use existing `unuidentity` production-landing docs as authority inputs. Do not modify runtime code, real env values, callback settings, or live secret material.

**Tech Stack:** Markdown docs, repo authority docs, pnpm verification, git

---

## File Structure

### New docs

- Create: `docs/operations/identity-production-cutover-rehearsal.md`
  - canonical dry-run rehearsal evidence for cutover, rollback, verification,
    and blockers

### Existing docs to modify

- Modify: `README.md`
  - add a short pointer in `Current Risks / Migration Status` to the rehearsal
    evidence

### Existing verification

- Verify: `corepack pnpm lint`
- Verify: `corepack pnpm test`
- Verify: `git diff --check`

---

## Chunk 1: Add The Rehearsal Evidence Document

### Task 1: Create the dry-run rehearsal record

**Files:**
- Create: `docs/operations/identity-production-cutover-rehearsal.md`
- Test: `git diff --check`

- [ ] **Step 1: Write the document skeleton**

Create `docs/operations/identity-production-cutover-rehearsal.md` with these
sections:

```md
# Identity Production Cutover Rehearsal

> 更新时间：2026-03-30
> 状态：Dry-run evidence

## Goal
## Authority Inputs
## Current Consumer State
## Dry-Run Cutover Walkthrough
## Dry-Run Rollback Walkthrough
## Repo-Local Verification
## Blocked For Real Cutover
## Outcome
```

- [ ] **Step 2: Record the authority inputs**

Reference these exact upstream authority docs:

```md
- `/Users/yuchen/Code/unu/unuidentity/docs/operations/production-landing.md`
- `/Users/yuchen/Code/unu/unuidentity/docs/operations/consumer-cutover-checklist.md`
- `/Users/yuchen/Code/unu/unuidentity/docs/operations/consumer-rollback-checklist.md`
```

Also record that `unuvault` remains an `identity contract: adopted` consumer.

- [ ] **Step 3: Record dry-run cutover and rollback walkthroughs**

Document:

```md
- what `unuvault` would verify before switching hosted identity authority
- what repo-local commands confirm the switch
- what consumer-first rollback would revert first
- what still blocks real cutover today
```

- [ ] **Step 4: Run diff check**

Run: `git diff --check`  
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add docs/operations/identity-production-cutover-rehearsal.md
git commit -m "docs: add unuvault cutover rehearsal"
```

## Chunk 2: Wire The Rehearsal Into Repo Authority

### Task 2: Add the README pointer

**Files:**
- Modify: `README.md`
- Test: `git diff --check`

- [ ] **Step 1: Update `Current Risks / Migration Status`**

Add a short note that points readers to:

```md
- `docs/operations/identity-production-cutover-rehearsal.md`
```

The wording must explicitly say this is dry-run evidence, not live cutover
proof.

- [ ] **Step 2: Run diff check**

Run: `git diff --check`  
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: link unuvault cutover rehearsal"
```

## Chunk 3: Verify The Docs-Only Slice

### Task 3: Run the baseline verification and prepare PR handoff

**Files:**
- Verify: `docs/operations/identity-production-cutover-rehearsal.md`
- Verify: `README.md`

- [ ] **Step 1: Re-read for forbidden changes**

Confirm the slice does **not** include:

```md
- runtime code edits
- live env values
- callback changes
- real cutover execution records
```

- [ ] **Step 2: Run verification**

Run:

```bash
git diff --check
corepack pnpm lint
corepack pnpm test
```

Expected: all pass

- [ ] **Step 3: Prepare PR summary**

Record in the handoff that this slice:

```md
- adds dry-run rehearsal evidence for `unuvault`
- records repo-local cutover and rollback thinking
- does not start live cutover
- does not change runtime code
```

