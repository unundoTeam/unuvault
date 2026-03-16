# unuvault Unuforge Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first `unuvault -> unuforge` machine surface with `lint-runner` and `test-runner` profiles, without changing the current CI entrypoints.

**Architecture:** Keep `unuvault`'s existing shell wrappers as the canonical human entrypoints. Add a thin preset plus a lightweight `unuvault_forge_host` so `unuforge.cli` can inspect, list, and dry-run/execute the same stable wrappers. Do not add actions, iOS profiles, or deeper governance runtime semantics in this phase.

**Tech Stack:** pnpm workspace, Vitest meta tests, Python-compatible `unuforge` CLI contract, shell wrappers

---

## File Structure Map

- Create: `presets/unuvault/release-preset.json`
- Create: `presets/unuvault/README.md`
- Create: `packages/unuvault-forge-host/src/unuvault_forge_host/__init__.py`
- Create: `packages/unuvault-forge-host/src/unuvault_forge_host/host.py`
- Create: `unuvault_forge_host/__init__.py`
- Create: `unuforge/__init__.py`
- Create: `tests/unuforge-entrypoints.spec.ts`
- Modify: `README.md`

## Chunk 1: Lock the Contract with Meta Tests

### Task 1: Add a failing root-level meta test for unuforge entrypoints

**Files:**
- Create: `tests/unuforge-entrypoints.spec.ts`
- Test: `tests/unuforge-entrypoints.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("declares a unuvault preset with lint and test profiles", () => {
  expect(existsSync(resolve(repoRoot, "presets/unuvault/release-preset.json"))).toBe(true);
});
```

```ts
it("adds a local unuvault forge host bridge", () => {
  expect(existsSync(resolve(repoRoot, "packages/unuvault-forge-host/src/unuvault_forge_host/host.py"))).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest --run tests/unuforge-entrypoints.spec.ts`
Expected: FAIL because the preset and host files do not exist yet.

- [ ] **Step 3: Commit the red test**

```bash
git add tests/unuforge-entrypoints.spec.ts
git commit -m "test: add unuvault unuforge entrypoint contract"
```

## Chunk 2: Add the Thin Machine Surface

### Task 2: Add the preset and host adapter

**Files:**
- Create: `presets/unuvault/release-preset.json`
- Create: `presets/unuvault/README.md`
- Create: `packages/unuvault-forge-host/src/unuvault_forge_host/__init__.py`
- Create: `packages/unuvault-forge-host/src/unuvault_forge_host/host.py`
- Create: `unuvault_forge_host/__init__.py`
- Create: `unuforge/__init__.py`
- Modify: `README.md`

- [ ] **Step 1: Add the preset shape**

```json
{
  "schema_version": 2,
  "project": {
    "name": "unuvault",
    "manifest": "scripts/testing/test-runner.sh"
  },
  "surfaces": [
    {
      "name": "lint-runner",
      "type": "profile",
      "target": "lint-runner",
      "domain": "testing",
      "visibility": "human-and-machine"
    },
    {
      "name": "test-runner",
      "type": "profile",
      "target": "test-runner",
      "domain": "testing",
      "visibility": "human-and-machine"
    }
  ],
  "entrypoints": {
    "lint_runner": "scripts/testing/lint-runner.sh",
    "test_runner": "scripts/testing/test-runner.sh"
  }
}
```

- [ ] **Step 2: Add the minimal host adapter**

```python
def build_profile_execution(...):
    return {"runner": "command", "command": [script_path, *args], "cwd": str(ROOT)}
```

```python
def run_profile(...):
    execution = build_profile_execution(...)
    completed = subprocess.run(execution["command"], cwd=execution["cwd"])
    return completed.returncode
```

- [ ] **Step 3: Add repo-root compatibility shims**

`unuforge/__init__.py` should resolve:
- `UNUFORGE_SRC_ROOT`
- `UNUFORGE_REPO_ROOT/src/unuforge`
- sibling `../unuforge/src/unuforge`

`unuvault_forge_host/__init__.py` should expose `HOST`.

- [ ] **Step 4: Update the root README**

Add a short section describing the new machine surface and keep `pnpm lint` / `pnpm test` as the public human-friendly entrypoints.

- [ ] **Step 5: Run the meta test**

Run: `pnpm exec vitest --run tests/unuforge-entrypoints.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add README.md presets/unuvault packages/unuvault-forge-host unuforge unuvault_forge_host tests/unuforge-entrypoints.spec.ts
git commit -m "feat: add unuvault unuforge machine profiles"
```

## Chunk 3: Verify the CLI Contract Locally

### Task 3: Prove the preset and host adapter work with the external unuforge repo

**Files:**
- Reuse: `presets/unuvault/release-preset.json`
- Reuse: `packages/unuvault-forge-host/src/unuvault_forge_host/host.py`

- [ ] **Step 1: Verify preset inspection**

Run: `python3 -m unuforge.cli preset inspect --preset presets/unuvault/release-preset.json --json`
Expected: PASS with `project.name = unuvault`

- [ ] **Step 2: Verify profile listing**

Run: `python3 -m unuforge.cli profiles list --preset presets/unuvault/release-preset.json --json`
Expected: PASS with `lint-runner` and `test-runner`

- [ ] **Step 3: Verify dry-run execution for lint**

Run: `python3 -m unuforge.cli profiles run lint-runner --preset presets/unuvault/release-preset.json --host-adapter unuvault_forge_host --dry-run --json`
Expected: PASS with command pointing at `scripts/testing/lint-runner.sh`

- [ ] **Step 4: Verify dry-run execution for test**

Run: `python3 -m unuforge.cli profiles run test-runner --preset presets/unuvault/release-preset.json --host-adapter unuvault_forge_host --dry-run --json`
Expected: PASS with command pointing at `scripts/testing/test-runner.sh`

- [ ] **Step 5: Commit verification-friendly cleanup if needed**

```bash
git add -A
git commit -m "test: verify unuvault unuforge CLI contract"
```

## Chunk 4: Leave CI Unchanged but Document the Next Cut

### Task 4: Document what is intentionally deferred

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-03-16-unuvault-unuforge-phase1-design.md`

- [ ] **Step 1: State that CI remains on pnpm entrypoints**

Add one short note that `.github/workflows/ci.yml` still uses `pnpm lint` / `pnpm test` in phase 1.

- [ ] **Step 2: State the next additions**

List:
- `ios-test-runner`
- optional CI switch to `unuforge.cli`

- [ ] **Step 3: Run the repository meta tests**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 4: Final commit**

```bash
git add README.md docs/superpowers/specs/2026-03-16-unuvault-unuforge-phase1-design.md
git commit -m "docs: record deferred unuvault unuforge follow-ups"
```
