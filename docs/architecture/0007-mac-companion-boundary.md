# Mac Companion Boundary

## Decision

unuvault should add a native macOS companion as the first local trusted root for
the local-first vault model.

The Mac companion is not a replacement for the Web vault UI. It is the local
security agent that owns device-local unlock, loopback credential release,
trusted-device pairing, and recovery handoff for a Mac user. The Web vault can
remain the primary management surface, but it should request secrets through the
Mac companion when the product is operating in local-first mode.

## Why This Exists

`0006-local-first-recovery-boundary.md` defines unuvault as local-first,
account-optional, unlock-required, and server-blind. Those promises need a
local process that can:

- hold the device vault and local unlock state
- integrate with macOS security APIs
- approve or deny Web, browser, and iOS requests
- constrain secret release to the current origin and current intent
- anchor new-device pairing and recovery without making the server a plaintext
  reader

Without the Mac companion, the local-first posture would still depend mainly on
Web state and remote account flows.

## Product Role

The Mac companion owns:

- encrypted local vault storage for the Mac device
- primary password setup and unlock
- Touch ID or other macOS local user presence after the primary unlock policy is
  satisfied
- short-lived local unlock sessions
- loopback bridge serving only trusted local clients
- per-origin credential release approval
- device pairing approval for iOS and future trusted devices
- local backup export and encrypted restore handoff
- lost-device and revoke handling for this device's sessions
- non-secret local audit events for release, pair, export, and revoke attempts

The Mac companion does not own:

- the canonical account identity system
- hosted account login, callback, or bootstrap semantics
- full Web vault management UI in the first version
- bulk plaintext export without primary-password confirmation
- cloud conflict resolution as a first proof target
- recovery promises that bypass the primary password or user-held recovery
  material

## First Version Shape

The first version should be a small native macOS app, likely a menu bar
companion with focused sheets rather than a full desktop vault manager.

Minimum screens or surfaces:

- menu bar status: `locked`, `unlocked`, `sync available`, `attention needed`
- unlock sheet: primary password, Touch ID prompt, lock timeout state
- Web fill approval: requesting app, origin, credential label, approve or deny
- device pairing sheet: QR code or LAN pairing code, approve device, cancel
- recovery/export sheet: encrypted backup or transfer, primary password required

Full credential browsing, editing, search, import, and trust-center management
should remain in the Web vault until there is proof that duplicating those flows
in native macOS is worth the extra surface area.

## Technical Posture

Prefer a native SwiftUI macOS implementation for the first real companion.

Reason:

- Keychain, LocalAuthentication, app sandboxing, menu bar behavior, login items,
  local network prompts, notarization, and device-local user presence are core
  to this surface.
- Electron or a wrapped Web UI would add runtime and update surface area before
  the local security boundary is proven.
- The Mac companion should feel like a system security utility, not another
  copy of the Web app.

Future implementation should live under `apps/macos/` once the proof begins.
Until that directory exists, this document is the boundary authority, not a
claim that the macOS app already exists.

## Local Storage And Unlock

The Mac companion should:

- store vault material encrypted at rest
- keep plaintext only in memory and only while unlocked
- clear plaintext material on lock, timeout, sleep, revoke, lost-device state,
  and app termination where feasible
- require the primary password for high-risk actions defined by
  `0003-client-crypto-boundary.md` and `0006-local-first-recovery-boundary.md`
- allow Touch ID to reduce daily friction only after the primary-password policy
  is satisfied

The companion must not treat macOS login alone as permission to release secrets.

## Loopback Bridge

The companion bridge should bind to loopback only.

Required bridge rules:

- use a short-lived local trust token or equivalent local client proof
- reject requests when the vault is locked
- accept credential lookup only for explicit caller context and active origin
- return metadata before release
- create a pending native approval before release
- expose no HTTP approve or deny endpoint
- release at most one `{ username, password }` payload through a claim after
  a native approved fill intent
- require visible user approval for first-time or sensitive release contexts
- record non-secret audit events
- expire bridge sessions aggressively

The bridge should not expose bulk plaintext reads, cross-origin search, or
server-style admin APIs.

## Web Relationship

The Web vault remains useful for management, review, and account-enabled sync.
In local-first mode, however, Web should not become the plaintext authority.

Expected flow:

1. User opens the Web vault.
2. Web discovers the local companion bridge on loopback.
3. Web asks for vault status and credential metadata.
4. If the Mac vault is locked, Web prompts the user to unlock locally.
5. For password fill, Web asks the companion to release one credential for the
   active origin.
6. The companion creates a native approval prompt without returning plaintext.
7. After local Mac approval, Web claims the approved release once and receives
   the one credential payload.

The browser extension follows the same release boundary when filling page DOM:
content scripts provide only the trusted page context, the background runtime
asks the Mac companion for origin-scoped metadata, then a native approval and
one-time claim provide the password used for DOM fill.

If the local companion is unavailable, Web can still show account, recovery, and
sync status, but it should not pretend to have local plaintext access.

## iOS Pairing And Recovery

The Mac companion is the preferred first trusted device for iOS pairing.

Expected pairing posture:

- pair over QR code, local network, or another explicit device-to-device channel
- require the Mac vault to be unlocked before approving a new iOS device
- show the target device identity before approval
- transfer encrypted vault material or wrapped key material, not bulk plaintext
- require primary password or fresh strong unlock for approving the transfer
- bind the handoff to target-device key identity and reject replayed handoffs
- make failed or expired pairing attempts fail closed

When real iOS device interaction is in scope, verification should prefer a
physical-device LAN path over simulator-only proof.

## Lost Device And Revoke Handling

When this Mac is marked lost or revoked, the companion should:

- stop sync
- clear local bridge sessions
- reject new credential release requests
- require re-approval before future account-enabled sync
- show a clear locked or revoked state if the app opens again

If the Mac is offline, remote revocation cannot delete the already-stored
encrypted vault copy. This is expected and should remain explicit in user-facing
recovery copy.

## Verification Requirements

The first Mac proof is acceptable only when it demonstrates:

- the app starts on macOS
- a vault can be locked and unlocked locally
- the loopback bridge is unavailable or rejects release while locked
- an unlocked session can release only one credential for a specific origin
- lock, timeout, or revoke clears release ability
- iOS pairing proof uses a real LAN path when pairing behavior is being claimed

Passing Web tests alone is not proof that the Mac companion boundary works.

## Relationship To Existing Architecture

- `0006-local-first-recovery-boundary.md` owns the product-level local-first and
  recovery semantics.
- `0003-client-crypto-boundary.md` owns high-risk actions and primary-password
  requirements.
- `0005-secure-password-crypto.md` owns the crypto substrate and compatibility
  rules.
- This document owns the macOS companion role, non-goals, bridge boundary, and
  first proof expectations.
