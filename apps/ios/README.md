# unuvault iOS

This directory holds the SwiftUI iPhone app, AutoFill onboarding flows, and the
repo-owned Mac pairing receive flow for unuvault.

Current pairing proof is receive-side only. The iOS package exposes a SwiftUI
paste-invite flow from `current/unuvault/ios-pairing-invite-receive-v2`, parses
the Mac companion invite envelope and QR payload, rejects expired, malformed, or
unsupported-endpoint payloads, shows the recognized Mac, hides raw invite session
details after recognition, shows invite expiry instead of a raw endpoint URL,
builds a target-device identity claim with `deviceId`, `displayName`, and
`publicKeyFingerprint`, posts that claim to the invite-provided Mac pairing
endpoint without a bridge bearer token, and parses the Mac handoff response
envelope while rejecting invalid, expired, status-failed, or target-mismatched
responses. It does not claim camera QR scanning, real LAN discovery, or local
decrypt/import. Repo-level
`pnpm test:pairing-lan-smoke` now proves the Mac runtime can accept the target
claim through a non-loopback LAN IPv4 base URL, but that command is still not a
physical iPhone receipt or camera QR scan proof.

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
`UNUVAULT_IOS_PAIRING_RECEIPT paired` in the iPhone console. The latest
recorded hardware run on 2026-07-08 passed with
`handoffId=physical-receipt-session-25B426DF-4FB2-4AA3-B51F-0022286AB270`,
`targetDeviceId=ios-device-d5185f1f-c612-4987-9a68-6a90a3ab8313`, and
`material=AES-GCM-256`; it still does not claim camera QR scanning or local
decrypt/import.

Run:

```bash
bash scripts/testing/run-ios.sh
```

For simulator visual proof of the promoted receive-invite screen, run:

```bash
bash scripts/testing/run-ios-ui-host.sh
```

The UI host uses XcodeGen to build `apps/ios/HostApp`, launches
`PairingInviteReceiveView` with a deterministic sample Mac invite, and writes
`docs/design/evidence/2026-05-29-ios-ui-host/ios-pairing-invite-host.png`.
