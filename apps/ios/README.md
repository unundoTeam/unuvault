# unuvault iOS

This directory holds the SwiftUI iPhone app, AutoFill onboarding flows, and the
repo-owned Mac pairing receive flow for unuvault.

Current pairing proof is receive-side only. The iOS package exposes a SwiftUI
paste-invite flow from `current/unuvault/ios-pairing-invite-receive-v1`, parses
the Mac companion invite envelope and QR payload, rejects expired, malformed, or
unsupported-endpoint payloads, shows the recognized Mac, builds a target-device
identity claim with `deviceId`, `displayName`, and `publicKeyFingerprint`, posts
that claim to the invite-provided Mac pairing endpoint without a bridge bearer
token, and parses the Mac handoff response envelope while rejecting invalid,
expired, status-failed, or target-mismatched responses. It does not claim camera
QR scanning, real LAN discovery, local decrypt/import, or physical iPhone
receipt yet.

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
