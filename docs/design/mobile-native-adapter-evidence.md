# Mobile Native Adapter Evidence

This document records the current repo-local evidence boundary for the
`unuvault` iPhone surface. It supports the shared `unundo-interface` primitive
evidence backlog, but it does not claim mobile/native adapter adoption.

## Current Status

- Adapter lane: mobile/non-SwiftUI native adapter
- Repo: `unuvault`
- Surface: iPhone SwiftUI shell
- Status: `blocked-needs-evidence`
- Portfolio backlog:
  `/Users/yuchen/Code/unu/unuOS/docs/portfolio/shared-interface-primitives.md`
- Pencil current:
  `/Users/yuchen/Design/unu/unuvault/unuvault.current.pen`
- Pencil draft:
  `/Users/yuchen/Design/unu/unuvault/unuvault.draft.pen`
- Design-system frame: `current/unuvault/design-system-v1`
- iOS Pencil source frame: not promoted yet

## Adapter Implementation Paths

- Swift package: `apps/ios/App/Package.swift`
- Login shell: `apps/ios/App/Sources/Features/Auth/LoginView.swift`
- Vault list shell: `apps/ios/App/Sources/Features/Vault/VaultListView.swift`
- AutoFill onboarding shell:
  `apps/ios/App/Sources/Features/Autofill/AutofillOnboardingView.swift`
- Mac pairing payload contract:
  `apps/ios/App/Sources/Pairing/PairingPayload.swift`
- Login smoke test: `apps/ios/App/Tests/LoginViewTests.swift`
- AutoFill smoke test: `apps/ios/App/Tests/AutofillOnboardingViewTests.swift`
- Pairing payload contract test: `apps/ios/App/Tests/PairingPayloadTests.swift`
- iOS verification wrapper: `bash scripts/testing/run-ios.sh`

## Current Implementation Evidence

| Requirement | Current evidence | Status |
| --- | --- | --- |
| Native implementation path | Minimal SwiftUI views, an iOS Swift package, and a Mac pairing payload parser/claim model exist. | partial |
| Platform token mapping | No iOS token, spacing, radius, typography, color, or component mapping is recorded yet. | missing |
| Safe-area and touch target behavior | No screen-level layout, safe-area rule, or 44pt target proof is recorded yet. | missing |
| Auth or vault action review/recovery mapping | Current views have no unlock form, vault actions, disabled/loading states, confirmation, audit trail, or recovery flow. | missing |
| Repo-owned iOS verification command | `bash scripts/testing/run-ios.sh` runs the Swift package tests on an available iPhone simulator. | available |
| Visual/accessibility proof | No simulator/device screenshot has been compared with a routed Pencil category or iOS source frame. | missing |
| Dynamic Type | No Dynamic Type behavior, truncation, or layout proof is recorded yet. | missing |
| VoiceOver | No VoiceOver labels, rotor path, or accessibility trait proof is recorded yet. | missing |
| 44pt targets | No tappable controls exist in the current iOS shell, so no touch target proof exists yet. | missing |

## Verification

Run:

```bash
bash scripts/testing/run-ios.sh
```

Current proof from this lane is limited to the iOS package and smoke-test
entrypoint. The existing tests assert minimal SwiftUI copy for login and
AutoFill onboarding, plus a protocol-shaped Mac pairing payload contract that
parses QR payloads, rejects malformed or expired payloads, and builds a
target-device identity claim. They do not prove native primitive mapping,
visual parity, accessibility behavior, camera QR scanning, LAN transport,
physical iPhone receipt, or a shipped iPhone vault workflow.

## Claim Boundary

No `adapter-mapped` or `adopted` claim is made for the mobile/non-SwiftUI native
adapter lane.

This lane stays `blocked-needs-evidence` until a future iOS UI slice supplies:

- a promoted or approved iOS Pencil source frame
- native implementation paths for the represented screen/state
- platform token and local-value mapping
- safe-area and 44pt touch target proof
- Dynamic Type and VoiceOver evidence
- disabled/loading/error or recovery proof where the surface exposes actions
- simulator or device screenshot compared with the routed Pencil source

Current Pencil sync label for this lane:
`current needs promotion before implementation`.

Intentionally local values that must not be promoted into the shared library:

- `unuvault` credential, master-password, and AutoFill copy
- product-specific iPhone workflow sequencing
- iOS platform chrome and native control behavior
- security posture, auth boundary, and vault-domain implementation details
