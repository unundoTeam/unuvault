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
- Historical-only Pencil draft artifact:
  `/Users/yuchen/Design/unu/unuvault/unuvault.draft.pen` is inactive
  historical/reference-only, not a Native design workflow or promotion source
- Design-system frame: `current/unuvault/design-system-v1`
- iOS Pencil source frames:
  `current/unuvault/ios-product-composition-v1`,
  `current/unuvault/ios-pairing-invite-receive-v3`

## Adapter Implementation Paths

- Swift package: `apps/ios/App/Package.swift`
- Login shell: `apps/ios/App/Sources/Features/Auth/LoginView.swift`
- Vault list shell: `apps/ios/App/Sources/Features/Vault/VaultListView.swift`
- Product composition shell:
  `apps/ios/App/Sources/Features/ProductComposition/IOSProductCompositionView.swift`
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
- Product composition test:
  `apps/ios/App/Tests/IOSProductCompositionTests.swift`
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
- iOS simulator product-composition screenshots:
  - `docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-empty.png`
  - `docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-vault.png`
  - `docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-reload-failed.png`
  - `docs/design/evidence/2026-07-14-ios-product-composition/ios-product-composition-accessibility3.png`

## Current Implementation Evidence

| Requirement | Current evidence | Status |
| --- | --- | --- |
| Native implementation path | SwiftUI views and an iOS Swift package implement the always-reachable Vault/Pairing composition, Mac invite parsing, target identity and claim exchange, recipient-bound handoff open, AES-GCM encrypted received-vault persistence, fresh reload, and read-only vault metadata projection. Password reveal/copy, editing, search, biometric unlock, cloud sync, and a shipped full mobile vault remain out of scope. | partial |
| Platform token mapping | The receive-invite view uses repo-local neutral gray, secure green, danger red, radius, and typography constants aligned with the approved source frame; formal mobile primitive mapping is not claimed. | partial |
| Safe-area and touch target behavior | The approved product composition and pairing v3 frames use native safe-area layout. `IOSProductCompositionUIContract` and `PairingInviteAccessibilityContract` pin 44pt minimum targets and 48pt primary/Retry actions; `bash scripts/testing/run-ios-ui-host.sh` launches the composition in an iPhone simulator and captures empty, vault, reload-failed, and `accessibility3` evidence. | partial |
| Auth or vault action review/recovery mapping | The receive flow disables import until invite validation, fails closed on expired invites, opens only a claimant-key-bound handoff, and persists encrypted imported credentials. A missing or valid empty received-vault store selects Pairing. An unreadable store instead enters an explicit `.failed` state, shows a safe error, and exposes Retry without displaying sensitive values. Import success alone does not switch destinations; only a fresh successful reload with non-empty metadata selects Vault. | partial |
| Repo-owned iOS verification command | `bash scripts/testing/run-ios.sh` runs the current iOS package gate on an available iPhone simulator; `pnpm test:pairing-boundary` runs that iOS receive/client proof with the Mac companion pairing-boundary proof as one repo-level gate; `pnpm test:pairing-lan-smoke` proves the Mac runtime can accept a target claim through a non-loopback LAN IPv4 base URL; `pnpm test:pairing-physical-receipt` is the connected-device receipt harness; `bash scripts/testing/run-ios-ui-host.sh` builds and launches the composition host for four-state screenshot proof. | available |
| Physical iPhone receipt evidence | On 2026-07-08, a local hardware run of `corepack pnpm test:pairing-physical-receipt` passed against a connected, unlocked, trusted iPhone and captured `UNUVAULT_IOS_PAIRING_RECEIPT paired handoffId=physical-receipt-session-25B426DF-4FB2-4AA3-B51F-0022286AB270 targetDeviceId=ios-device-d5185f1f-c612-4987-9a68-6a90a3ab8313 material=AES-GCM-256`; the source commit under test, `ec20f52`, also passed GitHub Actions CI run `28897875643` (`js / Node Verify`) on `main`. | recorded |
| Visual/accessibility proof | `current/unuvault/ios-product-composition-v1` and `current/unuvault/ios-pairing-invite-receive-v3` are promoted. The SwiftUI composition keeps Vault and Pairing reachable, exposes selected/unselected semantics without color-only state, announces loading/failure/recovery, and the host captures empty, vault, reload-failed, and `accessibility3` screenshots; no manual VoiceOver rotor run is recorded yet. | partial |
| Dynamic Type | The composition and receive flow scale text and target metrics, wrap content, and preserve both destinations. The host's `accessibility3` fixture records the largest required proof state without claiming manual rotor behavior. | partial |
| VoiceOver | Static labels cover both destinations, selected state, progress, recognized Mac, import, status, error, and recovery. Composition announcements and receive-flow labels are covered by the current iOS package gate; manual rotor path proof is not recorded yet. | partial |
| 44pt targets | `IOSProductCompositionUIContract` and `PairingInviteAccessibilityContract` pin 44pt minimum targets and 48pt primary/Retry actions; tests cover those contracts and the four host screenshots provide layout evidence. | partial |

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
product-composition and pairing v3 Pencil source frames, plus
the current Swift package gate and four XcodeGen-backed simulator host
screenshots. The
tests assert minimal SwiftUI copy for login and AutoFill onboarding, plus an
`IOSProductCompositionView` that keeps Vault and Pairing reachable, loads the
app-default received store, selects Pairing for missing or empty metadata, and
uses an explicit `.failed` state with safe error copy and Retry when that store
is unreadable. Import success alone stays on Pairing; only a fresh successful
reload with non-empty metadata selects Vault. The pairing receive flow parses
QR payloads and invite envelopes, rejects malformed, expired, or unsupported
endpoint payloads, shows the recognized Mac, disables import until the invite
is valid, hides raw invite session details after recognition, shows invite
expiry instead of a raw endpoint URL, builds a target-device identity claim,
posts it without a bridge bearer token, and rejects invalid, expired,
status-failed, or target-mismatched handoff responses. The UI host launches
deterministic composition fixtures for empty, vault, and reload-failed states,
plus the `accessibility3` fixture, and records the four exact screenshot paths
above. The package tests additionally prove claimant-key-bound handoff open,
AES-GCM persistence, reload, and read-only metadata projection without
passwords. This evidence does not prove native primitive adoption, camera QR
scanning, automatic LAN discovery, password reveal/copy, editing, search,
biometric unlock, cloud sync, a manual VoiceOver rotor run, a current physical
iPhone import receipt, or a shipped full mobile vault workflow.
`pnpm test:pairing-boundary` is the combined contract proof that runs the iOS
target-claim client tests and the Mac runtime `/v1/pairing/claim` tests in one
gate, so the two sides cannot silently drift while still avoiding a current
physical-device, camera, or automatic-LAN-discovery claim.
`pnpm test:pairing-lan-smoke` is the LAN-address transport proof: it starts the
proof-mode Mac companion bridge on `0.0.0.0`, uses a non-loopback LAN IPv4 base
URL in the invite, sends the target claim over real HTTP, receives only wrapped
handoff material, and proves replay fails. This LAN smoke alone does not prove
camera QR scanning, physical-iPhone local open or encrypted import, or a shipped
iPhone vault workflow.
`pnpm test:pairing-physical-preflight` is the physical-device readiness check:
it validates local LAN address resolution, port availability, Xcode tools,
`xcodegen`, visible trusted iPhone detection, and signing hints without
building, installing, launching, waiting for a receipt, or claiming device
proof. `pnpm test:pairing-physical-receipt` is the physical-device receipt
harness: it starts `MacPairingReceiptHost`, installs `UnuVaultIOSHost` on a
connected trusted iPhone, launches it with a `unuvault-ioshost://pair` payload
URL containing a base64URL invite, and waits for
`UNUVAULT_IOS_PAIRING_RECEIPT imported` in the device console. A local run still
requires connected hardware and signing; no current imported receipt is
recorded. Camera QR scanning and a shipped iPhone vault workflow remain
unclaimed.
Recorded local hardware evidence: on 2026-07-08,
`corepack pnpm test:pairing-physical-receipt` passed against a connected,
unlocked, trusted iPhone and captured
`UNUVAULT_IOS_PAIRING_RECEIPT paired` with
`handoffId=physical-receipt-session-25B426DF-4FB2-4AA3-B51F-0022286AB270`,
`targetDeviceId=ios-device-d5185f1f-c612-4987-9a68-6a90a3ab8313`, and
`material=AES-GCM-256`. The source commit under test, `ec20f52`
(`test: reuse iOS pairing identity in host app`), also passed GitHub Actions CI
run `28897875643` (`js / Node Verify`) on `main`. This records the physical
pairing-transport receipt only; it does not prove physical-device local open,
encrypted import, or read-only reload. Camera QR scanning and a shipped iPhone
vault workflow remain unclaimed.

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

Historical `2026-07-02` draft cleanup label for
`draft/unuvault/ios-pairing-invite-receive-v2`
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
