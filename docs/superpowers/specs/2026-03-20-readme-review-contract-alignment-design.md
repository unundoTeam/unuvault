# UnuVault README And Review Contract Alignment Design

> Date: 2026-03-20
> Status: Approved

## Summary

This change realigns the `unuvault` root README and PR template with the
current shared portfolio contract while preserving the repo-local auth-bridge
and split verification guidance.

## Problem

`unuvault` already had most of the contract convergence content drafted, but two
pieces were still not fully closed:

- the root README changes existed only as local modifications
- the repo-local PR template existed only as an untracked local file

At the same time, the repo also contains an unrelated untracked browser-extension
test file. That means the docs-only rollout needs to be isolated carefully so
the contract-alignment PR does not accidentally absorb unrelated test work.

## Scope

Included:

- normalize the root README into the shared active-repo README template
- keep repo-local auth-bridge, machine-entrypoint, and split verification
  guidance inside that template
- check in the repo-local PR template using the shared review-summary shell
- add a repo-local design note and implementation plan for this docs-only slice

Excluded:

- browser-extension runtime or test changes
- iOS or API behavior changes
- auth bootstrap behavior changes
- the untracked file
  `apps/browser-extension/tests/packaging-build.spec.ts`

## Design

### README

Keep the `unuvault`-specific product and auth-bridge guidance, but expose it
through the shared active-repo sections:

- `What This Repo Owns`
- `What It Does Not Own`
- `Source Of Truth`
- `Workspace Layout`
- `Human Entrypoints`
- `Machine Entrypoints`
- `Verification`
- `Review Model`
- `Cross-Repo Dependencies`
- `Current Risks / Migration Status`

The migration-status section should keep the explicit identity, automation, and
env maturity signals already drafted in the local README changes.

### PR Template

Check in a repo-local `.github/PULL_REQUEST_TEMPLATE.md` that uses the shared
review-summary shell:

- `Scope of Change`
- `Verification Commands`
- `Docs Impact`
- `Risks`
- `Rollback Notes`
- `Cross-Repo Impact`

Keep the existing `Design / Requirement Link` block, but do not add more
repo-local sections in this docs-only alignment slice.

## Verification

Use repo-local `git diff --check` to confirm the checked-in docs stay
patch-clean, and use `unuOS` docs smoke to confirm the active-repo README and
PR-template wording still satisfies the portfolio contract. Do not stage or
verify the unrelated `apps/browser-extension/tests/packaging-build.spec.ts`
file as part of this slice.
