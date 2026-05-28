# unuvault iOS

This directory holds the SwiftUI iPhone app, AutoFill onboarding flows, and the
repo-owned Mac pairing payload contract for unuvault.

Current pairing proof is intentionally protocol-shaped only. The iOS package can
parse the Mac companion QR payload, reject expired or malformed payloads, build
a target-device identity claim with `deviceId`, `displayName`, and
`publicKeyFingerprint`, post that claim to the Mac pairing endpoint without a
bridge bearer token, and parse the Mac handoff response envelope while
rejecting invalid, expired, status-failed, or target-mismatched responses. It
does not claim camera QR scanning, real LAN discovery, local decrypt/import, or
physical iPhone receipt yet.

Run:

```bash
bash scripts/testing/run-ios.sh
```
