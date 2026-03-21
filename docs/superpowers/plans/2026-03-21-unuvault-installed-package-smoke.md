# unuvault Installed-Package Smoke Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repo-owned installed-package smoke in `unuvault` that proves a published `unuforge` wheel still supports the JS-safe preset and host-adapter contract.

**Architecture:** Add one opt-in Python smoke test script under `scripts/ci/tests/`, then make `unuvault_forge_host` resolve repo root and wrapper scripts from the preset instead of from the installed package layout. Keep the scope intentionally small: `preset inspect`, `profiles list`, `lint-runner --dry-run`, and `test-runner --dry-run` only.

**Tech Stack:** Python `unittest`, Python `venv`, `unuforge` CLI, `pnpm` workspace meta test, repo-local shell wrappers

---

## File Structure Map

- Create: `scripts/ci/tests/test_unuforge_package_consumer_smoke.py`
- Modify: `packages/unuvault-forge-host/src/unuvault_forge_host/host.py`
- Modify: `tests/unuforge-entrypoints.spec.ts`
- Modify: `README.md`

## Preflight Notes

- Run commands from the `unuvault` repo root.
- This repo uses `pnpm`. If `pnpm` is not on `PATH`, use `corepack pnpm`.
- The smoke should accept either:
  - `UNUFORGE_WHEEL_PATH=/absolute/path/to/unuforge-<version>-py3-none-any.whl`
  - or `UNUFORGE_REPO_ROOT=/absolute/path/to/unuforge` for local fallback wheel builds

## Chunk 1: Add the Failing Installed-Package Smoke

### Task 1: Create a smoke test that proves the desired installed-package contract

**Files:**
- Create: `scripts/ci/tests/test_unuforge_package_consumer_smoke.py`
- Test: `scripts/ci/tests/test_unuforge_package_consumer_smoke.py`

- [ ] **Step 1: Write the failing smoke test**

Create a Python `unittest` script modeled after the existing `unuidentity` /
`unundo` installed-package smokes. It should:

- resolve the `unuforge` wheel from `UNUFORGE_WHEEL_PATH` or by building from
  `UNUFORGE_REPO_ROOT`
- create a temp venv
- install:
  - the resolved `unuforge` wheel
  - `packages/unuvault-forge-host`
- run and assert:
  - `python -m unuforge.cli preset inspect --preset presets/unuvault/release-preset.json --json`
  - `python -m unuforge.cli profiles list --preset presets/unuvault/release-preset.json --json`
  - `python -m unuforge.cli profiles run lint-runner --preset ... --host-adapter unuvault_forge_host --dry-run --json`
  - `python -m unuforge.cli profiles run test-runner --preset ... --host-adapter unuvault_forge_host --dry-run --json`

The assertions should check:

- `project.name == "unuvault"`
- `profiles list` contains `lint-runner` and `test-runner`
- both dry-runs return `runner == "command"`
- both dry-runs use `cwd == <repo root>`
- commands point at:
  - `scripts/testing/lint-runner.sh`
  - `scripts/testing/test-runner.sh`

- [ ] **Step 2: Run the smoke to verify it fails**

Run:

```bash
UNUFORGE_REPO_ROOT=/Users/yuchen/Code/unu/unuforge python3 scripts/ci/tests/test_unuforge_package_consumer_smoke.py
```

Expected: FAIL because the current `unuvault_forge_host` still relies on the
installed package layout instead of the preset path to find the repo root.

- [ ] **Step 3: Commit the red test**

```bash
git add scripts/ci/tests/test_unuforge_package_consumer_smoke.py
git commit -m "test: add unuvault installed-package smoke"
```

## Chunk 2: Make the Host Installed-Package Safe

### Task 2: Resolve repo root and wrapper scripts from the preset

**Files:**
- Modify: `packages/unuvault-forge-host/src/unuvault_forge_host/host.py`
- Reuse: `scripts/ci/tests/test_unuforge_package_consumer_smoke.py`

- [ ] **Step 1: Replace layout-coupled root resolution**

Refactor `host.py` so it follows the `unuidentity` pattern:

- add `_load_preset(preset_path: str) -> tuple[Path, dict[str, Any]]`
- add `_repo_root_from_preset_path(preset_path: Path) -> Path`
- add a surface index helper that validates `surfaces`
- resolve profile entrypoints from the preset payload rather than from a
  module-global hardcoded root

- [ ] **Step 2: Keep the host API surface unchanged**

Preserve:

- `build_profile_execution(...)`
- `run_profile(...)`
- `build_action_execution(...)`
- `run_action(...)`

But keep actions unsupported with the same explicit `ValueError` behavior.

- [ ] **Step 3: Run the smoke again to verify it passes**

Run:

```bash
UNUFORGE_REPO_ROOT=/Users/yuchen/Code/unu/unuforge python3 scripts/ci/tests/test_unuforge_package_consumer_smoke.py
```

Expected: PASS

- [ ] **Step 4: Re-run the existing unuforge entrypoint meta test**

Run:

```bash
pnpm exec vitest --run tests/unuforge-entrypoints.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit the host fix**

```bash
git add packages/unuvault-forge-host/src/unuvault_forge_host/host.py scripts/ci/tests/test_unuforge_package_consumer_smoke.py
git commit -m "feat: support unuvault installed-package smoke"
```

## Chunk 3: Lock the Entry Point and Document It

### Task 3: Make the smoke discoverable and keep its contract visible

**Files:**
- Modify: `tests/unuforge-entrypoints.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Extend the root meta test**

Add assertions that:

- `scripts/ci/tests/test_unuforge_package_consumer_smoke.py` exists
- the repo still exposes `presets/unuvault/release-preset.json`
- the repo-root machine surface remains the current stable contract floor

- [ ] **Step 2: Document the opt-in installed-package smoke**

Update `README.md` so it states:

- `unuvault` has an opt-in installed-package smoke for published `unuforge`
- the first version only covers the JS-safe contract
- `ios-test-runner` remains outside the first installed-package smoke scope

- [ ] **Step 3: Run the focused meta test**

Run:

```bash
pnpm exec vitest --run tests/unuforge-entrypoints.spec.ts
```

Expected: PASS

- [ ] **Step 4: Build a real wheel and verify the true wheel path**

Build a wheel from the sibling `unuforge` repo, then run the smoke with
`UNUFORGE_WHEEL_PATH`.

Run:

```bash
python3 /Users/yuchen/Code/unu/unuforge/scripts/build_distribution.py --out-dir /tmp/unuforge-dist --json
```

Then run:

```bash
UNUFORGE_WHEEL_PATH=/tmp/unuforge-dist/unuforge-0.2.0-py3-none-any.whl python3 scripts/ci/tests/test_unuforge_package_consumer_smoke.py
```

Expected: PASS

If the wheel filename changes, update the exact filename in the command to the
one emitted by `build_distribution.py`.

- [ ] **Step 5: Final verification sweep**

Run:

```bash
pnpm exec vitest --run tests/unuforge-entrypoints.spec.ts
UNUFORGE_REPO_ROOT=/Users/yuchen/Code/unu/unuforge python3 scripts/ci/tests/test_unuforge_package_consumer_smoke.py
```

Expected: both PASS

- [ ] **Step 6: Commit the contract docs**

```bash
git add README.md tests/unuforge-entrypoints.spec.ts scripts/ci/tests/test_unuforge_package_consumer_smoke.py
git commit -m "docs: record unuvault installed-package smoke"
```

## Chunk 4: Handoff To Future Gate Expansion

### Task 4: Leave the next move explicit without widening scope now

**Files:**
- Reuse: `README.md`
- Reuse: `docs/superpowers/specs/2026-03-21-unuvault-installed-package-smoke-design.md`

- [ ] **Step 1: Preserve explicit non-goals**

Make sure the final docs and commit messages do not imply any of the following
were done:

- `unuvault` joined the `unuforge` installed-package gate
- `ios-test-runner` joined installed-package smoke
- repo CI now runs the installed-package smoke by default

- [ ] **Step 2: Prepare implementation summary**

Call out that the next repo is still `unuforge`:

- register `unuvault` as an installed-package consumer only after this repo-side
  smoke has proven stable
- keep the first promotion separate from any iOS-specific contract decision
