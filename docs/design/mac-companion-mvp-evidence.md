# Mac Companion MVP Evidence

## Design Source

- Pencil current: `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen`
- Current frame: `current/unuvault/mac-companion-core-flows-v1.2`

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

On 2026-05-28, the native menu bar product was synced to the approved current
source `current/unuvault/mac-companion-core-flows-v1.2`. The menu opens on a
trusted-status surface first, keeps credential entry behind an explicit
`Add login` action, and includes `zh-Hans` localized copy. Local screenshots:

- `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-menu-popover-v12-current.png`
- `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-menu-add-login-v12-current.png`
- `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-menu-popover-v12-zh-Hans.png`
- `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-menu-add-login-v12-zh-Hans.png`

## Automated Fill Proof

- `pnpm test:macos:security-preflight` checks the local Mac runtime before
  heavier native proof. It verifies macOS/Swift package readability, Keychain
  CLI access, LocalAuthentication framework linkage, default local vault
  directory writability, and the checked-in `LocalCompanionVaultStore` contract
  for Keychain-backed this-device-only AES-GCM storage. It does not launch the
  companion app, unlock a vault, prompt Touch ID, notarize the app, or claim Web
  fill release proof.
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

- Native app notarization and macOS login-item behavior are not claimed.
- Touch ID is not claimed until LocalAuthentication proof exists.
- Physical iPhone pairing receipt is claimed only after
  `pnpm test:pairing-physical-receipt` runs against a connected trusted iPhone
  and captures `UNUVAULT_IOS_PAIRING_RECEIPT paired`.
- The current iOS pairing proof is receive-side only; LAN discovery, QR code
  rendering/scanning, physical target-device identity proof, local decrypt or
  import, simulator/device visual parity, and physical iPhone receipt remain
  unclaimed.
- Account/Web sync into the Mac local vault is not claimed yet; direct native
  menu local-save and manual menu field entry into the encrypted Mac vault are
  covered by the current proof.
- Server-backed account recovery is not claimed to recover plaintext without
  trusted user-held or device-held material; the recovery-boundary proof now
  pins that constraint for the Mac companion encrypted local vault.
