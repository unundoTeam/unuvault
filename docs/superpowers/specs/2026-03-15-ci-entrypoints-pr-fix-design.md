# CI Entrypoints PR Fix Design

**Problem:** [PR #2](https://github.com/unuvault/unuvault/pull/2) cannot merge because its GitHub checks fail in CI even though the branch passes locally.

## Current Failures

1. The JavaScript workflow in `.github/workflows/ci.yml` configures `actions/setup-node` with `cache: pnpm`, but the repository does not commit a `pnpm-lock.yaml`. GitHub fails the job before install/test execution because the lockfile required for cache key generation is missing.
2. `apps/ios/App/Tests/AutofillOnboardingViewTests.swift` reaches into `view.body` from a plain XCTest method. GitHub's Xcode 16.4 runner treats this as an invalid cross-actor access, even though the local Xcode 17 toolchain currently accepts it.

## Approaches

### Option 1: Minimal CI-specific repair (Recommended)

- Remove `cache: pnpm` from the JS workflow
- Keep `pnpm install --no-frozen-lockfile`
- Mark the Swift UI test access as main-actor-safe without changing the test's intent

Why this is recommended:
- fixes both red checks with the smallest diff
- keeps PR #2 focused on "real CI entrypoints"
- avoids introducing a lockfile policy decision into an unrelated repair

### Option 2: Lockfile-first repair

- Add `pnpm-lock.yaml`
- keep `cache: pnpm`
- still fix the Swift actor-isolation issue

Trade-off:
- technically sound, but expands scope into dependency governance and lockfile ownership

### Option 3: Disable unstable checks

- weaken JS caching or skip the iOS test path temporarily

Trade-off:
- fastest to merge, but it undermines the trust goal of PR #2 and would immediately create follow-up cleanup work

## Chosen Design

Use the minimal repair path:

1. Update `.github/workflows/ci.yml` so setup-node no longer requests pnpm cache metadata.
2. Update `AutofillOnboardingViewTests.swift` so the body access happens from a main-actor context that compiles on Xcode 16.4 and Xcode 17.
3. Add repository-level regression coverage in the existing meta tests so the workflow and Swift test contract stay aligned with this fix.
4. Re-run local JS and iOS validation, then push the branch to let GitHub re-check PR #2.

## Non-Goals

- Do not add a repository-wide lockfile policy
- Do not redesign the iOS testing approach
- Do not change runtime product behavior
