# Test Runner Exclude Worktrees Design

## Summary

This slice fixes a single source of false-red verification in the local `unuvault` repository.

Today the root test entrypoint at `scripts/testing/test-runner.sh` runs:

```bash
pnpm exec vitest --run tests
pnpm -r test
```

The first command walks the repository root and currently picks up test files from `.worktrees/**` as well. That means running the root test script from the main checkout can fail because of unrelated feature worktrees, even when the main checkout itself is healthy.

The goal of this slice is to make the root runner validate the current checkout only.

## Scope

### In scope

- update the root `vitest` invocation to exclude `.worktrees/**`
- add the smallest regression coverage needed to prove the runner command includes the exclusion
- keep workspace package tests unchanged

### Out of scope

- changing CI workflows
- changing `lint-runner.sh`
- changing individual workspace `test` scripts
- cleaning up existing worktrees

## Approaches Considered

### 1. Exclude `.worktrees/**` in the root `vitest` command

This is the recommended approach.

It fixes the exact failure we observed, keeps the change local to the root runner, and does not alter package-level test behavior.

### 2. Delete or ignore all other worktrees before running tests

This would reduce the symptom, but it pushes the burden onto repository hygiene rather than fixing the faulty runner behavior.

### 3. Move all root tests out of a generic `tests/` glob

This could also solve the issue, but it is too large for what is currently a one-line bug in the runner.

## Chosen Approach

The chosen approach is to keep the existing root runner shape and only make its first `vitest` call explicit about scope:

- continue running root-level tests
- explicitly exclude `.worktrees/**`
- continue running `pnpm -r test` unchanged

This preserves current project ergonomics while removing cross-worktree pollution.

## Data Flow

1. user runs `bash scripts/testing/test-runner.sh` from the main checkout
2. root `vitest` only evaluates root checkout tests, not `.worktrees/**`
3. workspace package tests continue to run through `pnpm -r test`
4. verification result reflects the current checkout rather than unrelated branches

## Error Handling

This slice should not add fallback logic or dynamic discovery.

If root tests fail after the exclusion, they should fail because of the current checkout’s code, not because of sibling worktrees.

## Testing Strategy

- add a small regression test or script-level assertion that the root command includes `.worktrees/**` exclusion
- run the root runner to confirm it no longer picks up sibling worktree failures
- run `pnpm -r test` behavior through the existing runner to make sure package tests still execute

## Success Criteria

This slice is complete when:

- `scripts/testing/test-runner.sh` excludes `.worktrees/**` from the root `vitest` call
- running the root test script from the main checkout does not fail because of unrelated worktree tests
- workspace tests still run unchanged
