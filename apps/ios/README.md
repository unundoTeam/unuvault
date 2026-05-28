# unuvault iOS

This directory holds the SwiftUI iPhone app, AutoFill onboarding flows, and the
repo-owned Mac pairing payload contract for unuvault.

Current pairing proof is intentionally protocol-shaped only. The iOS package can
parse the Mac companion QR payload, reject expired or malformed payloads, and
build a target-device identity claim with `deviceId`, `displayName`, and
`publicKeyFingerprint`. It does not claim camera QR scanning, LAN transport, or
physical iPhone receipt yet.

Run:

```bash
bash scripts/testing/run-ios.sh
```
