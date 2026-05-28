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
swift test --package-path apps/macos/App --filter LoopbackHTTPServerTests/testLoopbackReleaseRequiresNativeApprovalBeforeOneTimeClaim
bash scripts/testing/run-macos.sh
pnpm smoke:packaged-extension-mac-companion
pnpm smoke:menu-app-extension-mac-companion
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
  - `/Users/yuchen/Design/unu/unuvault/exports/2026-05-28-mac-companion-filled-page-real-app.png`
- `pnpm smoke:packaged-extension-mac-companion` builds
  `apps/browser-extension/dist`, loads it into Chrome through the CDP
  `Extensions.loadUnpacked` path, starts a separate Swift
  `MacCompanionSmokeHost` native process on loopback, writes and reloads an
  encrypted local vault file, triggers the packaged content script from the
  extension popup context, and verifies the real login page DOM receives the
  Mac-approved username and password.
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
- Physical iPhone pairing is not claimed until a real LAN pairing run is captured.
- Full product sync into the Mac local vault is not claimed yet; the current
  menu bar proof can save local login items directly.
- Server-backed account recovery is not claimed to recover plaintext without
  trusted user-held or device-held material.
