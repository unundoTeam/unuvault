# Unuvault Actions Node24 Upgrade Design

This change removes the GitHub Actions deprecation warning that still appears on `unundoTeam/unuvault`
after the owner migration and branch-trigger cleanup.

## Scope

- upgrade `actions/checkout` in `.github/workflows/ci.yml`
- upgrade `actions/setup-node` in `.github/workflows/ci.yml`
- upgrade `actions/checkout` in `.github/workflows/ios.yml`
- keep workflow structure, runner types, cache behavior, and test commands unchanged

## Why This Is Needed

The current workflows still use action versions that run on the deprecated Node 20 runtime. GitHub's
warning explicitly calls out `actions/checkout@v4` and `actions/setup-node@v4`. The safest follow-up
is to move to the current supported major versions without widening the change.

## Validation

- inspect the local diff and confirm only workflow action versions and the two new docs changed
- push the workflow update to `main`
- confirm a new `CI` run on `main` completes successfully under `unundoTeam/unuvault`
- note whether the previous Node 20 deprecation annotation disappears from the new run
