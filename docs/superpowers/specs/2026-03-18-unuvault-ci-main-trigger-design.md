# Unuvault CI Main Trigger Design

This change restores push-triggered CI coverage for the repository's actual default branch after the
owner migration and earlier Git baseline cleanup left `.github/workflows/ci.yml` listening on
`master` while the repository now runs on `main`.

## Scope

- update the `CI` workflow push trigger from `master` to `main`
- keep pull-request behavior unchanged
- avoid changing jobs, runner types, dependency setup, or test commands

## Why This Is Needed

`unundoTeam/unuvault` already uses `main` as its default branch, but the current workflow only
triggers on pushes to `master`. That means merges to `main` lose their push-side CI signal even
though pull-request validation still works.

## Validation

- inspect the workflow diff locally
- push the workflow change to `main`
- confirm GitHub Actions records a new `CI` run on the `main` branch under `unundoTeam/unuvault`
