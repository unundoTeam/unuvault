# unuvault preset

Phase-1 `unuforge` machine surface for `unuvault`.

## Profiles

- `lint-runner` -> `scripts/testing/lint-runner.sh`
- `test-runner` -> `scripts/testing/test-runner.sh`

## Notes

- Human-facing entrypoints stay `pnpm lint` and `pnpm test`.
- Phase 1 does not add deployment actions or an iOS profile.
- Phase 1 keeps CI on the existing `pnpm lint` / `pnpm test` entrypoints.
