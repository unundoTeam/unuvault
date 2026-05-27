# Mac Companion MVP Evidence

## Design Source

- Pencil current: `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen`
- Current frame: `current/unuvault/mac-companion-core-flows-v1.1`

## Boundary

- The Mac companion is the local trusted root for local-first fill.
- The Web vault remains the management and review surface.
- Locked companion state rejects metadata and release.
- Unlocked companion state can return metadata for the active origin.
- Secret release requires `reason: "fill-active-page"` and local approval.
- Lost-device, revoke, lock, and timeout clear release ability.
- Web copy does not claim server-side plaintext recovery.

## Verification Commands

```bash
bash scripts/testing/run-macos.sh
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

The command builds and starts the menu bar app product. A captured native menu
visual proof is not claimed by this document.

## Remaining Proof Gaps

- Native app notarization and login-item behavior are not claimed.
- Touch ID is not claimed until LocalAuthentication proof exists.
- Physical iPhone pairing is not claimed until a real LAN pairing run is captured.
- Browser autofill completion after native approval is not claimed by this MVP.
- Server-backed account recovery is not claimed to recover plaintext without
  trusted user-held or device-held material.
