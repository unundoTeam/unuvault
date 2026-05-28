# Mobile Native Adapter Evidence

This document records the current repo-local evidence boundary for the
`unuvault` iPhone surface. It supports the shared `unundo-interface` primitive
evidence backlog, but it does not claim mobile/native adapter adoption.

## Current Status

- Adapter lane: mobile/non-SwiftUI native adapter
- Repo: `unuvault`
- Surface: iPhone SwiftUI shell
- Status: `partial-native-proof`
- Portfolio backlog:
  `/Users/yuchen/Code/unu/unuOS/docs/portfolio/shared-interface-primitives.md`
- Pencil current:
  `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen`
- Pencil draft:
  `/Users/yuchen/Design/unu/unuvault/unuvault.draft.pen`
- Design-system frame: `current/unuvault/design-system-v1`
- iOS Pencil source frames:
  `current/unuvault/ios-vault-home-native-locked-v1`,
  `current/unuvault/ios-pairing-invite-receive-v1`

## Adapter Implementation Paths

- Swift package: `apps/ios/App/Package.swift`
- Login shell: `apps/ios/App/Sources/Features/Auth/LoginView.swift`
- Vault list shell: `apps/ios/App/Sources/Features/Vault/VaultListView.swift`
- AutoFill onboarding shell:
  `apps/ios/App/Sources/Features/Autofill/AutofillOnboardingView.swift`
- Mac pairing payload contract:
  `apps/ios/App/Sources/Pairing/PairingPayload.swift`
- Mac pairing receive flow:
  `apps/ios/App/Sources/Features/Pairing/PairingInviteReceiveView.swift`
- Login smoke test: `apps/ios/App/Tests/LoginViewTests.swift`
- AutoFill smoke test: `apps/ios/App/Tests/AutofillOnboardingViewTests.swift`
- Pairing payload contract test: `apps/ios/App/Tests/PairingPayloadTests.swift`
- Pairing receive flow test:
  `apps/ios/App/Tests/PairingInviteFlowTests.swift`
- iOS verification wrapper: `bash scripts/testing/run-ios.sh`

## Current Implementation Evidence

| Requirement | Current evidence | Status |
| --- | --- | --- |
| Native implementation path | Minimal SwiftUI views, an iOS Swift package, a Mac pairing invite/payload parser, a target-claim model, a Mac handoff response parser, an iOS pairing exchange client, and a receive-invite ViewModel/View exist. | partial |
| Platform token mapping | The receive-invite view uses repo-local neutral gray, secure green, danger red, radius, and typography constants aligned with the approved source frame; formal mobile primitive mapping is not claimed. | partial |
| Safe-area and touch target behavior | The approved receive-invite frame and SwiftUI view use a single scrollable safe-area stack and a 48pt primary Pair control, but no simulator/device screenshot comparison is recorded yet. | partial |
| Auth or vault action review/recovery mapping | The receive-invite flow disables pairing until invite validation, fails closed on expired invites, and records error copy; vault unlock/import/recovery actions remain out of scope. | partial |
| Repo-owned iOS verification command | `bash scripts/testing/run-ios.sh` runs the Swift package tests on an available iPhone simulator. | available |
| Visual/accessibility proof | `current/unuvault/ios-pairing-invite-receive-v1` is promoted and the SwiftUI receive flow exposes labels for the invite field, recognized Mac summary, Pair button, and status panel; no simulator/device screenshot or VoiceOver run is recorded yet. | partial |
| Dynamic Type | No Dynamic Type behavior, truncation, or layout proof is recorded yet. | missing |
| VoiceOver | Static accessibility labels exist for the receive-invite field, recognized Mac summary, Pair button, and status panel; rotor path proof is not recorded yet. | partial |
| 44pt targets | The primary Pair button is 48pt high; full target audit for every control is not recorded yet. | partial |

## Verification

Run:

```bash
bash scripts/testing/run-ios.sh
```

Current proof from this lane is limited to the iOS package, the promoted
receive-invite Pencil source frame, and Swift package tests. The tests assert
minimal SwiftUI copy for login and AutoFill onboarding, plus a Mac pairing
receive flow that parses QR payloads and invite envelopes, rejects malformed,
expired, or unsupported endpoint payloads, shows the recognized Mac, disables
pairing until the invite is valid, builds a target-device identity claim, posts
the claim to the invite-provided Mac pairing endpoint without a bridge bearer
token, parses Mac handoff response envelopes, rejects invalid, expired,
status-failed, or target-mismatched handoff responses, and keeps credential,
password, and vault plaintext out of UI status copy and the claim/response
contract. They do not prove native primitive adoption, simulator visual parity,
camera QR scanning, real LAN discovery, local decrypt/import, physical iPhone
receipt, or a shipped iPhone vault workflow.

## Claim Boundary

No `adapter-mapped` or `adopted` claim is made for the mobile/non-SwiftUI native
adapter lane.

This lane stays below `adapter-mapped` until future iOS UI slices supply:

- simulator or device screenshot compared with the routed Pencil source
- platform token and local-value mapping across the full represented flow
- safe-area and 44pt touch target proof
- Dynamic Type and VoiceOver evidence
- disabled/loading/error or recovery proof where the surface exposes actions
- camera QR or copy handoff evidence when the handoff method is implemented

Current Pencil sync label for this lane:
`current matches implementation`.

Draft cleanup label for `draft/unuvault/ios-pairing-invite-receive-v1`:
`promoted -> delete-candidate` after user-approved cleanup.

Intentionally local values that must not be promoted into the shared library:

- `unuvault` credential, master-password, and AutoFill copy
- product-specific iPhone workflow sequencing
- iOS platform chrome and native control behavior
- security posture, auth boundary, and vault-domain implementation details
