# unuvault iOS

This directory holds the SwiftUI iPhone app, AutoFill onboarding flows, and the
repo-owned Mac pairing receive flow for unuvault.

The iOS package exposes the native SwiftUI composition from
`current/unuvault/ios-product-composition-v1` and the paste-invite flow from
`current/unuvault/ios-pairing-invite-receive-v3`. Vault and Pairing remain
reachable destinations. On startup, the app loads the app-default encrypted
received-vault store: non-empty read-only metadata selects Vault, while an empty
store selects Pairing. Import success alone does not switch destinations; only
a fresh successful reload of non-empty metadata from that same store selects
Vault. A failed or empty post-import reload stays on Pairing and exposes Retry.

The receive flow parses the Mac companion invite envelope and QR payload,
rejects expired, malformed, or unsupported endpoint payloads, shows the
recognized Mac, hides raw invite session details after recognition, builds a
claimant-provided device identity claim, and posts that claim without a bridge
bearer token. The current V1 handoff is encrypted to the claimant-provided
iPhone key agreement identity, opened locally, and persisted into an AES-GCM
received-vault store whose 256-bit key is held in Keychain. The read-only vault
list loads label, username, and website-origin metadata from that store while
keeping passwords out of the list model. It does not claim camera QR scanning,
automatic LAN discovery, password reveal/copy, editing, search, biometric
unlock, cloud sync, or a shipped full mobile vault workflow. Repo-level
`pnpm test:pairing-lan-smoke` now proves the Mac runtime can accept the target
claim through a non-loopback LAN IPv4 base URL, but that command is still not a
physical iPhone import receipt or camera QR scan proof.

The current V1 claim does not authenticate that claimant as the intended iPhone.
Target-claim authentication, fresh Mac owner approval, restart-persistent replay
rejection, and V2-to-V1 no-downgrade semantics remain pending in
`docs/superpowers/specs/2026-07-10-authenticated-pairing-approval-design.md`.
That file is protocol/security authority only and does not change the current
v3 composition or UI authority.

Physical receipt proof is available only when a real trusted iPhone is
connected:

```bash
pnpm test:pairing-physical-preflight
pnpm test:pairing-physical-receipt
```

Run the preflight first to check LAN address, port availability, Xcode tools,
`xcodegen`, visible trusted iPhone, and signing hints without building,
installing, or launching the app. The receipt wrapper starts the Mac receipt
host, installs `UnuVaultIOSHost` on the device, launches it with a
`unuvault-ioshost://pair` payload URL, and waits for
`UNUVAULT_IOS_PAIRING_RECEIPT imported` in the iPhone console.
The latest recorded hardware run on 2026-07-08 passed and captured
`UNUVAULT_IOS_PAIRING_RECEIPT paired ... material=AES-GCM-256` with
`handoffId=physical-receipt-session-25B426DF-4FB2-4AA3-B51F-0022286AB270`,
`targetDeviceId=ios-device-d5185f1f-c612-4987-9a68-6a90a3ab8313`. That recorded
receipt proved physical pairing transport only; it did not prove
physical-device local open, encrypted import,
or read-only reload, and it still does not claim camera QR scanning.

Run:

```bash
pnpm test:ios
```

For simulator visual proof of the promoted product composition, run:

```bash
pnpm test:ios:ui-host
```

The UI host uses XcodeGen to build `apps/ios/HostApp`, launches
deterministic metadata-only composition states, and writes:

- `docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-empty.png`
- `docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-vault.png`
- `docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-reload-failed.png`
- `docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-accessibility3.png`

These screenshots prove simulator composition and Dynamic Type layout,
including the `accessibility3` fixture. They do not prove manual VoiceOver
rotor behavior, physical-device import, camera QR scanning, or a shipped full
mobile vault workflow.
