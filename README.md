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
  `current/unuvault/mac-companion-core-flows-v1.3`.
- Current iOS source frames: `current/unuvault/ios-vault-home-native-locked-v1`
  and `current/unuvault/ios-pairing-invite-receive-v2`.
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
- `apps/ios/` - SwiftUI iPhone app, AutoFill onboarding, and Mac pairing
  payload contract
- `apps/macos/` - native Mac companion proof for local unlock, loopback
  credential release, and future device pairing
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
  - `bash scripts/testing/run-ios-ui-host.sh`
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

For the native Mac companion proof:

- `apps/macos/App` hosts the SwiftUI menu bar app and loopback bridge proof at
  `127.0.0.1:17666`
- the menu bar proof includes a Keychain-keyed local encrypted vault file for
  saving and unlocking local login items before release
- the Web vault surfaces the Mac companion boundary; the separate Mac companion
  client can request one active-origin release and claim it once after Mac-local
  approval, but Web does not approve or own plaintext release
- the browser extension can use the same Mac companion boundary to fill the
  current page after native approval, while keeping page URL context trusted by
  the extension background
- Mac companion security preflight is available through:
  `pnpm test:macos:security-preflight`
  This checks the local macOS runtime before heavier native proof: Swift package
  readability, Keychain CLI access, LocalAuthentication framework linkage,
  default local vault directory writability, and the checked-in local vault
  store contract for Keychain-backed this-device-only AES-GCM storage. It does
  not launch the companion app, unlock a vault, prompt Touch ID, notarize the
  app, or claim Web fill release proof.
- Mac companion local vault receipt is available through:
  `pnpm test:macos:local-vault-receipt`
  This runs focused Swift proof for encrypted local save/load without plaintext,
  wrong-key failure, short-lived local unlock sessions, recovery/lost-device
  boundaries, and native-approval one-time release. It does not claim Touch ID
  or physical iPhone proof.
- Mac companion local user-presence proof is available through:
  `pnpm test:macos:local-user-presence`
  This proves the `LocalAuthentication` code-boundary for local save and unlock
  paths: the menu app must receive successful local user presence before reading
  the encrypted local vault, saving through the read/append path, or opening an
  unlock session. It does not claim full Touch ID prompt screenshot,
  notarization, or physical iPhone proof.
- Mac companion Touch ID prompt UX receipt is available through:
  `pnpm test:macos:touch-id-prompt-receipt`
  Default mode builds a focused `LocalAuthentication` prompt host, wraps it in a
  product-named `UnuVault.app`, and runs a non-prompting readiness check. Add
  `-- --capture` only when an interactive local UX receipt is intended; that
  path triggers the real macOS owner-authentication prompt with the UnuVault
  bundle name plus localized reason and cancel copy, captures
  `touch-id-prompt.png`, and lets the host cancel itself after a timeout. It
  does not claim notarization or physical iPhone proof.
- Mac companion install-readiness proof is available through:
  `pnpm test:macos:install-readiness`
  This proves the native app links the macOS `ServiceManagement` launch-at-login
  API, exposes an injectable launch-at-login controller, maps enabled,
  disabled, approval-required, and unavailable states, and routes enable/disable
  requests through that controller without reading the encrypted local vault. It
  does not claim notarization, Apple Developer signing, real login-item
  persistence on a packaged build, Touch ID prompt screenshot UX, or physical
  iPhone proof.
- Mac companion distribution-readiness receipt is available through:
  `pnpm test:macos:distribution-readiness`
  This builds a temporary `UnuVaultMacCompanion.app`, validates its generated
  `Info.plist`, applies a local ad-hoc hardened-runtime signature with checked
  entitlements input, verifies the bundle seal, and reports Developer ID and
  `notarytool` credential blockers. It does not submit to Apple, staple a
  ticket, claim notarization, or claim Apple Developer-signed distribution.
  Add `-- --require-notarization` only when release credentials are expected and
  a missing certificate or notary credential should fail the gate.
- Mac companion packaged-app login item receipt is available through:
  `pnpm test:macos:login-item-receipt`
  This builds a temporary packaged `.app` receipt host and reads
  `SMAppService.mainApp.status` from inside that bundle. Add `-- --mutate` only
  for a reversible local register/cleanup receipt that touches this Mac's login
  items. It still does not claim notarization or Apple Developer signing.
- Mac companion Web/account import receipt is available through:
  `pnpm test:macos:account-import-receipt`
  This proves a Web/account unlocked vault payload can be sent through the
  bearer-protected Mac loopback bridge into the encrypted local vault, then
  released only through the existing Mac-local approval flow. It does not claim
  an automatic cloud sync daemon, server-side plaintext recovery, or physical
  iPhone proof.
- Web vault visible import control is covered by:
  `pnpm --filter @unuvault/web exec vitest --run tests/vault-page.spec.tsx`
  This proves the unlocked Web vault exposes `Save to this Mac`, decrypts only
  saved-password items in page memory, checks the local Mac companion status,
  disables import while the Mac app is unavailable or locked, and calls the Mac
  companion import client with the current account token only after the Web and
  Mac vault states are ready. It does not claim the Mac app was running during
  that browser test or that import happens automatically in the background.
- real native-process Web import proof is available through:
  `pnpm smoke:web-save-to-mac-companion`
  This opens a local Web harness at `127.0.0.1:3001`, clicks `Save to this Mac`
  in Chrome, posts the unlocked Web vault payload through the real Swift
  `MacCompanionSmokeHost` loopback bridge, verifies a locked Mac returns
  `vault_locked` without plaintext leakage, then verifies the unlocked Mac
  encrypted local vault can release the imported credential only through the
  existing approval and one-time claim flow. It does not claim automatic
  background sync, physical iPhone proof, notarization, or Touch ID prompt UX.
- packaged extension and live native-process fill proof is available through:
  `pnpm smoke:packaged-extension-mac-companion`
  The smoke host writes and reloads an encrypted local vault file before
  unlocking the bridge session.
- packaged extension plus real SwiftUI menu bar approval proof is available
  through: `pnpm smoke:menu-app-extension-mac-companion`
  This launches `UnuVaultMacCompanion`, captures the native pending-approval
  menu, clicks the Mac-local approval button through macOS UI scripting,
  verifies DOM fill, and verifies the approved release cannot be claimed twice.
- real SwiftUI menu bar local-save plus approval proof is available through:
  `pnpm smoke:menu-app-local-save-mac-companion`
  This launches `UnuVaultMacCompanion` with an isolated temporary vault,
  pre-fills the `Add login` form only in proof mode, saves through the real
  native menu button into the encrypted local vault file, unlocks that saved
  vault, then verifies the packaged browser extension can fill the active page
  only after Mac-local approval.
- real SwiftUI menu bar manual-entry plus approval proof is available through:
  `pnpm smoke:menu-app-manual-input-mac-companion`
  This launches the same isolated native companion, opens the real `Add login`
  menu surface without proof prefill, clicks each native field with a real
  mouse event, enters origin, label, username, and password through the focused
  menu fields, saves through the real native menu button, and then verifies
  unlock, Mac-local approval, extension fill, and one-time claim behavior.
- real SwiftUI menu bar security-boundary proof is available through:
  `pnpm smoke:menu-app-security-boundaries-mac-companion`
  This launches the packaged extension and native companion in a locked state,
  verifies locked release returns `vault_locked`, clicks native `Deny` and
  proves the page stays empty, then proves a Mac-approved release cannot be
  claimed from the wrong origin.
- Mac companion recovery-boundary proof is available through:
  `pnpm test:macos:recovery-boundary`
  This proves an encrypted local vault backup does not contain plaintext and
  can be restored only with the same user/device-held key material; lost or
  revoked device state clears pending release ability.
- Mac companion iOS pairing-boundary protocol proof is available through:
  `pnpm test:macos:pairing-boundary`
  This proves the first pairing session and handoff skeleton requires an
  unlocked Mac vault before issuing a QR payload, keeps the QR payload free of
  credential ids, usernames, passwords, and transfer material, transfers only
  AES-GCM wrapped vault material for a named target device, exposes a
  `/v1/pairing/claim` exchange that accepts a target claim without the Web
  bridge bearer token, wires that exchange into the proof-mode Mac companion
  runtime, emits an invite envelope with the Mac base URL plus the pairing
  payload for copy/QR handoff, cannot be opened with the wrong transfer
  material, rejects expired handoffs, rejects target public-key fingerprint
  mismatch, and rejects replay of already consumed sessions or handoffs. It
  does not claim real LAN or physical iPhone pairing yet.
- Cross-surface iOS/Mac pairing-boundary proof is available through:
  `pnpm test:pairing-boundary`
  This runs the iOS receive/client proof and the Mac companion pairing-boundary
  proof as one repo-level gate. It ties the iPhone target-claim client contract
  to the Mac runtime `/v1/pairing/claim` contract, while still stopping short of
  claiming real LAN discovery, camera QR scanning, physical iPhone receipt,
  local decrypt/import, or full mobile adapter adoption.
- LAN-address pairing smoke proof is available through:
  `pnpm test:pairing-lan-smoke`
  This resolves or accepts `UNUVAULT_PAIRING_LAN_HOST`, starts the proof-mode
  Mac companion bridge on `0.0.0.0`, emits an invite whose Mac base URL uses
  that non-loopback LAN IPv4 address, posts a target-device claim over real
  HTTP to `/v1/pairing/claim`, receives only AES-GCM wrapped handoff material,
  and proves replay fails without exposing credential ids, usernames, passwords,
  bridge bearer tokens, or vault plaintext. It still does not claim camera QR
  scanning, physical iPhone receipt, local decrypt/import, or full mobile
  adapter adoption.
- Physical iPhone pairing receipt harness is available through:
  `pnpm test:pairing-physical-preflight`
  Use this preflight first when the iPhone is not connected yet or when signing
  is uncertain. It checks the local LAN address, port availability, Xcode
  command-line tools, `xcodegen`, visible trusted iPhone, and signing hints,
  then prints `UNUVAULT_PHYSICAL_RECEIPT_PREFLIGHT status=ready` or the first
  precise blocker. It does not build, install, launch, wait for a receipt, or
  claim physical iPhone proof.
  `pnpm test:pairing-physical-receipt`
  This requires a connected, unlocked, trusted physical iPhone plus local iOS
  signing. It starts `MacPairingReceiptHost` on the Mac LAN address, installs
  `UnuVaultIOSHost`, launches it through a `unuvault-ioshost://pair` payload
  URL with a base64URL invite, and waits for
  `UNUVAULT_IOS_PAIRING_RECEIPT paired` in the device console. This is a
  physical receipt harness only; camera QR scanning, local decrypt/import, and
  full mobile adapter adoption remain separate claims.
- iOS Mac pairing receive proof is available through:
  `bash scripts/testing/run-ios.sh`
  This proves the iPhone app can parse the Mac pairing invite envelope and QR
  payload, reject expired, invalid-version, malformed, or unsupported-endpoint
  payloads, and build a target-device identity claim with `deviceId`,
  `displayName`, and `publicKeyFingerprint`. It also proves the approved
  `current/unuvault/ios-pairing-invite-receive-v2` SwiftUI receive flow can
  accept invite text before validation, surface the recognized Mac, hide raw
  invite session details after recognition, show invite expiry instead of a raw
  endpoint URL, disable pairing until an invite is valid, fail closed on expired
  invites, post the target claim to the invite-provided Mac pairing endpoint
  with no bridge bearer token, parse the Mac handoff response envelope, reject
  invalid, expired, status failed, or
  target-mismatched responses, and keep credential, password, and vault
  plaintext out of the claim/response contract. It does not claim camera QR
  scanning, real LAN discovery, local decrypt/import, or physical iPhone receipt
  yet.
- iOS receive-invite visual proof is available through:
  `bash scripts/testing/run-ios-ui-host.sh`
  This uses XcodeGen to build a simulator host app for
  `current/unuvault/ios-pairing-invite-receive-v2`, launches the SwiftUI screen
  with deterministic sample invite data, and writes normal plus `accessibility3`
  screenshots under
  `docs/design/evidence/2026-05-29-ios-ui-host/`. It proves simulator launch,
  screenshot capture, and Dynamic Type visual evidence for the receive-invite
  surface, but it still does not claim physical iPhone receipt, camera QR
  scanning, manual VoiceOver rotor proof, local decrypt/import, or full mobile
  adapter adoption.
- current implementation evidence is recorded in
  `docs/design/mac-companion-mvp-evidence.md`

For the private env-secrets bridge:

- enable the API surface with `UNUVAULT_ENABLE_DEV_SECRETS=1`
- the stable shell entrypoint is:
  `bash scripts/secrets/provider.sh read --app <app> --env <local|staging|production>`
- verify a stored record without releasing dotenv plaintext:
  `bash scripts/secrets/provider.sh verify --app <app> --env <local|staging|production>`
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
- `verify` prints only `VERIFY_OK <app>/<env>/dotenv` after successful decrypt
  and dotenv validation; it never prints the dotenv payload
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
  - `pnpm smoke:packaged-extension-mac-companion` when the packaged browser
    extension plus Mac companion fill boundary is in scope
  - `pnpm smoke:menu-app-extension-mac-companion` when the real SwiftUI menu
    bar approval interaction is in scope
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
