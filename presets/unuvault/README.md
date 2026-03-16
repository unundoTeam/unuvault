# unuvault preset

Phase-2 `unuforge` machine surface for `unuvault`.

## Profiles

- `lint-runner` -> `scripts/testing/lint-runner.sh`
- `test-runner` -> `scripts/testing/test-runner.sh`
- `ios-test-runner` -> `scripts/testing/run-ios.sh`

## Notes

- Human-facing JS entrypoints stay `pnpm lint` and `pnpm test`.
- Human-facing iOS entrypoint stays `bash scripts/testing/run-ios.sh`.
- Phase 2 does not add deployment actions.
- Phase 2 keeps both JS and iOS workflows on their existing shell entrypoints.
