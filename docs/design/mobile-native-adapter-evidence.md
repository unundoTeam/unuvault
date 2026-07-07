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
  `current/unuvault/ios-pairing-invite-receive-v2`

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
- Cross-surface iOS/Mac pairing-boundary wrapper:
  `bash scripts/testing/run-pairing-boundary.sh`
- LAN-address pairing smoke wrapper:
  `bash scripts/testing/run-pairing-lan-smoke.sh`
- Physical iPhone pairing preflight wrapper:
  `bash scripts/testing/run-pairing-physical-receipt.sh --preflight`
- Physical iPhone pairing receipt wrapper:
  `bash scripts/testing/run-pairing-physical-receipt.sh`
- iOS simulator UI host wrapper: `bash scripts/testing/run-ios-ui-host.sh`
- iOS simulator UI host project: `apps/ios/HostApp/project.yml`
- iOS simulator UI host screenshot:
  `docs/design/evidence/2026-05-29-ios-ui-host/ios-pairing-invite-host.png`
- iOS simulator UI host Dynamic Type screenshot:
  `docs/design/evidence/2026-05-29-ios-ui-host/ios-pairing-invite-host-accessibility3.png`

## Current Implementation Evidence

| Requirement | Current evidence | Status |
| --- | --- | --- |
| Native implementation path | Minimal SwiftUI views, an iOS Swift package, a Mac pairing invite/payload parser, a target-claim model, a Mac handoff response parser, an iOS pairing exchange client, and a receive-invite ViewModel/View exist. | partial |
| Platform token mapping | The receive-invite view uses repo-local neutral gray, secure green, danger red, radius, and typography constants aligned with the approved source frame; formal mobile primitive mapping is not claimed. | partial |
| Safe-area and touch target behavior | The approved receive-invite frame and SwiftUI view use a single scrollable safe-area stack. `PairingInviteAccessibilityContract` pins a 44pt minimum touch target, a 48pt primary action minimum, and a 104pt invite editor minimum; `bash scripts/testing/run-ios-ui-host.sh` launches the screen in an iPhone simulator and captures screenshot evidence for visual review. | partial |
| Auth or vault action review/recovery mapping | The receive-invite flow disables pairing until invite validation, fails closed on expired invites, and records error copy; vault unlock/import/recovery actions remain out of scope. | partial |
| Repo-owned iOS verification command | `bash scripts/testing/run-ios.sh` runs the Swift package tests on an available iPhone simulator; `pnpm test:pairing-boundary` runs that iOS receive/client proof with the Mac companion pairing-boundary proof as one repo-level gate; `pnpm test:pairing-lan-smoke` proves the Mac runtime can accept a target claim through a non-loopback LAN IPv4 base URL; `pnpm test:pairing-physical-receipt` is the connected-device receipt harness; `bash scripts/testing/run-ios-ui-host.sh` builds and launches the receive-invite host app for screenshot proof. | available |
| Physical iPhone receipt evidence | On 2026-07-07, a local hardware run of `corepack pnpm test:pairing-physical-receipt` passed against a connected, unlocked, trusted iPhone and captured `UNUVAULT_IOS_PAIRING_RECEIPT paired ... material=AES-GCM-256`; pushed commit `7d26447` also passed GitHub Actions CI run `28855407199` (`js / Node Verify`) on `main`. | recorded |
| Visual/accessibility proof | `current/unuvault/ios-pairing-invite-receive-v2` is promoted, the SwiftUI receive flow exposes labels for the invite field, recognized Mac summary, Pair button, and status panel, hides raw invite session details after recognition, shows invite expiry instead of a raw endpoint URL, uses `@ScaledMetric` font and target metrics, and the UI host captures normal and `accessibility3` simulator screenshot evidence; no manual VoiceOver rotor run is recorded yet. | partial |
| Dynamic Type | The receive-invite view keeps the current-frame base font sizes while scaling them through `@ScaledMetric`, scales touch/editor heights, wraps text, and the host script captures an `accessibility3` screenshot. `PairingInviteFlowTests.testPairingViewAccessibilityContractCoversDynamicTypeVoiceOverAndTargets` locks the proof size. | partial |
| VoiceOver | Static accessibility labels exist for the invite field, recognized Mac summary, Pair button, and status panel. The labels are centralized in `PairingInviteAccessibilityContract` and covered by unit tests; manual rotor path proof is not recorded yet. | partial |
| 44pt targets | `PairingInviteAccessibilityContract` pins a 44pt minimum target, a 48pt primary Pair action, and a 104pt invite editor; the receive view uses scaled metrics for those controls and the contract is covered by unit tests. | partial |

## Verification

Run:

```bash
bash scripts/testing/run-ios.sh
pnpm test:pairing-boundary
pnpm test:pairing-lan-smoke
pnpm test:pairing-physical-receipt
bash scripts/testing/run-ios-ui-host.sh
```

Current proof from this lane is limited to the iOS package, the promoted
receive-invite Pencil source frame, Swift package tests, and XcodeGen-backed
normal plus `accessibility3` simulator UI host screenshots. The tests assert
minimal SwiftUI copy for login and AutoFill onboarding, plus a Mac pairing
receive flow that parses QR payloads and invite envelopes, rejects malformed,
expired, or unsupported endpoint payloads, shows the recognized Mac, disables
pairing until the invite is valid, hides raw invite session details after
recognition, shows invite expiry instead of a raw endpoint URL, builds a
target-device identity claim, posts the claim to the invite-provided Mac pairing
endpoint without a bridge bearer token, parses Mac handoff response envelopes,
rejects invalid, expired, status-failed, or target-mismatched handoff responses,
keeps credential, password, and vault plaintext out of UI status copy and
the claim/response contract, and locks the receive flow's Dynamic Type proof
size, VoiceOver labels, and 44pt-plus target metrics in
`PairingInviteAccessibilityContract`. The UI host
launches `PairingInviteReceiveView` with deterministic sample invite data and
records the normal and `accessibility3` simulator screenshot paths above. It
does not prove native primitive adoption, camera QR scanning, real LAN
discovery, local decrypt/import, or a shipped iPhone vault workflow.
`pnpm test:pairing-boundary` is the combined contract proof that runs the iOS
target-claim client tests and the Mac runtime `/v1/pairing/claim` tests in one
gate, so the two sides cannot silently drift while still avoiding a physical
device or LAN claim.
`pnpm test:pairing-lan-smoke` is the LAN-address transport proof: it starts the
proof-mode Mac companion bridge on `0.0.0.0`, uses a non-loopback LAN IPv4 base
URL in the invite, sends the target claim over real HTTP, receives only wrapped
handoff material, and proves replay fails. It still does not prove camera QR
scanning, physical iPhone receipt, local decrypt/import, or a shipped iPhone
vault workflow.
`pnpm test:pairing-physical-preflight` is the physical-device readiness check:
it validates local LAN address resolution, port availability, Xcode tools,
`xcodegen`, visible trusted iPhone detection, and signing hints without
building, installing, launching, waiting for a receipt, or claiming device
proof. `pnpm test:pairing-physical-receipt` is the physical-device receipt
harness: it starts `MacPairingReceiptHost`, installs `UnuVaultIOSHost` on a
connected trusted iPhone, launches it with a `unuvault-ioshost://pair` payload
URL containing a base64URL invite, and waits for
`UNUVAULT_IOS_PAIRING_RECEIPT paired` in the device console. A local run still
requires connected hardware and signing; camera QR scanning, local
decrypt/import, and a shipped iPhone vault workflow remain unclaimed.
Recorded local hardware evidence: on 2026-07-07,
`corepack pnpm test:pairing-physical-receipt` passed against a connected,
unlocked, trusted iPhone and captured
`UNUVAULT_IOS_PAIRING_RECEIPT paired ... material=AES-GCM-256`. The supporting
pushed commit `7d26447` (`test: surface iOS pairing receipt diagnostics`) also
passed GitHub Actions CI run `28855407199` (`js / Node Verify`) on `main`. This
records the physical receipt harness proof only; camera QR scanning, local
decrypt/import, and a shipped iPhone vault workflow remain unclaimed.

## Claim Boundary

No `adapter-mapped` or `adopted` claim is made for the mobile/non-SwiftUI native
adapter lane.

This lane stays below `adapter-mapped` until future iOS UI slices supply:

- platform token and local-value mapping across the full represented flow
- safe-area and 44pt touch target proof
- Dynamic Type and VoiceOver evidence
- disabled/loading/error or recovery proof where the surface exposes actions
- camera QR or copy handoff evidence when the handoff method is implemented

Current Pencil sync label for this lane:
`current matches implementation`.

Draft cleanup label for `draft/unuvault/ios-pairing-invite-receive-v2`
(`Uz6n3`): `deleted after approval` during the 2026-07-02 design hygiene
cleanup.

Superseded current frame `retained/unuvault/ios-pairing-invite-receive-v1-superseded-by-v2`
is retained temporarily as implementation history, not current implementation
source.

Intentionally local values that must not be promoted into the shared library:

- `unuvault` credential, master-password, and AutoFill copy
- product-specific iPhone workflow sequencing
- iOS platform chrome and native control behavior
- security posture, auth boundary, and vault-domain implementation details
