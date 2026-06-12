# Mac Companion MVP Evidence

## Design Source

- Pencil current: `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen`
- Current frame: `current/unuvault/mac-companion-core-flows-v1.3`

## Boundary

- The Mac companion is the local trusted root for local-first fill.
- The Mac companion stores local login items in an AES-GCM encrypted vault file;
  the default app key is created and read through Keychain.
- The Web vault remains the management and review surface.
- Locked companion state rejects metadata and release.
- Unlocked companion state can return metadata for the active origin.
- Secret release starts with `reason: "fill-active-page"`, creates a native
  pending approval, and does not expose plaintext to HTTP until Mac-local
  approval has happened.
- HTTP does not expose approve or deny endpoints; Web can only claim one
  approved release through `/v1/credentials/claim`.
- The browser extension can use Mac companion metadata, request native approval,
  claim the approved release once, and fill the current page DOM from that
  claimed credential.
- Lost-device, revoke, lock, and timeout clear release ability.
- Web copy does not claim server-side plaintext recovery.

## Verification Commands

```bash
pnpm test:macos:security-preflight
pnpm test:macos:install-readiness
pnpm test:macos:distribution-readiness
pnpm test:macos:login-item-receipt
pnpm test:macos:local-vault-receipt
pnpm test:macos:local-user-presence
pnpm test:macos:touch-id-prompt-receipt
pnpm test:macos:account-import-receipt
swift test --package-path apps/macos/App --filter LoopbackHTTPServerTests/testLoopbackReleaseRequiresNativeApprovalBeforeOneTimeClaim
bash scripts/testing/run-macos.sh
pnpm test:pairing-boundary
pnpm test:pairing-lan-smoke
pnpm test:pairing-physical-receipt
pnpm test:macos:pairing-boundary
pnpm test:macos:recovery-boundary
pnpm smoke:packaged-extension-mac-companion
pnpm smoke:menu-app-extension-mac-companion
pnpm smoke:menu-app-local-save-mac-companion
pnpm smoke:menu-app-manual-input-mac-companion
pnpm smoke:menu-app-security-boundaries-mac-companion
pnpm --filter @unuvault/browser-extension exec vitest --run tests/autofill.spec.ts tests/background-unlocked-vault.spec.ts
pnpm --filter @unuvault/browser-extension lint
pnpm --filter @unuvault/web exec vitest --run tests/mac-companion-client.spec.ts tests/vault-page.spec.tsx
pnpm exec vitest --run tests/workspace-entrypoints.spec.ts
pnpm --filter @unuvault/web exec vitest --run tests/react-css-adapter-evidence.spec.tsx
pnpm --filter @unuvault/web lint
pnpm lint
pnpm test
```

## Manual Smoke

```bash
swift run --package-path apps/macos/App UnuVaultMacCompanion
```

The command builds and starts the menu bar app product. On 2026-05-27, an
earlier native menu bar item was opened through macOS UI scripting
(`menu bar item 1 of menu bar 2` for process `UnuVaultMacCompanion`) and
captured as previous local visual evidence:

- `/Users/yuchen/Design/unu/unuvault/exports/2026-05-27-mac-companion-menu-popover-light-polished-v2.png`

Earlier v1.2 evidence from 2026-05-28 showed the native menu bar product synced
to `current/unuvault/mac-companion-core-flows-v1.2`. The menu opened on a
trusted-status surface first, kept credential entry behind an explicit
`Add login` action, and included `zh-Hans` localized copy. The current Mac
companion source is now `current/unuvault/mac-companion-core-flows-v1.3`.
Historical screenshots:

- `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-menu-popover-v12-current.png`
- `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-menu-add-login-v12-current.png`
- `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-menu-popover-v12-zh-Hans.png`
- `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-menu-add-login-v12-zh-Hans.png`

On 2026-06-12, the current source was restored as
`current/unuvault/mac-companion-core-flows-v1.3` after the native menu overview
added a visible `Open at login` setting row. The v1.3 frame keeps the menu bar
companion as the local trust root and maps the setting to a native SwiftUI
`Toggle` without changing unlock, fill approval, or credential release
boundaries. Local screenshot:

- `/Users/yuchen/Design/unu/unuvault/exports/2026-06-12-mac-companion-v13-open-at-login/O1eT4.png`

## Automated Fill Proof

- `pnpm test:macos:security-preflight` checks the local Mac runtime before
  heavier native proof. It verifies macOS/Swift package readability, Keychain
  CLI access, LocalAuthentication framework linkage, default local vault
  directory writability, and the checked-in `LocalCompanionVaultStore` contract
  for Keychain-backed this-device-only AES-GCM storage. It does not launch the
  companion app, unlock a vault, prompt Touch ID, notarize the app, or claim Web
  fill release proof.
- `pnpm test:macos:local-vault-receipt` runs the focused Swift receipt for the
  local vault chain that does not need a physical iPhone: encrypted local
  save/load without plaintext, wrong-key failure, short-lived unlock session
  behavior, recovery/lost-device release clearing, and native-approval
  one-time claim. It still does not claim Touch ID, notarization, camera QR
  scanning, or physical iPhone receipt.
- `pnpm test:macos:local-user-presence` runs the focused `LocalAuthentication`
  code-boundary proof for Mac local save and unlock paths. It proves denied or
  unavailable local user presence prevents local vault reads, blocks local
  credential saves, and keeps the session locked, while proof mode can inject a
  deterministic allow authorizer. It still does not claim full Touch ID prompt
  screenshot, notarization, camera QR scanning, or physical iPhone receipt.
- `pnpm test:macos:touch-id-prompt-receipt` runs the Touch ID prompt UX receipt
  gate. Default mode builds a focused `LocalAuthentication` prompt host, wraps
  it in a product-named `UnuVault.app`, and performs a non-prompting readiness
  check so routine verification does not interrupt the operator. Passing
  `-- --capture` starts the real macOS owner-authentication prompt with the
  UnuVault bundle name and localized reason copy, waits briefly, saves
  `docs/design/evidence/<date>-mac-touch-id-prompt/touch-id-prompt.png`, and
  lets the prompt host cancel itself after the timeout. This can record a real
  local screenshot receipt for the Touch ID/system authentication UX, but still
  does not claim notarization, camera QR scanning, or physical iPhone receipt.
  On 2026-06-13, a localized product-named local capture produced:
  `docs/design/evidence/2026-06-13-mac-touch-id-prompt-localized/touch-id-prompt.png`.
  The receipt recorded
  `UNUVAULT_MAC_TOUCH_ID_PROMPT_RECEIPT status=prompt_requested`,
  `reason="解锁这台 Mac 上的本地保险库"`,
  `biometry=touch_id can_biometrics=true`, and
  `result=denied error_domain=com.apple.LocalAuthentication error_code=-9`
  after the prompt host timed out and cancelled the prompt. The checked-in
  screenshot is cropped from the full-screen temporary capture so only the
  macOS owner-authentication prompt is retained. This supersedes the earlier
  product-named English-reason capture for UX presentation because the system
  dialog no longer mixes English reason copy into the Chinese macOS prompt.
  The earlier product-named English-reason capture remains retained at:
  `docs/design/evidence/2026-06-13-mac-touch-id-prompt-product/touch-id-prompt.png`.
  That version already shows the product name `UnuVault`, but the reason copy
  is no longer the preferred Chinese-localized receipt.
  The earlier 2026-06-12 local capture remains retained at:
  `docs/design/evidence/2026-06-12-mac-touch-id-prompt/touch-id-prompt.png`.
  That baseline proves the system prompt path but shows the internal receipt
  host name and is no longer the product-quality UX receipt.
- `pnpm test:macos:install-readiness` runs the focused install-readiness proof
  for the Mac companion startup boundary. It links `ServiceManagement`, reads
  `SMAppService.mainApp.status`, and verifies the view model can use an
  injectable launch-at-login controller to report enabled, disabled,
  approval-required, or unavailable states and route enable/disable requests
  without touching the encrypted vault. The menu overview exposes those states
  through a native SwiftUI `Toggle` with accessibility and localization
  coverage. It still does not claim notarization, Apple Developer signing, real
  login-item persistence on a packaged build, full Touch ID prompt screenshot
  UX, camera QR scanning, or physical iPhone receipt.
- `pnpm test:macos:distribution-readiness` runs the native Mac companion
  distribution-readiness receipt. It builds a temporary
  `UnuVaultMacCompanion.app`, validates the generated `Info.plist`, signs it
  locally with an ad-hoc hardened-runtime signature and checked entitlements
  input, verifies the bundle seal, and reports whether Developer ID certificate
  and `notarytool` credential prerequisites are blocked. Default mode records a
  blocked receipt without failing when release credentials are absent; use
  `-- --require-notarization` only for a real release-preflight gate. This does
  not claim notarization, a stapled ticket, App Store distribution, or an Apple
  Developer-signed release.
- `pnpm test:macos:login-item-receipt` runs the packaged-app login item receipt.
  It builds a temporary `.app` wrapper for `MacLoginItemReceiptHost` and reads
  `SMAppService.mainApp.status` from inside the bundled executable, proving the
  login item code path is no longer only a raw CLI status check. By default it
  is read-only. Passing `-- --mutate` attempts a reversible local
  register/cleanup receipt for this Mac's login items, and should be used only
  when that local mutation is intentionally approved. It still does not claim
  notarization or Apple Developer signing.
- `pnpm test:macos:account-import-receipt` runs the focused Web/account to Mac
  local vault receipt. It proves a Web/account unlocked vault payload can be
  posted through the bearer-protected Mac loopback bridge only while the local
  vault session is already unlocked, persisted into the encrypted local vault
  without plaintext at rest, then released only through the existing Mac-local
  approval and one-time claim flow. The cloud sync daemon is not claimed, and
  this still does not claim server-side plaintext recovery, Touch ID prompt
  screenshot UX, notarization, camera QR scanning, or physical iPhone receipt.
- `pnpm --filter @unuvault/web exec vitest --run tests/vault-page.spec.tsx`
  covers the visible Web vault import entrypoint aligned to
  `current/unuvault/web-vault-management-v1`: `Save to this Mac` is disabled
  while the Web vault is locked, decrypts only saved-password items after Web
  unlock, reads Mac companion status, keeps import disabled while the Mac app is
  unavailable or locked, sends those credentials through the Mac companion
  import client with the current account token only after both vault states are
  ready, and shows a success receipt. This is a Web UI behavior proof; it does
  not claim the native Mac process was running during the browser test or
  automatic background sync into the Mac vault.
- `pnpm smoke:web-save-to-mac-companion` runs the real native-process Web import
  proof. It starts a local Web harness on `127.0.0.1:3001`, clicks
  `Save to this Mac` in Chrome, posts the unlocked Web vault payload through the
  real Swift `MacCompanionSmokeHost` loopback bridge, verifies a locked Mac
  returns `vault_locked` without plaintext leakage, then verifies the unlocked
  Mac encrypted local vault can release the imported credential only through
  the existing approval and one-time claim flow. This does not claim automatic background sync,
  server-side plaintext recovery, Touch ID prompt screenshot UX, notarization,
  camera QR scanning, or physical iPhone receipt.
- `pnpm smoke:menu-app-extension-mac-companion` builds the packaged browser
  extension, starts the real `UnuVaultMacCompanion` SwiftUI menu bar app with
  an isolated temporary encrypted vault, triggers the packaged content script,
  captures the native pending approval menu, clicks the Mac-local
  `Fill once` / `填充一次` approval through macOS UI scripting, verifies the
  real login page DOM receives the Mac-approved username and password, and
  verifies a second `/v1/credentials/claim` returns
  `credential_not_found`. Captured 2026-05-28 evidence:
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-menu-approval-real-app-full.png`
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-menu-approval-real-app.png`
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-menu-approval-filled-page-real-app.png`
- `pnpm smoke:menu-app-local-save-mac-companion` builds the packaged browser
  extension, starts the real `UnuVaultMacCompanion` SwiftUI menu bar app with
  an isolated temporary encrypted vault, opens the native `Add login` menu
  surface, pre-fills the form only in proof mode, saves through the real native
  `Save` button into the encrypted local vault file, unlocks the saved local
  vault through the native menu, then verifies extension autofill and one-time
  claim behavior after Mac-local approval. Captured 2026-05-28 evidence:
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-local-save-form-real-app-full.png`
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-local-save-real-app-full.png`
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-local-save-filled-page-real-app.png`
- `pnpm smoke:menu-app-manual-input-mac-companion` builds the packaged browser
  extension, starts the real `UnuVaultMacCompanion` SwiftUI menu bar app with
  an isolated temporary encrypted vault, opens the native `Add login` menu
  surface without proof prefill, clicks each native field with a real mouse
  event, enters origin, label, username, and password through the focused menu
  fields, saves through the real native `Save` button, unlocks the saved local
  vault through the native menu, then verifies extension autofill and one-time
  claim behavior after Mac-local approval. Captured 2026-05-28 evidence:
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-manual-input-form-real-app-full.png`
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-manual-input-real-app-full.png`
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-manual-input-filled-page-real-app.png`
- `pnpm smoke:menu-app-security-boundaries-mac-companion` builds the packaged
  browser extension, starts the real `UnuVaultMacCompanion` SwiftUI menu bar
  app with an isolated temporary encrypted vault, verifies the locked bridge
  returns `vault_locked` without filling the page, clicks native `Deny` and
  proves the page stays empty, then approves one pending release and proves a
  wrong-origin claim returns `credential_not_found` before the trusted origin
  can claim it exactly once. Captured 2026-05-28 evidence:
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-security-boundaries-locked-page-real-app.png`
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-security-boundaries-deny-real-app-full.png`
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-security-boundaries-denied-page-real-app.png`
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-security-boundaries-wrong-origin-page-real-app.png`
- `pnpm smoke:packaged-extension-mac-companion` builds
  `apps/browser-extension/dist`, loads it into Chrome through the CDP
  `Extensions.loadUnpacked` path, starts a separate Swift
  `MacCompanionSmokeHost` native process on loopback, writes and reloads an
  encrypted local vault file, triggers the packaged content script from the
  extension popup context, and verifies the real login page DOM receives the
  Mac-approved username and password.
- `pnpm test:macos:pairing-boundary` proves the first iOS pairing handoff
  protocol skeleton requires an unlocked Mac vault before issuing a QR payload,
  keeps that QR payload free of credential ids, usernames, passwords, and
  transfer material, emits target-device metadata plus AES-GCM wrapped vault
  material only, restores only with the same transfer material, and fails
  closed with the wrong transfer material. It also proves sessions and handoffs
  expire, QR nonce mismatch is rejected, target public-key fingerprint mismatch
  is rejected, and replay of an already consumed session or handoff fails
  closed. The HTTP codec now also exposes a `/v1/pairing/claim` exchange for
  the target claim, authenticated by the QR session nonce rather than the Web
  bridge bearer token, and the proof-mode Mac companion runtime wires that
  exchange into its real loopback server after `pairIPhone()` starts a session.
  The runtime also emits an invite envelope containing the Mac base URL plus
  the pairing payload, so the next QR/copy handoff can carry the endpoint
  without exposing credential or vault plaintext. It does not claim a real LAN
  or physical iPhone pairing run.
- `pnpm test:pairing-boundary` runs both the iOS receive/client proof and the
  Mac companion pairing-boundary proof as one repo-level gate. This ties the
  iPhone target-claim client contract to the Mac runtime `/v1/pairing/claim`
  contract, while still avoiding claims for real LAN discovery, camera QR
  scanning, physical iPhone receipt, local decrypt/import, or full mobile
  adapter adoption.
- `pnpm test:pairing-lan-smoke` resolves or accepts
  `UNUVAULT_PAIRING_LAN_HOST`, starts the proof-mode Mac companion bridge on
  `0.0.0.0`, emits an invite with the non-loopback LAN IPv4 base URL, posts a
  target-device claim over real HTTP to `/v1/pairing/claim`, receives only
  AES-GCM wrapped handoff material, and proves replay fails without exposing
  credential ids, usernames, passwords, bridge bearer tokens, or vault
  plaintext. This is LAN-address transport proof only; it still does not claim
  camera QR scanning, physical iPhone receipt, local decrypt/import, or full
  mobile adapter adoption.
- `pnpm test:pairing-physical-preflight` checks local LAN address resolution,
  port availability, Xcode tools, `xcodegen`, visible trusted iPhone detection,
  and signing hints before a real device run. It does not build, install,
  launch, wait for a receipt, or claim physical iPhone proof.
- `pnpm test:pairing-physical-receipt` starts `MacPairingReceiptHost` on the
  Mac LAN address, installs the XcodeGen-backed `UnuVaultIOSHost` on a
  connected trusted iPhone, launches it through `xcrun devicectl` with a
  `unuvault-ioshost://pair` payload URL containing a base64URL invite, and
  waits for `UNUVAULT_IOS_PAIRING_RECEIPT paired` in the device console. The
  harness is the first physical receipt gate; camera QR scanning,
  local decrypt/import, and full mobile adapter adoption remain separate
  claims.
- `bash scripts/testing/run-ios.sh` proves the iPhone package can parse the Mac
  pairing invite envelope and QR payload, reject expired, invalid-version,
  malformed, or unsupported-endpoint payloads, and build a target-device
  identity claim with `deviceId`, `displayName`, and `publicKeyFingerprint`
  without encoding credential, password, or vault material. It also proves the
  approved `current/unuvault/ios-pairing-invite-receive-v2` SwiftUI receive
  flow accepts invite text before validation, shows the recognized Mac, hides raw
  invite session details after recognition, shows invite expiry instead of a raw
  endpoint URL, disables pairing until invite validation, fails closed on expired
  invites, posts the claim to the
  invite-provided Mac pairing endpoint without a bridge bearer token, parses Mac
  handoff response envelopes, and rejects invalid, expired, status-failed, or
  target-mismatched responses. It does not claim camera QR scanning, real LAN
  discovery, local decrypt/import, or physical iPhone receipt.
- `pnpm test:macos:recovery-boundary` proves encrypted local vault backup data
  contains only an AES-GCM envelope, does not contain the credential id,
  username, or password as plaintext, cannot be opened with account-only or
  wrong device material, and can be restored only with the same user/device-held
  key material. It also proves lost or revoked device state clears pending
  release ability and rejects subsequent release or claim attempts.
- `LocalCompanionVaultStoreTests` prove local credential files do not contain
  the saved username or password as plaintext and cannot be opened with the
  wrong local key.
- `LoopbackHTTPServerTests.testLoopbackReleaseRequiresNativeApprovalBeforeOneTimeClaim`
  proves the native loopback bridge creates a pending approval, rejects HTTP
  approve, accepts a Mac-local approval, and releases a claimed credential only
  once.
- `apps/browser-extension/tests/autofill.spec.ts` proves the extension content
  script and background runtime can turn a Mac companion approval/claim result
  into actual username and password DOM field values.
- `apps/browser-extension/tests/background-unlocked-vault.spec.ts` proves the
  existing extension unlocked-cache path still works when the Mac companion is
  unavailable.

## Remaining Proof Gaps

- Native app notarization and Apple Developer signing are not claimed. The
  current install-readiness proof covers the `ServiceManagement` code boundary,
  and the packaged login-item receipt covers bundled `SMAppService.mainApp`
  status. Real login-item register/cleanup persistence requires the explicit
  `pnpm test:macos:login-item-receipt -- --mutate` path.

On 2026-06-12, `pnpm test:macos:login-item-receipt -- --mutate` produced a
local packaged-app receipt: initial status `not_found`, after register
`enabled`, and after cleanup `disabled`. That proves the temporary bundled app
can register and clean up a macOS login item on this Mac. It still does not
claim notarization, Apple Developer signing, or persistence for a user-installed
production app bundle.
- Full Touch ID prompt screenshot UX is now backed by the 2026-06-13 localized
  product-named local capture above. Future prompt wording, app bundle naming,
  or macOS authentication UI changes should refresh that receipt. The default
  receipt gate remains non-prompting.
- Physical iPhone pairing receipt is claimed only after
  `pnpm test:pairing-physical-receipt` runs against a connected trusted iPhone
  and captures `UNUVAULT_IOS_PAIRING_RECEIPT paired`.
- The current iOS pairing proof is receive-side only; LAN discovery, QR code
  rendering/scanning, physical target-device identity proof, local decrypt or
  import, simulator/device visual parity, and physical iPhone receipt remain
  unclaimed.
- Automatic Account/Web sync into the Mac local vault is not claimed yet; the
  current proof covers a Web/account unlocked vault payload import receipt into
  the encrypted Mac vault, plus direct native menu local-save and manual menu
  field entry.
- Server-backed account recovery is not claimed to recover plaintext without
  trusted user-held or device-held material; the recovery-boundary proof now
  pins that constraint for the Mac companion encrypted local vault.
