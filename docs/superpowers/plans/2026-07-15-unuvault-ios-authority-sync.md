# UnuVault iOS Authority Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point `unuOS` portfolio authority at UnuVault's current iOS composition and pairing-v3 frames, with precise parity and pending-device status.

**Architecture:** Use a clean `unuOS` worktree from `origin/main`, never the dirty checkout. Add RED document assertions, synchronize both authority rows, and change the checker only if stale encoded IDs block GREEN.

**Tech Stack:** Python 3, pytest, Markdown, Git worktrees, GitHub CLI (`gh`).

## Global Constraints

- Invoke `superpowers:using-git-worktrees` before execution.
- Source/base: `/Users/yuchen/Code/unu/unuOS` at `origin/main`.
- Branch/worktree: `codex/unuvault-ios-authority-sync` at `/Users/yuchen/Code/unu/.worktrees/unuOS-unuvault-ios-authority-sync`.
- Never switch, clean, stash, reset, or edit the dirty source checkout.
- Preserve existing UnuVault design-system, web, and Mac source IDs verbatim.
- Both docs must name `current/unuvault/ios-product-composition-v1` and `current/unuvault/ios-pairing-invite-receive-v3`.
- Both docs must state: repo/simulator parity done; physical imported receipt pending; manual VoiceOver pending; camera pending; full vault pending.
- Do not edit UnuVault code, Pencil files, or repositories outside the isolated `unuOS` worktree.
- Modify the checker only when RED proves it encodes stale IDs.
- Use TDD, exact checks, small commits, and `git diff --check`.
- Push, new PR creation, PR #78 body editing, and merge require approval; push/new PR/merge each require separate approval.

## Files and Interfaces

- `tests/test_design_governance_check.py`: exact source/status assertions.
- `docs/portfolio/design-operating-index.md`: first-read design authority.
- `docs/portfolio/pencil-design-gate.md`: matching Pencil authority row.
- `src/unuos/checks/design_governance_check.py`: optional literal-only update.
- UnuVault PR #78 `Cross-Repo Impact`: approved remote status update.

---

### Task 1: Create the clean unuOS worktree

**Files:** Create `/Users/yuchen/Code/unu/.worktrees/unuOS-unuvault-ios-authority-sync`; do not modify `/Users/yuchen/Code/unu/unuOS`.

**Interfaces:** Consumes `origin/main`; produces clean branch `codex/unuvault-ios-authority-sync`.

- [ ] **Step 1: Invoke the required skill**

Invoke `superpowers:using-git-worktrees` with the source, base, branch, and worktree above.

- [ ] **Step 2: Record current dirt without changing it**

Run: `git -C /Users/yuchen/Code/unu/unuOS status --short --branch`

Expected: local changes may appear; preserve them exactly.

- [ ] **Step 3: Create and verify the isolated worktree**

```bash
git -C /Users/yuchen/Code/unu/unuOS worktree add \
  /Users/yuchen/Code/unu/.worktrees/unuOS-unuvault-ios-authority-sync \
  -b codex/unuvault-ios-authority-sync origin/main
git -C /Users/yuchen/Code/unu/.worktrees/unuOS-unuvault-ios-authority-sync status --short --branch
```

Expected: the new branch has no changed paths.
---

### Task 2: Add RED authority assertions

**Files:** Modify/test `tests/test_design_governance_check.py`.

**Interfaces:** Consumes both authority docs as UTF-8; produces exact source/status regression coverage.

- [ ] **Step 1: Add this test beside existing document-content tests**

```python
def test_unuvault_ios_authority_uses_product_composition_and_pairing_v3() -> None:
    paths = (
        ROOT / "docs/portfolio/design-operating-index.md",
        ROOT / "docs/portfolio/pencil-design-gate.md",
    )
    required = (
        "current/unuvault/ios-product-composition-v1",
        "current/unuvault/ios-pairing-invite-receive-v3",
        "repo/simulator parity done",
        "physical imported receipt pending",
        "manual VoiceOver pending",
        "camera pending",
        "full vault pending",
    )
    for path in paths:
        content = path.read_text(encoding="utf-8")
        assert all(text in content for text in required), str(path)
```

Use the file's existing root constant if it is not named `ROOT`; do not add another resolver.

- [ ] **Step 2: Run exact RED**

Run: `python3 -m pytest tests/test_design_governance_check.py -q`

Expected: FAIL in the new test on a missing new ID or status phrase.

- [ ] **Step 3: Inspect scope**

Run: `git diff -- tests/test_design_governance_check.py`

Expected: only the new test.
---

### Task 3: Synchronize both authority rows

**Files:** Modify `docs/portfolio/design-operating-index.md` and `docs/portfolio/pencil-design-gate.md`; test `tests/test_design_governance_check.py`.

**Interfaces:** Consumes Task 2 strings; produces identical UnuVault iOS authority/status in both docs.

- [ ] **Step 1: Replace only the iOS portion of both UnuVault rows**

Keep design-system, web, and Mac cells verbatim. Insert:

```markdown
Current iOS sources: `current/unuvault/ios-product-composition-v1` and `current/unuvault/ios-pairing-invite-receive-v3`. Repo/simulator parity done; physical imported receipt pending; manual VoiceOver pending; camera pending; full vault pending.
```

- [ ] **Step 2: Check preserved/new IDs**

```bash
rg -n "current/unuvault/(design-system|web-vault-management|mac-companion|ios-)" \
  docs/portfolio/design-operating-index.md docs/portfolio/pencil-design-gate.md
```

Expected: prior design-system/web/Mac IDs remain; both rows contain only the two new current iOS IDs.

- [ ] **Step 3: Run exact GREEN**

Run: `python3 -m pytest tests/test_design_governance_check.py -q`

Expected: PASS. If failure identifies stale checker literals, perform Task 4; otherwise commit:

```bash
git add tests/test_design_governance_check.py docs/portfolio/design-operating-index.md \
  docs/portfolio/pencil-design-gate.md
git diff --cached --check
git commit -m "docs: sync unuvault iOS design authority"
```
---

### Task 4: Update the checker only if RED requires it

**Files:** Optionally modify `src/unuos/checks/design_governance_check.py`; test the same pytest file.

**Interfaces:** Consumes proven stale literals; produces checker expectations aligned with current iOS IDs.

- [ ] **Step 1: Prove stale literals exist**

Run: `rg -n "ios-vault-home-native-locked-v1|ios-pairing-invite-receive-v2" src/unuos/checks/design_governance_check.py`

Expected: matches justify this task; no match means do not edit the checker.

- [ ] **Step 2: Replace only these literals in place**

```python
"current/unuvault/ios-vault-home-native-locked-v1"
# becomes
"current/unuvault/ios-product-composition-v1"
"current/unuvault/ios-pairing-invite-receive-v2"
# becomes
"current/unuvault/ios-pairing-invite-receive-v3"
```

Do not rename functions, broaden validation, or restructure the checker.

- [ ] **Step 3: Run GREEN and commit**

```bash
python3 -m pytest tests/test_design_governance_check.py -q
git add tests/test_design_governance_check.py docs/portfolio/design-operating-index.md \
  docs/portfolio/pencil-design-gate.md src/unuos/checks/design_governance_check.py
git diff --cached --check
git commit -m "docs: sync unuvault iOS design authority"
```

Expected: pytest PASS; one commit including the checker only with RED/GREEN evidence.
---

### Task 5: Verify and prepare PR #78 status

**Files:** Verify local changed files; after approval edit only PR #78 `Cross-Repo Impact`.

**Interfaces:** Consumes verified SHA/remote state; produces truthful dependency status.

- [ ] **Step 1: Run final local verification**

```bash
python3 -m pytest tests/test_design_governance_check.py -q
git diff --check
git status --short --branch
git log -1 --oneline
```

Expected: pytest PASS, no diff-check output, clean branch, latest message `docs: sync unuvault iOS design authority`.

- [ ] **Step 2: Stop for separate push and new-PR approvals**

Report SHA/tests. Do not push until approved; after push, do not create a `unuOS` PR until separately approved.

- [ ] **Step 3: Prepare exact PR #78 text**

```markdown
## Cross-Repo Impact

- `unuOS` dependency: iOS sources are `current/unuvault/ios-product-composition-v1` and `current/unuvault/ios-pairing-invite-receive-v3`.
- Verification: repo/simulator parity done; physical imported receipt pending; manual VoiceOver pending; camera pending; full vault pending.
- Delivery: local `codex/unuvault-ios-authority-sync` commit; push, `unuOS` PR, and merge remain separately approval-gated.
```

After approved remote actions, change only the delivery bullet to the actual branch and PR URL.
- [ ] **Step 4: Stop for PR #78 body-edit approval**

Preserve all other sections; do not run `gh pr edit 78` before approval.

- [ ] **Step 5: Stop for separate merge approval**

Do not merge PR #78 or a `unuOS` PR without separate approval after required checks pass.
