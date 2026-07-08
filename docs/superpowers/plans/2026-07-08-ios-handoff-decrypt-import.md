# iOS Handoff Decrypt and Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` or `superpowers:executing-plans` to
> implement this plan task-by-task. Keep the current physical receipt evidence
> separate from the new import proof until a real iPhone run emits an imported
> receipt.

**Goal:** Move the iOS pairing flow from "physical iPhone received a wrapped
handoff" to "physical iPhone can decrypt recipient-bound handoff material and
import it into an iOS-local vault boundary."

**Current constraint:** The Mac pairing handoff is currently encrypted with the
Mac-side `pairingTransferKeyData`. The iOS claim sends only
`publicKeyFingerprint`, so iOS has no cryptographic material that can open the
handoff. Do not implement local import by passing the fixed transfer key to iOS;
that would be test plumbing, not recipient-bound decrypt evidence.

**Architecture:** Upgrade the pairing claim from a fingerprint-only target to a
recipient key-agreement target. iOS owns a Keychain-backed
`P256.KeyAgreement.PrivateKey`, sends the public key DER and fingerprint in the
claim, Mac derives an ephemeral ECDH/HKDF AES-GCM key for that recipient, and
iOS opens the handoff with its persisted private key before writing a local
import receipt. The physical receipt then advances from `paired` to `imported`.

**Tech Stack:** Swift, SwiftUI, XCTest, CryptoKit, Keychain, existing
`corepack pnpm` verification wrappers.

**Non-goals:**

- No camera QR scanning.
- No real LAN discovery beyond the existing invite-provided base URL.
- No cloud sync, AutoFill fill path, release, or unuforge gate change.
- No UI redesign. If status text or interaction state changes in the promoted
  pairing screen, use the repo-local UI gate before implementation.
- No plaintext credential material in logs, HTTP JSON outside encrypted handoff
  material, screenshots, status text, or receipt lines.

---

## File Map

- Modify `apps/ios/App/Sources/Pairing/DefaultPairingTargetIdentityProvider.swift`
  to create and persist a key-agreement private key.
- Modify `apps/ios/App/Sources/Pairing/PairingPayload.swift` to carry recipient
  key material in `PairingTargetIdentity`, `PairingTargetClaim`, and
  `MacPairingHandoffMaterial`.
- Add `apps/ios/App/Sources/Pairing/PairingHandoffOpener.swift` for iOS ECDH,
  HKDF, AES-GCM open, target validation, expiry validation, and replay
  rejection.
- Add `apps/ios/App/Sources/Pairing/PairingHandoffImportStore.swift` for the
  minimal iOS-local import boundary and safe receipt.
- Modify `apps/ios/App/Sources/Features/Pairing/PairingInviteReceiveView.swift`
  to import after handoff receipt and expose imported/failure state without
  plaintext.
- Modify `apps/ios/HostApp/Sources/UnuVaultIOSHostApp.swift` to print an
  `UNUVAULT_IOS_PAIRING_RECEIPT imported` line after decrypt/import succeeds.
- Modify `apps/macos/App/Sources/MacCompanionCore/CompanionPairingHandoff.swift`
  to encrypt handoff material to the claimed recipient public key.
- Modify `apps/macos/App/Sources/MacCompanionCore/CompanionPairingSession.swift`
  to remove the fixed transfer-key requirement from pairing completion.
- Modify `apps/macos/App/Sources/MacCompanionCore/BridgeHTTPCodec.swift` to
  validate the recipient public key in `/v1/pairing/claim`.
- Modify `apps/macos/App/Sources/UnuVaultMacCompanion/CompanionViewModel.swift`
  and `apps/macos/App/Sources/MacPairingReceiptHost/main.swift` to stop
  injecting `pairingTransferKeyData` for pairing handoff.
- Modify `scripts/testing/run-pairing-physical-receipt.sh` to wait for the new
  imported receipt once the implementation is ready.
- Update `README.md` and `apps/ios/README.md` only after the corresponding
  simulator, LAN, and physical evidence exists.

---

## Task 1: Lock the Protocol Gap with RED Tests

**Files:**

- Modify `apps/ios/App/Tests/PairingTargetIdentityProviderTests.swift`
- Modify `apps/ios/App/Tests/PairingPayloadTests.swift`
- Modify `apps/macos/App/Tests/MacCompanionCoreTests/BridgeHTTPCodecTests.swift`
- Modify `apps/macos/App/Tests/MacCompanionCoreTests/PairingHandoffTests.swift`

- [ ] Add an iOS identity-provider test proving `makeIdentity()` returns:
  `deviceId`, `displayName`, `publicKeyFingerprint`, and
  `publicKeyAgreementDERBase64URL`.
- [ ] Assert the fingerprint is the SHA-256 digest of the decoded key-agreement
  DER bytes, not a hard-coded placeholder and not a signing-key fingerprint.
- [ ] Add iOS claim-builder tests that reject an empty
  `publicKeyAgreementDERBase64URL` and preserve the field in encoded claim JSON.
- [ ] Add Mac `/v1/pairing/claim` tests that reject claims missing
  `target.publicKeyAgreementDERBase64URL`.
- [ ] Add Mac handoff tests that expect a recipient-bound algorithm such as
  `P256-HKDF-SHA256-AES-GCM-256`, an ephemeral sender public key field, and no
  fixed transfer-key dependency.
- [ ] Run focused tests and confirm RED:

```bash
bash scripts/testing/run-ios.sh
swift test --package-path apps/macos/App --filter PairingHandoffTests
swift test --package-path apps/macos/App --filter BridgeHTTPCodecTests/testPairingClaimExchangeRejectsMissingRecipientKeyMaterial
```

Expected RED: current code has only fingerprint-only identity and
`AES-GCM-256` transfer-key handoff.

---

## Task 2: Implement Recipient Key-Agreement Handoff on Mac and iOS Contracts

**Files:**

- Modify `apps/ios/App/Sources/Pairing/DefaultPairingTargetIdentityProvider.swift`
- Modify `apps/ios/App/Sources/Pairing/PairingPayload.swift`
- Modify `apps/macos/App/Sources/MacCompanionCore/CompanionPairingHandoff.swift`
- Modify `apps/macos/App/Sources/MacCompanionCore/CompanionPairingSession.swift`
- Modify `apps/macos/App/Sources/MacCompanionCore/BridgeHTTPCodec.swift`
- Modify `apps/macos/App/Sources/UnuVaultMacCompanion/CompanionViewModel.swift`
- Modify `apps/macos/App/Sources/MacPairingReceiptHost/main.swift`

- [ ] Replace iOS pairing identity key generation with
  `P256.KeyAgreement.PrivateKey`.
- [ ] Persist the key-agreement private key in the existing Keychain-backed
  store, using a new account name if migration ambiguity would make old
  signing keys unreadable.
- [ ] Add `publicKeyAgreementDERBase64URL` to iOS `PairingTargetIdentity` and
  Mac `CompanionPairingTarget`.
- [ ] Keep `publicKeyFingerprint` as the SHA-256 digest of the key-agreement DER
  so target matching remains stable.
- [ ] Add an ephemeral Mac `P256.KeyAgreement.PrivateKey` per handoff.
- [ ] Derive the AES-GCM key with CryptoKit ECDH plus HKDF, binding associated
  data to `handoffId`, `sourceDeviceId`, `targetDeviceId`, and
  `targetPublicKeyFingerprint`.
- [ ] Extend `CompanionPairingHandoffMaterial` and `MacPairingHandoffMaterial`
  with `senderPublicKeyAgreementDERBase64URL`.
- [ ] Remove `pairingTransferKeyData` from pairing session completion and the
  receipt host path after tests cover the new recipient-bound contract.
- [ ] Re-run focused tests until GREEN:

```bash
bash scripts/testing/run-ios.sh
swift test --package-path apps/macos/App --filter PairingHandoffTests
swift test --package-path apps/macos/App --filter BridgeHTTPCodecTests/testPairingClaimExchangeRejectsMissingRecipientKeyMaterial
```

---

## Task 3: Add the iOS Handoff Opener and Local Import Boundary

**Files:**

- Add `apps/ios/App/Sources/Pairing/PairingHandoffOpener.swift`
- Add `apps/ios/App/Sources/Pairing/PairingHandoffImportStore.swift`
- Modify `apps/ios/App/Tests/PairingPayloadTests.swift`
- Modify `apps/ios/App/Tests/PairingInviteFlowTests.swift`

- [ ] Add tests that open a Mac-produced handoff with the matching iOS private
  key and decode the vault payload into safe import models.
- [ ] Add failure tests for wrong private key, tampered ciphertext, tampered
  tag, unsupported algorithm, expired handoff, target mismatch, and replay.
- [ ] Add tests proving encoded handoff JSON, status text, diagnostics, and
  receipt lines do not contain credential ids, usernames, or passwords.
- [ ] Implement `PairingHandoffOpener` with fail-closed error cases matching
  the existing parser style.
- [ ] Implement a minimal local import store that writes imported credentials to
  an iOS-local boundary and returns only `handoffId`, `importedCredentialCount`,
  and non-secret imported ids.
- [ ] Keep the store injectable so tests can use an in-memory store and the host
  app can use the real local boundary.
- [ ] Run:

```bash
bash scripts/testing/run-ios.sh
```

---

## Task 4: Wire Import into the Receive Flow and Host Receipt

**Files:**

- Modify `apps/ios/App/Sources/Features/Pairing/PairingInviteReceiveView.swift`
- Modify `apps/ios/App/Tests/PairingInviteFlowTests.swift`
- Modify `apps/ios/HostApp/Sources/UnuVaultIOSHostApp.swift`
- Modify `scripts/testing/run-pairing-physical-receipt.sh`

- [ ] Inject a `handoffImporter` into `PairingInviteViewModel`.
- [ ] After `PairingExchangeClient.exchange` returns a handoff, call the
  importer before reporting success.
- [ ] Add view-model states for imported and import-failed results. Keep copy
  short, non-secret, and aligned with the existing receive screen.
- [ ] If any visible UI state, accessibility label, layout, or interaction copy
  changes, route the implementation through the repo-local UI gate before
  merging.
- [ ] Update `UnuVaultIOSHostApp` to print:

```text
UNUVAULT_IOS_PAIRING_RECEIPT imported handoffId=<id> sourceDeviceId=<mac> targetDeviceId=<ios> importedCredentialCount=<n> material=P256-HKDF-SHA256-AES-GCM-256
```

- [ ] Update `run-pairing-physical-receipt.sh` to wait for `imported`, while
  keeping failed diagnostics plaintext-free.
- [ ] Run:

```bash
bash scripts/testing/run-ios.sh
bash scripts/testing/run-pairing-boundary.sh
```

---

## Task 5: Prove the Whole Flow and Update Evidence Docs

**Files:**

- Modify `README.md`
- Modify `apps/ios/README.md`
- Modify design or operations evidence docs only if the completed proof changes
  their explicit claim boundary.

- [ ] Run the standard pairing boundary:

```bash
corepack pnpm test:pairing-boundary
```

- [ ] Run the LAN smoke:

```bash
corepack pnpm test:pairing-lan-smoke
```

- [ ] When a trusted physical iPhone is connected and signing is configured,
  run:

```bash
UNUVAULT_IOS_DEVELOPMENT_TEAM=8YU4N8SFGG \
UNUVAULT_IOS_ALLOW_PROVISIONING_UPDATES=1 \
corepack pnpm test:pairing-physical-receipt
```

- [ ] Update `README.md` and `apps/ios/README.md` from "physical receipt only"
  to "physical decrypt/import receipt" only after the command emits the new
  `UNUVAULT_IOS_PAIRING_RECEIPT imported` line.
- [ ] Preserve these explicit still-not-claimed boundaries unless separately
  implemented and evidenced: camera QR scanning, real LAN discovery, shipped
  App Store release, and production AutoFill import/fill.

---

## Completion Criteria

- iOS target claims include recipient key-agreement material.
- Mac no longer needs a fixed pairing transfer key for handoff encryption.
- iOS opens the handoff with its own persisted private key.
- iOS imports decrypted payloads into a local boundary without plaintext logs.
- Simulator and Mac pairing tests pass.
- LAN smoke passes.
- A real trusted iPhone emits `UNUVAULT_IOS_PAIRING_RECEIPT imported`.
- Docs claim only the evidence that actually passed.
