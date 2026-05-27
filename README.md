# unuvault

unuvault is a Chinese-first public cloud password manager for technical users
who want a more trustworthy home for credentials than browser-native storage.
面向中文技术用户，首阶段聚焦浏览器扩展、Web vault 与 iPhone 的安全可信密码管理体验。


## What This Repo Owns

- the unuvault product boundary across web, API, browser-extension, iOS, and
  planned macOS companion surfaces
- vault, devices, imports, activity, and trust-center product behavior
- product-local data contracts and the client-side security model for vault
  access

### Canonical Identity And Local Vault Boundary

`unuvault` keeps account identity, vault unlock, and device trust as separate
concepts:

1. Account identity answers who owns sync, recovery, device management, and
   account-level activity.
2. Vault unlock answers whether this local session can release secrets.
3. Device trust answers which clients may sync, fill, recover, or receive vault
   material.

Local-only vault use can avoid account login, but it still requires vault
unlock before credentials are revealed, copied, filled, exported, or
transferred. Account-enabled surfaces use one shared auth contract across Web,
API, and browser-extension surfaces:

1. `unuidentity` plus Supabase Auth authenticate the person and issue the
   identity session.
2. `unuvault` API `POST /auth/bootstrap` is the product identity bridge that
   turns a valid bearer token into a `users_profile`-backed product identity.
3. Product runtime routes such as `/vault/sync` consume that bootstrapped
   identity instead of replacing it with a second auth system.

The surface-specific entry paths differ, but the bridge semantics stay the
same:

- Web:
  `unuidentity signup/login -> /auth/callback -> /auth/finalize -> POST /auth/bootstrap`
- browser-extension:
  extension identity sign-in -> `POST /auth/bootstrap` -> background
  `signed_in`
- iPhone:
  repo-owned, but still expected to follow the same bridge model once its auth
  surface is fully live

The account layer must not be described as the reader of plaintext passwords.
It exists to coordinate encrypted sync, device revocation, recent activity, and
recovery flows; vault unlock remains the secret-release boundary.

## What It Does Not Own

- the shared identity and account platform owned by `unuidentity`
- the shared machine automation core owned by `unuforge`
- portfolio-wide governance and rollout policy owned by `unuOS`

## Source Of Truth

- `docs/superpowers/specs/2026-03-14-chinese-password-manager-phase1-design.md`
  for product scope and trust posture
- `docs/architecture/0000-phase1-execution-baseline.md` for the execution
  baseline
- `docs/architecture/0006-local-first-recovery-boundary.md` for local-first,
  account-optional, device-loss, and recovery semantics
- `docs/architecture/0007-mac-companion-boundary.md` for the planned native
  macOS companion, loopback bridge, local unlock, and iOS pairing boundary
- `docs/superpowers/plans/2026-03-14-chinese-password-manager-phase1-roadmap.md`
  for the engineering roadmap
- this README for contributor-facing local entrypoints and current contract
  posture
- [the sibling `unuOS` repo's `docs/portfolio/README.md`](https://github.com/unundoTeam/unuos/blob/main/docs/portfolio/README.md)
  for portfolio overview and cross-repo authority
- [the sibling `unuOS` repo's design foundation contract](https://github.com/unundoTeam/unuos/blob/main/docs/portfolio/design-foundation-contract.md)
  and [common component contract](https://github.com/unundoTeam/unuos/blob/main/docs/portfolio/common-component-contract.md)
  for shared web foundation variables and common component semantics; palette,
  brand, typography, and implementation details remain repo-local

## Design Authority

- First design read:
  `/Users/yuchen/Code/unu/unuOS/docs/portfolio/design-operating-index.md`;
  it is the only first-read design authority.
- Current design status: `registered`.
- Pencil current:
  `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen`.
- Pencil draft:
  `/Users/yuchen/Design/unu/unuvault/unuvault.draft.pen`.
- Current design-system frame: `current/unuvault/design-system-v1`.
- Current web source frame: `current/unuvault/web-vault-management-v1`.
- Current Mac companion source frame:
  `current/unuvault/mac-companion-core-flows-v1.1`.
- Small UI copy or polish uses the `Lightweight UI Path` in the portfolio
  Pencil gate.
- Historical design specs are planning context only unless the operating index
  or this repo-local entrypoint explicitly routes to them.
- The legacy product-scope spec named above is routed only through
  `/Users/yuchen/Code/unu/unuOS/docs/portfolio/design-specs-inventory.md`
  as `current-routed` product scope and trust posture context; it is not broad
  Pencil or current UI authority.
- Future material web, extension, or iOS UI changes start in the registered
  draft file, promote only approved frames into current, and keep the current
  screen/state frame aligned with the shipped UI.

### Runtime Authority

`unuvault` keeps runtime authority routing separate from the core auth and
verification shell. Start with
[docs/operations/runtime-authority.md](docs/operations/runtime-authority.md)
for the current first-layer entrypoint.

- `incident`: first route through
  `docs/operations/incident-observability-authority.md`, then into cutover,
  env, and security-boundary detail
- `observability`: a minimal authority page now exists, but it still describes
  a limited pre-launch program rather than a mature telemetry stack
- `production-readiness`: launch checklist, dry-run rehearsal, and
  repo-local hosted-pass plus upstream operator-reviewed sign-off routing now
  live together under
  `docs/operations/runtime-authority.md`

## Workspace Layout

- `apps/api/` - account, vault, devices, imports, and activity APIs
- `apps/web/` - onboarding, vault management, and trust-center flows
- `apps/browser-extension/` - popup, autofill, and extension auth surfaces
- `apps/ios/` - SwiftUI iPhone app and AutoFill onboarding
- `apps/macos/App/` - Swift package skeleton for the native Mac companion proof
  covering local unlock, loopback credential release, and device pairing
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
  - `bash scripts/testing/run-macos.sh`
  - `python3 scripts/ci/tests/test_unuforge_package_consumer_smoke.py`
  - `python3 scripts/ci/tests/test_unuforge_ios_package_consumer_smoke.py`

For local MVP auth setup:

- the checked-in `apps/web/.env.example` and `apps/api/.env.example` files are
  hosted onboarding examples for running the local web/API loop against real
  Supabase projects, not local Supabase port-contract files
- copy `apps/web/.env.example` to `apps/web/.env.local`
- copy `apps/api/.env.example` to `apps/api/.env.local`
- replace the placeholder project refs and keys with real hosted project values
  while keeping the documented local runtime fields concrete
- the local auth loop is:
  `unuidentity signup/login -> /auth/callback -> /auth/finalize -> POST /auth/bootstrap`
- `/auth/finalize` is not the final authority by itself; it is the Web surface
  handoff that completes the repo-wide product bridge through
  `POST /auth/bootstrap`
- `unuidentity` needs a redirect URL for
  `http://127.0.0.1:3001/auth/callback` during local development

Browser-facing product and identity env in `apps/web/.env.example`:

| Variable | Required | Surface | Layer | Source repo | Default/example | Public |
| --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | client | public-client | `unuvault` | `https://your-product-project-ref.supabase.co` | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | client | public-client | `unuvault` | `your-product-anon-key` | yes |
| `NEXT_PUBLIC_IDENTITY_SUPABASE_URL` | yes | client | identity | `unuidentity` | `https://your-identity-project-ref.supabase.co` | yes |
| `NEXT_PUBLIC_IDENTITY_SUPABASE_ANON_KEY` | yes | client | identity | `unuidentity` | `your-identity-anon-key` | yes |
| `NEXT_PUBLIC_API_BASE_URL` | yes | client | public-client | `unuvault` | `http://localhost:3000` | yes |

Shared identity and product-data env in `apps/api/.env.example`:

| Variable | Required | Surface | Layer | Source repo | Default/example | Public |
| --- | --- | --- | --- | --- | --- | --- |
| `IDENTITY_SUPABASE_URL` | yes | server | identity | `unuidentity` | `https://your-identity-project-ref.supabase.co` | yes |
| `IDENTITY_SUPABASE_SERVICE_ROLE_KEY` | yes | server | identity | `unuidentity` | `your-identity-service-role-key` | no |
| `SUPABASE_URL` | yes | server | product-data | `unuvault` | `https://your-project-ref.supabase.co` | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | server | product-data | `unuvault` | `your-service-role-key` | no |
| `HOST` | yes | server | product-data | `unuvault` | `127.0.0.1` | yes |
| `PORT` | yes | server | product-data | `unuvault` | `3000` | yes |
| `UNUVAULT_BRIDGE_TOKEN` | yes for local credential bridge | server | local-bridge | `unuvault` | short-lived local token | no |

For the local credential bridge:

- keep the API bound to `HOST=127.0.0.1` and `PORT=3000`
- set `UNUVAULT_BRIDGE_TOKEN` and pass the same value to the local bridge
  client as `UNUVAULT_BRIDGE_TOKEN`
- point the local bridge client at `UNUVAULT_BRIDGE_URL=http://127.0.0.1:3000`
- when the Web vault is unlocked, it publishes a short-lived in-memory bridge
  session through `PUT /v1/credentials/unlocked-session` using the user's
  Web session token
- locking the Web vault clears that bridge session through
  `DELETE /v1/credentials/unlocked-session`
- `GET /v1/credentials?origin=<origin>&profileId=<profileId>` returns only
  credential metadata: `id`, `label`, and `username`
- `POST /v1/credentials/release` releases one `{ username, password }` payload
  only for `reason: "fill-active-page"` and records a non-secret audit event
- the API bridge reads from a local unlocked credential provider; it does not
  treat encrypted `vault_items` rows as server-readable plaintext
- the bridge must clear unlocked sessions on lock, timeout, revoke, or
  lost-device state; account-enabled bridge flows may use the Web session token,
  but local-only bridge flows still need an equivalent local trust proof
- optional local smoke server:
  `UNUVAULT_BRIDGE_SMOKE_ORIGIN=<origin> pnpm smoke:local-credential-bridge-server`
  starts the real bridge routes with an in-memory unlocked session for bridge
  clients

For the private env-secrets bridge:

- enable the API surface with `UNUVAULT_ENABLE_DEV_SECRETS=1`
- the stable shell entrypoint is:
  `bash scripts/secrets/provider.sh read --app <app> --env <local|staging|production>`
- the matching import entrypoint is:
  `bash scripts/secrets/provider.sh import --app <app> --env <local|staging|production> --from /absolute/path/to/<env>.env`
- the TypeScript command module is also exposed as:
  `pnpm secrets:provider --help`
- the currently supported private namespaces are:
  - `unundo/local/dotenv`
  - `unundo/staging/dotenv`
  - `unundo/production/dotenv`
  - `unuidentity/local/dotenv`
  - `unuidentity/staging/dotenv`
  - `unuidentity/production/dotenv`
- `read` prints plaintext only to `stdout` on success
- `import` prints only a safe summary to `stderr` before confirmation and upload
- this remains a developer-owned private record surface rather than a team-wide
  shared secrets platform
- CI and other non-interactive callers should provide a short-lived
  `UNUVAULT_DEV_SECRETS_CLI_SESSION_TOKEN` instead of relying on browser handoff

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
  - `bash scripts/testing/run-macos.sh` when the macOS companion surface is in
    scope
  - `python3 scripts/ci/tests/test_unuforge_ios_package_consumer_smoke.py` for
    the repo-owned installed-package iOS path

The repo-level auth machine verification guard lives in
`tests/auth-boundary-contract.spec.ts`. It pins the canonical Web/API/browser-extension
auth boundary against the root docs and the owning surface tests.

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

Agent-led delivery status, review-status reporting, commit closeout, push, and
cleanup defaults follow the portfolio delivery authority in
`/Users/yuchen/Code/unu/unuOS/docs/portfolio/agent-delivery-defaults.md`.

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
- production-landing authority is now split across:
  - `docs/operations/identity-production-cutover-rehearsal.md` for the
    repo-local dry-run env, verification, and rollback mapping
  - `docs/operations/identity-production-cutover-hosted-pass.md` for the
    current repo-local hosted-pass boundary without publishing live hosted
    inventory
  - `unuidentity/docs/operations/unuvault-cutover-operator-signoff.md` for the
    first real operator-reviewed cutover-preparation pass
  - `unuidentity/docs/operations/production-landing-completion.md` for the
    bounded checked-in result-layer production landing completion record
- as of 2026-04-25, the checked-in production-landing route is closed through
  those repo-local and upstream records; future live-target changes still need
  the upstream consumer cutover checklist plus repo-local verification before
  being called complete
- the repo-local `unuvault` records still do not publish live hosted inventory,
  callback payloads, or secret values, and they do not by themselves claim live
  hosted-identity execution
- the local auth bridge is a clean cutover for pre-launch test users; old local
  `users_profile` rows should be recreated through the new `unuidentity` flow
  instead of being rebound automatically
- JavaScript and iOS verification remain intentionally split, so contributors
  need to decide explicitly when the iOS gate is in scope
