# unuvault Unuforge Phase 2 iOS Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `ios-test-runner` machine profile to `unuvault` without changing the existing iOS workflow entrypoint.

**Architecture:** Extend the phase-1 preset and lightweight host adapter so `unuforge` can discover and run the existing `scripts/testing/run-ios.sh` wrapper. Keep `.github/workflows/ios.yml` unchanged so CI remains anchored to the current stable shell entrypoint while the machine contract expands.

**Tech Stack:** pnpm workspace meta tests, Python-compatible `unuforge` CLI contract, shell wrappers, Xcode wrapper script

---

## File Structure Map

- Modify: `presets/unuvault/release-preset.json`
- Modify: `presets/unuvault/README.md`
- Modify: `packages/unuvault-forge-host/src/unuvault_forge_host/host.py`
- Modify: `tests/unuforge-entrypoints.spec.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-03-16-unuvault-unuforge-phase2-ios-design.md`

## Chunk 1: Lock the iOS Contract with a Red Test

### Task 1: Extend the root unuforge meta test for `ios-test-runner`

**Files:**
- Modify: `tests/unuforge-entrypoints.spec.ts`
- Test: `tests/unuforge-entrypoints.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
expect(preset.surfaces).toContainEqual({
  name: "ios-test-runner",
  type: "profile",
  target: "ios-test-runner",
  domain: "testing",
  visibility: "human-and-machine",
});

expect(preset.entrypoints?.ios_test_runner).toBe("scripts/testing/run-ios.sh");
expect(hostSource).toContain('"ios-test-runner"');
expect(hostSource).toContain('"run-ios.sh"');
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `/Users/yuchen/Desktop/unuvault/node_modules/.bin/pnpm exec vitest --run tests/unuforge-entrypoints.spec.ts`
Expected: FAIL because `ios-test-runner` is not in the preset or host map yet.

- [ ] **Step 3: Commit the red test**

```bash
git add tests/unuforge-entrypoints.spec.ts
git commit -m "test: cover unuvault ios machine profile"
```

## Chunk 2: Add the Thin iOS Machine Surface

### Task 2: Extend the preset and host adapter

**Files:**
- Modify: `presets/unuvault/release-preset.json`
- Modify: `presets/unuvault/README.md`
- Modify: `packages/unuvault-forge-host/src/unuvault_forge_host/host.py`
- Modify: `README.md`

- [ ] **Step 1: Add the preset surface and entrypoint**

```json
{
  "name": "ios-test-runner",
  "type": "profile",
  "target": "ios-test-runner",
  "domain": "testing",
  "visibility": "human-and-machine"
}
```

```json
"ios_test_runner": "scripts/testing/run-ios.sh"
```

- [ ] **Step 2: Extend the host profile map**

```python
"ios-test-runner": ROOT / "scripts" / "testing" / "run-ios.sh",
```

- [ ] **Step 3: Update the human-facing docs**

Document that:
- phase 2 now exposes `ios-test-runner`
- human-facing iOS entrypoint remains `bash scripts/testing/run-ios.sh`
- `.github/workflows/ios.yml` remains unchanged in this phase

- [ ] **Step 4: Re-run the targeted test to verify it passes**

Run: `/Users/yuchen/Desktop/unuvault/node_modules/.bin/pnpm exec vitest --run tests/unuforge-entrypoints.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit the implementation**

```bash
git add README.md presets/unuvault packages/unuvault-forge-host/src/unuvault_forge_host/host.py tests/unuforge-entrypoints.spec.ts
git commit -m "feat: add unuvault ios machine profile"
```

## Chunk 3: Verify the Expanded CLI Contract

### Task 3: Prove `unuforge` can discover and dry-run the iOS profile

**Files:**
- Reuse: `presets/unuvault/release-preset.json`
- Reuse: `packages/unuvault-forge-host/src/unuvault_forge_host/host.py`

- [ ] **Step 1: Verify preset inspection**

Run: `python3 -m unuforge.cli preset inspect --preset presets/unuvault/release-preset.json --json`
Expected: PASS with `ios-test-runner` in `surfaces`

- [ ] **Step 2: Verify profile listing**

Run: `python3 -m unuforge.cli profiles list --preset presets/unuvault/release-preset.json --json`
Expected: PASS with `lint-runner`, `test-runner`, and `ios-test-runner`

- [ ] **Step 3: Verify iOS dry-run execution**

Run: `python3 -m unuforge.cli profiles run ios-test-runner --preset presets/unuvault/release-preset.json --host-adapter unuvault_forge_host --dry-run --json`
Expected: PASS with command pointing at `scripts/testing/run-ios.sh`

- [ ] **Step 4: If the local simulator environment is ready, verify actual execution**

Run: `python3 -m unuforge.cli profiles run ios-test-runner --preset presets/unuvault/release-preset.json --host-adapter unuvault_forge_host`
Expected: PASS, or document the environment blocker if no supported simulator is available

- [ ] **Step 5: Commit any verification-aligned doc cleanup if needed**

```bash
git add -A
git commit -m "test: verify unuvault ios machine profile"
```

## Chunk 4: Leave Workflow Scope Explicitly Unchanged

### Task 4: Record the deliberate non-cutover

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-03-16-unuvault-unuforge-phase2-ios-design.md`

- [ ] **Step 1: State that the iOS workflow still calls the wrapper directly**

Add one short note that `.github/workflows/ios.yml` continues to run `bash scripts/testing/run-ios.sh` in phase 2.

- [ ] **Step 2: State the next likely follow-up**

List:
- optional cutover of `.github/workflows/ios.yml` to `unuforge.cli`
- optional JS CI cutover after iOS proves stable

- [ ] **Step 3: Re-run the repository test baseline**

Run: `/Users/yuchen/Desktop/unuvault/node_modules/.bin/pnpm test`
Expected: PASS

- [ ] **Step 4: Final commit**

```bash
git add README.md docs/superpowers/specs/2026-03-16-unuvault-unuforge-phase2-ios-design.md
git commit -m "docs: record unuvault ios machine surface follow-up"
```
