# unuvault

unuvault is a Chinese-first public cloud password manager for technical users
who want a more trustworthy home for credentials than browser-native storage.

## What This Repo Owns

- the unuvault product boundary across web, API, browser-extension, and iOS
  surfaces
- vault, devices, imports, activity, and trust-center product behavior
- product-local data contracts and the client-side security model for vault
  access

## What It Does Not Own

- the shared identity and account platform owned by `unuidentity`
- the shared machine automation core owned by `unuforge`
- portfolio-wide governance and rollout policy owned by `unuOS`

## Source Of Truth

- `docs/superpowers/specs/2026-03-14-chinese-password-manager-phase1-design.md`
  for product scope and trust posture
- `docs/architecture/0000-phase1-execution-baseline.md` for the execution
  baseline
- `docs/superpowers/plans/2026-03-14-chinese-password-manager-phase1-roadmap.md`
  for the engineering roadmap
- this README for contributor-facing local entrypoints and current contract
  posture
- [the sibling `unuOS` repo's `docs/portfolio/README.md`](https://github.com/unundoTeam/unuos/blob/main/docs/portfolio/README.md)
  for portfolio overview and cross-repo authority

## Workspace Layout

- `apps/api/` - account, vault, devices, imports, and activity APIs
- `apps/web/` - onboarding, vault management, and trust-center flows
- `apps/browser-extension/` - popup, autofill, and extension auth surfaces
- `apps/ios/` - SwiftUI iPhone app and AutoFill onboarding
- `packages/domain/` - shared schemas and typed data contracts
- `packages/security/` - crypto, unlock, and trust-boundary logic
- `packages/api-client/` - shared typed API clients
- `infra/supabase/` - migrations and local infrastructure notes
- `presets/unuvault/` - phase-1 `unuforge` machine surface

## Human Entrypoints

- start the API locally:
  - `pnpm dev:api`
- start the web app locally:
  - `pnpm dev:web`
- repo-local verification commands:
  - `pnpm lint`
  - `pnpm test`
  - `bash scripts/testing/run-ios.sh`
  - `python3 scripts/ci/tests/test_unuforge_package_consumer_smoke.py`
  - `python3 scripts/ci/tests/test_unuforge_ios_package_consumer_smoke.py`

For local MVP auth setup:

- copy `apps/web/.env.example` to `apps/web/.env.local`
- copy `apps/api/.env.example` to `apps/api/.env.local`
- `apps/web/.env.local` needs the browser-facing `unuidentity` values:
  `NEXT_PUBLIC_IDENTITY_SUPABASE_URL`,
  `NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_API_BASE_URL`
- `apps/api/.env.local` needs both shared identity and product-data values:
  `IDENTITY_SUPABASE_URL`, `IDENTITY_SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PORT`
- the local auth loop is:
  `unuidentity signup/login -> /auth/callback -> /auth/finalize -> POST /auth/bootstrap`
- `unuidentity` needs a redirect URL for
  `http://127.0.0.1:3001/auth/callback` during local development

## Machine Entrypoints

- current machine execution example:
  - `python3 -m unuforge.cli profiles run test-runner --preset presets/unuvault/release-preset.json --host-adapter unuvault_forge_host`
- `presets/unuvault/release-preset.json` defines the phase-1 `unuforge`
  machine surface
- phase-2 machine profiles are `lint-runner`, `test-runner`, and
  `ios-test-runner`
- phase 2 keeps both `.github/workflows/ci.yml` and `.github/workflows/ios.yml`
  on their existing shell entrypoints

## Verification

- `Gate level`: `L2`
- `Minimum local verification`:
  - `pnpm lint`
  - `pnpm test`
- `Standard pre-merge verification`:
  - `pnpm lint`
  - `pnpm test`
- `Release or heavy verification`:
  - `bash scripts/testing/run-ios.sh` when the iOS surface or native bridge is
    in scope
  - `python3 scripts/ci/tests/test_unuforge_ios_package_consumer_smoke.py` for
    the repo-owned installed-package iOS path

The installed-package smoke split is intentional:

- `scripts/ci/tests/test_unuforge_package_consumer_smoke.py` covers the JS-safe
  `lint-runner` and `test-runner` path when validating a published `unuforge`
  wheel against `unuvault`'s JS-safe machine contract
- `scripts/ci/tests/test_unuforge_ios_package_consumer_smoke.py` is the
  dedicated iOS installed-package smoke for `ios-test-runner`
- the iOS installed-package smoke is expected to skip on non-Darwin hosts

The baseline installed-package smoke coverage is still JS-safe in this phase:

- `preset inspect`
- `profiles list`
- `lint-runner --dry-run`
- `test-runner --dry-run`

It does not yet include `ios-test-runner`.

## Review Model

`unuvault` follows the portfolio review baseline:

- approved design for behavior, contract, auth, sync, and schema changes
- author self-review
- Codex automatic review by default
- passing automation gates before merge

Human review is optional and is mainly recommended for auth, sync, crypto,
migration, and iOS bridge changes.

## Cross-Repo Dependencies

- `unuidentity` for shared signup/login, callback, finalize, and bootstrap
  handoff
- `unuforge` for the shared machine-entrypoint surface and runner naming
- `unuOS` for the shared identity, env, automation, verification, and review
  contracts

## Current Risks / Migration Status

- `Repo lifecycle`: `active`
- `Contract maturity`:
  - `identity contract`: `adopted`
  - `automation contract`: `adopted`
  - `env contract`: `adopted`
- the shared identity cutover is in place, but automation and documentation
  rollout still need to keep converging across the broader portfolio
- the local auth bridge is a clean cutover for pre-launch test users; old local
  `users_profile` rows should be recreated through the new `unuidentity` flow
  instead of being rebound automatically
- JavaScript and iOS verification remain intentionally split, so contributors
  need to decide explicitly when the iOS gate is in scope
