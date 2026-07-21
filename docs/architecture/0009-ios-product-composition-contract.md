# iOS Product Composition Contract

## Status and authority

This is the current runtime-composition contract for the iOS product surface.
The current runtime source is the SwiftUI composition model and view in
`apps/ios/App/Sources/Features/ProductComposition/IOSProductCompositionView.swift`,
the host deep-link handling in
`apps/ios/HostApp/Sources/UnuVaultIOSHostApp.swift`, and the current iOS tests;
it is not the old branch spec.

The portfolio design authority is
`/Users/yuchen/Code/unu/unuOS/docs/portfolio/design-operating-index.md` and its
routed Pencil registry. The registered iOS frames are
`current/unuvault/ios-vault-home-native-locked-v1` and
`current/unuvault/ios-vault-list-readonly-v1`, together with
`current/unuvault/design-system-v1`. Do not claim
`current/unuvault/ios-product-composition-v1` or
`current/unuvault/ios-pairing-invite-receive-v3` as current unless the
portfolio authority is updated through its own gate.

## Product boundary

The composition owns the product-level route between Vault and Pairing. It
uses metadata-only Vault state and safe Pairing status; it does not expose a
password, raw invite, encrypted payload, or production data.

## Implemented invariants

- Vault and Pairing are two always-reachable destinations.
- Startup loads the app-default received-vault store: non-empty metadata selects
  Vault, while an empty or failed load selects Pairing.
- A pairing import is followed by a fresh store-reader reload. Only non-empty
  metadata switches the destination to Vault.
- Vault selection requires non-empty metadata; the list model is metadata-only
  and does not visibly expose secrets.
- The current parser and single-flight foundations reject malformed deep-link
  payloads and prevent concurrent pairing work from starting another import.
- The valid deep-link product route: after the host accepts one valid invite and
  startup loading is settled, it selects Pairing, forwards the invite into the
  composition, and starts one pairing attempt. A second or concurrent attempt
  remains single-flight.
- Existing retry and accessibility semantics remain part of the runtime
  boundary, including safe retry copy and destination labels.

## Current unimplemented requirements

The following reviewed requirements are not established by the current runtime
contract and must remain explicit until separately implemented and tested:

1. A late startup load must not override a user-selected destination.
2. An invalid deep link must select Pairing and provide recoverable UI state.
3. A second deep link while pairing is busy needs visible feedback rather than
   only a dropped attempt.
4. Vault loading needs a typed safe-load failure that distinguishes safe failure
   categories without exposing an underlying error.
5. Reload work needs stale-result generation or cancellation ownership so an
   older result cannot overwrite a newer route or import state.
6. Pairing needs explicit post-import reload progress before its terminal
   success or safe failure state.
7. VoiceOver route focus and announcement deduplication need an explicit,
   verified product-level contract.

## Proof gaps

Fresh proof is still required for VoiceOver rotor behavior, Reduce Motion,
landscape, safe-area, dark/light parity, and real-device/simulator evidence.
Screenshots or passing tests alone do not prove Pencil sync. They also do not
prove physical-device import, camera QR scanning, or a shipped full mobile
vault workflow.

## Design Gate

Design Gate: docs-only contract salvage.

- Swift mutation: none.
- Pencil mutation: none.
- Pencil sync: not proven by this contract.
- Pencil preflight: not applicable.
- Pencil lease: not applicable.

## Verification

The focused contract proof is
`corepack pnpm exec vitest run tests/ios-product-composition-contract.spec.ts`.
The adjacent authority proof is `tests/workspace-entrypoints.spec.ts`. Current
canonical repo gates remain `pnpm test:ios` and `pnpm test:ios:ui-host`; this
document does not claim that they were run.

## Salvage provenance and lifecycle

The historical source is
`codex/ios-product-composition-spec@8fea5985ed0cfbc0dec32da7b9642f6d27bf178f`,
at `docs/superpowers/specs/2026-07-13-ios-product-composition-design.md`.
It is salvage provenance only, not current runtime or Pencil authority. The
old branch remains until a separate lifecycle closeout and explicit deletion
approval.
